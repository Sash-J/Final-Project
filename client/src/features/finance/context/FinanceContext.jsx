import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../../auth/context/AuthContext";
import { financeService } from "../../../services/financeService";
import { sendWebVitalMetric } from "../../../utils/webVitalsReporter";

const FinanceContext = createContext(null);

const SWR_FRESH_MS = 30 * 1000;
const SWR_STALE_MS = 180 * 1000;

export const FINANCE_SECTIONS = [
  { id: "overview", label: "Overview", icon: "space_dashboard", group: "core" },
  { id: "projects", label: "Project Finances", icon: "movie_edit", group: "core" },
  {
    id: "company",
    label: "Company Finances",
    icon: "apartment",
    group: "core",
    requiresPersonal: true,
  },
  {
    id: "personal",
    label: "Personal Status",
    icon: "person_book",
    group: "core",
    requiresPersonal: true,
  },
  { id: "ledger", label: "Ledger & Records", icon: "receipt_long", group: "core" },
  { id: "debtors", label: "Debtors & Creditors", icon: "balance", group: "core" },
  { id: "reports", label: "Reports Studio", icon: "monitoring", group: "core" },
  {
    id: "accounts",
    label: "Chart of Accounts",
    icon: "account_tree",
    group: "admin",
  },
  {
    id: "telemetry",
    label: "Audit & Vitals",
    icon: "speed",
    group: "admin",
  },
];

export const TIMEFRAME_OPTIONS = ["1M", "3M", "6M", "1Y", "ALL"];

const scheduleIdleWork = (fn) => {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    return window.requestIdleCallback(fn, { timeout: 1500 });
  }
  return setTimeout(fn, 120);
};

export const FinanceProvider = ({ children }) => {
  const { user, hasPermission } = useAuth();

  const permissions = useMemo(
    () => ({
      canView: hasPermission("finance.view"),
      canEdit: hasPermission("finance.edit"),
      canApprove: hasPermission("finance.approve"),
      canExport: hasPermission("finance.export"),
      canManageAccounts: hasPermission("finance.accounts.manage"),
      canViewPersonal: hasPermission("finance.personal.view"),
    }),
    [hasPermission]
  );

  const [activeSection, setActiveSection] = useState("overview");
  const [scope, setScopeState] = useState(
    permissions.canViewPersonal ? "all" : "project"
  );
  const [timeframe, setTimeframeState] = useState("6M");
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionPreset, setSectionPreset] = useState({});
  const [recordModalRequest, setRecordModalRequest] = useState(null);

  const [workspaceData, setWorkspaceData] = useState(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [initError, setInitError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  // Lazy per-tab state & SWR caches
  const [sectionPayloads, setSectionPayloads] = useState({});
  const [sectionLoading, setSectionLoading] = useState({});
  const [sectionErrors, setSectionErrors] = useState({});

  const swrCacheRef = useRef(new Map());
  const sectionCacheRef = useRef(new Map());
  const mountedRef = useRef(true);
  const initialMarkSentRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Clamp restricted scopes/sections if user permissions exclude personal/company books
  useEffect(() => {
    if (!permissions.canViewPersonal) {
      if (scope !== "project") {
        setScopeState("project");
      }
      if (activeSection === "company" || activeSection === "personal") {
        setActiveSection("overview");
      }
    }
  }, [permissions.canViewPersonal, scope, activeSection]);

  const setScope = useCallback(
    (nextScope) => {
      if (!permissions.canViewPersonal && nextScope !== "project") {
        setScopeState("project");
        return;
      }
      setScopeState(nextScope);
    },
    [permissions.canViewPersonal]
  );

  const setTimeframe = useCallback((nextTf) => {
    const normalized = String(nextTf || "6M").toUpperCase();
    if (TIMEFRAME_OPTIONS.includes(normalized)) {
      setTimeframeState(normalized);
    }
  }, []);

  const fetchWorkspaceInit = useCallback(
    async ({ targetScope = scope, targetTimeframe = timeframe, force = false } = {}) => {
      const effectiveScope = permissions.canViewPersonal ? targetScope : "project";
      const cacheKey = `${effectiveScope}:${targetTimeframe}`;
      const cached = swrCacheRef.current.get(cacheKey);
      const age = cached ? Date.now() - cached.fetchedAt : Infinity;

      if (!force && cached && age < SWR_STALE_MS) {
        setWorkspaceData(cached.data);
        setLoadingInit(false);
        setInitError("");
        setLastSyncedAt(cached.fetchedAt);
        if (age < SWR_FRESH_MS) {
          return cached.data;
        }
        setRevalidating(true);
      } else {
        if (!workspaceData || force) {
          setLoadingInit(!workspaceData);
        }
        setRevalidating(Boolean(workspaceData));
        setInitError("");
      }

      const startTime =
        typeof performance !== "undefined" ? performance.now() : Date.now();

      try {
        const fresh = await financeService.getWorkspaceInit(
          effectiveScope,
          targetTimeframe
        );
        if (!mountedRef.current) return fresh;

        const now = Date.now();
        swrCacheRef.current.set(cacheKey, { data: fresh, fetchedAt: now });
        setWorkspaceData(fresh);
        setLastSyncedAt(now);
        setInitError("");

        // Trick #7 & #12: Emit custom TTI RUM timing off the main render path
        if (!initialMarkSentRef.current) {
          initialMarkSentRef.current = true;
          const elapsed =
            (typeof performance !== "undefined" ? performance.now() : now) - startTime;
          scheduleIdleWork(() => {
            sendWebVitalMetric({
              id: `fin-tti-${now}`,
              name: "TTFB",
              value: Math.round(elapsed),
              delta: Math.round(elapsed),
              rating: elapsed < 600 ? "good" : elapsed < 1500 ? "needs-improvement" : "poor",
              navigationType: "finance-workspace-init",
            });
          });
        }
        return fresh;
      } catch (err) {
        if (!mountedRef.current) return null;
        if (!cached || force) {
          setInitError(err.message || "Unable to load finance workspace.");
        }
        return null;
      } finally {
        if (mountedRef.current) {
          setLoadingInit(false);
          setRevalidating(false);
        }
      }
    },
    [scope, timeframe, permissions.canViewPersonal, workspaceData]
  );

  // Trigger single-pass bootstrap when scope/timeframe or user changes
  useEffect(() => {
    if (!user || !permissions.canView) {
      setLoadingInit(false);
      return;
    }
    fetchWorkspaceInit({ targetScope: scope, targetTimeframe: timeframe });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, permissions.canView, scope, timeframe]);

  // Trick #2: Lazy load per-tab data only when user activates that tab
  const loadSectionData = useCallback(
    async (sectionKey, params = {}, { force = false } = {}) => {
      const serialized = JSON.stringify(params || {});
      const cacheKey = `${sectionKey}:${serialized}`;
      const cached = sectionCacheRef.current.get(cacheKey);
      const age = cached ? Date.now() - cached.fetchedAt : Infinity;

      if (!force && cached && age < SWR_STALE_MS) {
        setSectionPayloads((prev) => ({ ...prev, [sectionKey]: cached.data }));
        if (age < SWR_FRESH_MS) {
          return cached.data;
        }
      }

      setSectionLoading((prev) => ({ ...prev, [sectionKey]: !cached || force }));
      setSectionErrors((prev) => ({ ...prev, [sectionKey]: "" }));

      try {
        let result = null;
        if (sectionKey === "projects") {
          result = await financeService.getProjectFinances();
        } else if (sectionKey === "company") {
          result = await financeService.getCompanyFinances(params);
        } else if (sectionKey === "personal") {
          result = await financeService.getPersonalFinances(params);
        } else if (sectionKey === "ledger") {
          result = await financeService.getTransactions(params);
        } else if (sectionKey === "debtors") {
          result = await financeService.getDebtorsCreditors(params.type || "all");
        } else if (sectionKey === "reports") {
          result = await financeService.getFinancialReport(params);
        } else if (sectionKey === "accounts") {
          result = await financeService.getTaxonomy();
        } else if (sectionKey === "telemetry") {
          result = await financeService.getFinanceTelemetry();
        }

        if (!mountedRef.current) return result;
        sectionCacheRef.current.set(cacheKey, {
          data: result,
          fetchedAt: Date.now(),
        });
        setSectionPayloads((prev) => ({ ...prev, [sectionKey]: result }));
        return result;
      } catch (err) {
        if (!mountedRef.current) return null;
        setSectionErrors((prev) => ({
          ...prev,
          [sectionKey]: err.message || "Failed to load section data.",
        }));
        return null;
      } finally {
        if (mountedRef.current) {
          setSectionLoading((prev) => ({ ...prev, [sectionKey]: false }));
        }
      }
    },
    []
  );

  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const clearDateRange = useCallback(() => {
    setDateRange({ from: "", to: "" });
  }, []);

  const navigateToSection = useCallback(
    (sectionKey, preset = {}) => {
      const targetDef = FINANCE_SECTIONS.find((s) => s.id === sectionKey);
      if (!targetDef) return;
      if (targetDef.requiresPersonal && !permissions.canViewPersonal) return;

      const nextPreset = { ...preset };
      if ((sectionKey === "ledger" || sectionKey === "reports") && !nextPreset.date_from && dateRange.from) {
        nextPreset.date_from = dateRange.from;
      }
      if ((sectionKey === "ledger" || sectionKey === "reports") && !nextPreset.date_to && dateRange.to) {
        nextPreset.date_to = dateRange.to;
      }

      setSectionPreset((prev) => ({ ...prev, [sectionKey]: nextPreset }));
      setActiveSection(sectionKey);
    },
    [permissions.canViewPersonal, dateRange.from, dateRange.to]
  );

  const invalidateCacheAndRefresh = useCallback(async () => {
    swrCacheRef.current.clear();
    sectionCacheRef.current.clear();
    await fetchWorkspaceInit({
      targetScope: scope,
      targetTimeframe: timeframe,
      force: true,
    });
    if (activeSection !== "overview") {
      await loadSectionData(activeSection, sectionPreset[activeSection] || {}, {
        force: true,
      });
    }
  }, [fetchWorkspaceInit, scope, timeframe, activeSection, loadSectionData, sectionPreset]);

  const openRecordModal = useCallback((preset = { doc_type: "expense", scope: "project" }) => {
    setRecordModalRequest({ ...preset, requestedAt: Date.now() });
  }, []);

  const closeRecordModal = useCallback(() => {
    setRecordModalRequest(null);
  }, []);

  const availableSections = useMemo(
    () =>
      FINANCE_SECTIONS.filter(
        (sec) => !sec.requiresPersonal || permissions.canViewPersonal
      ),
    [permissions.canViewPersonal]
  );

  const value = useMemo(
    () => ({
      permissions,
      availableSections,
      activeSection,
      setActiveSection,
      navigateToSection,
      scope,
      setScope,
      timeframe,
      setTimeframe,
      dateRange,
      setDateRange,
      clearDateRange,
      searchQuery,
      setSearchQuery,
      sectionPreset,
      workspaceData,
      taxonomy: workspaceData?.taxonomy || null,
      loadingInit,
      revalidating,
      initError,
      lastSyncedAt,
      refreshWorkspace: invalidateCacheAndRefresh,
      loadSectionData,
      sectionPayloads,
      sectionLoading,
      sectionErrors,
      recordModalRequest,
      openRecordModal,
      closeRecordModal,
    }),
    [
      permissions,
      availableSections,
      activeSection,
      navigateToSection,
      scope,
      setScope,
      timeframe,
      setTimeframe,
      dateRange,
      clearDateRange,
      searchQuery,
      sectionPreset,
      workspaceData,
      loadingInit,
      revalidating,
      initError,
      lastSyncedAt,
      invalidateCacheAndRefresh,
      loadSectionData,
      sectionPayloads,
      sectionLoading,
      sectionErrors,
      recordModalRequest,
      openRecordModal,
      closeRecordModal,
    ]
  );

  return (
    <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    throw new Error("useFinance must be used within a FinanceProvider");
  }
  return ctx;
};

export default FinanceContext;

