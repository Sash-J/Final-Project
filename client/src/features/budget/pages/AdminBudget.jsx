import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useBlocker, useSearchParams, useLocation } from "react-router-dom";
import { useModal } from "../../../context/ModalContext";
import { useProjects } from "../../projects/context/ProjectContext";
import BudgetEntryForm from "../components/BudgetEntryForm";
import PageHeader from "../../../components/common/PageHeader";
import { PageContainer, PageContentCard } from "../../../components/common/PageContainer";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import GlassSurface from "../../../components/effects/GlassSurface";
import Dock from "../../../components/common/Dock";
import Icon from "../../../components/common/Icon";
import NeoButton from "../../../components/common/NeoButton";
import PublishBudgetModal from "../components/PublishBudgetModal";
import { useAuth } from "../../auth/context/AuthContext";
import { budgetService } from "../../../services/budgetService";
import { getSortedDepartments, getSortedCategories } from "../utils/budgetHelpers";
import {
  AddDepartment,
  AddCategory,
  AddBudgetItem,
  WidgetOptionsMenu,
  CompareBudgetWidget,
  ProjectVersionWidget,
} from "../components/AdminSidebarWidgets";
import "./AdminBudget.css";
import "../components/BudgetDock.css";

// ── Main AdminBudget Component ────────────────────────────────────────────────
const AdminBudget = () => {
  const { hasRole, hasPermission } = useAuth();
  const isClient = hasRole("client");
  const canEditBudget = hasPermission("budget.edit") && !isClient;
  const canPublishBudget = hasPermission("budget.publish") && !isClient;

  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get("projectId") || searchParams.get("project") || "";
  const queryVersionId = searchParams.get("versionId") || searchParams.get("version") || "";

  const {
    projects,
    refreshProjects,
    hierarchyCache,
    phasesCache,
    deptsCache,
    catsCache,
    getBudgetMetadata,
    versionsCache,
    getBudgetVersions,
  } = useProjects();

  // Generate strictly ordered arrays from the budget hierarchy tree
  const sortedDepts = useMemo(() => getSortedDepartments(hierarchyCache, deptsCache), [hierarchyCache, deptsCache]);
  const sortedCats = useMemo(() => getSortedCategories(hierarchyCache, catsCache), [hierarchyCache, catsCache]);

  const [projectId, setProjectId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Detached Dock and Drawer states
  const [autoHide, setAutoHide] = useState(false); // Default: pinned by default
  const [activeDrawer, setActiveDrawer] = useState(() => (!queryProjectId ? "project" : null));
  const [budgetActions, setBudgetActions] = useState(null);
  const drawerRef = useRef(null);
  const dockContainerRef = useRef(null);
  const [drawerOffset, setDrawerOffset] = useState(0);

  // Scroll-to-top floating button dynamic scroll tracking (matches search widget trailing glide)
  const [showScrollTop, setShowScrollTop] = useState(false);
  const workspaceRef = useRef(null);
  const scrollTopWidgetRef = useRef(null);
  const scrollTopTranslateYRef = useRef(0);

  useEffect(() => {
    let scrollTimeout = null;
    let isScrolling = false;
    let containerDocTop = 0;

    const handleScroll = () => {
      if (!workspaceRef.current || !scrollTopWidgetRef.current) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const maxScrollLimit = document.documentElement.scrollHeight - window.innerHeight;
      const clampedScroll = Math.max(0, Math.min(scrollTop, maxScrollLimit));

      setShowScrollTop(scrollTop > 200);

      if (!isScrolling) {
        isScrolling = true;
        const rect = workspaceRef.current.getBoundingClientRect();
        containerDocTop = rect.top + scrollTop;
      }

      const clampedRectTop = containerDocTop - clampedScroll;

      // Target offset to keep the button ~90px above viewport bottom (in bottom-left placement)
      const targetViewportY = window.innerHeight - 90;
      const targetOffset = targetViewportY - clampedRectTop;

      const widgetHeight = 56;
      const maxScroll = workspaceRef.current.offsetHeight - widgetHeight;
      const dockBottom = (dockContainerRef.current?.offsetHeight || 480) + 16;
      const clampedTranslateY = Math.max(dockBottom, Math.min(targetOffset, maxScroll));

      // Gliding trailing spring animation identical to search button
      scrollTopWidgetRef.current.style.transition = "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
      scrollTopWidgetRef.current.style.transform = `translateY(${clampedTranslateY}px)`;
      scrollTopTranslateYRef.current = clampedTranslateY;

      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      scrollTimeout = setTimeout(() => {
        isScrolling = false;
      }, 150);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    // Initial position calculation
    if (workspaceRef.current && scrollTopWidgetRef.current) {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const maxScrollLimit = document.documentElement.scrollHeight - window.innerHeight;
      const clampedScroll = Math.max(0, Math.min(scrollTop, maxScrollLimit));

      const rect = workspaceRef.current.getBoundingClientRect();
      const docTop = rect.top + scrollTop;
      const clampedRectTop = docTop - clampedScroll;

      const targetViewportY = window.innerHeight - 90;
      const targetOffset = targetViewportY - clampedRectTop;
      const maxScroll = workspaceRef.current.offsetHeight - 56;
      const dockBottom = (dockContainerRef.current?.offsetHeight || 480) + 16;
      const initialY = Math.max(dockBottom, Math.min(targetOffset, maxScroll));

      scrollTopTranslateYRef.current = initialY;
      scrollTopWidgetRef.current.style.transition = "none";
      scrollTopWidgetRef.current.style.transform = `translateY(${initialY}px)`;
      setShowScrollTop(scrollTop > 200);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  const handleScrollToTopKeyDown = useCallback((e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleScrollToTop();
    }
  }, [handleScrollToTop]);

  const projectOptions = useMemo(() => projects
    .filter((p) => p.status !== "completed")
    .map((p) => ({
      value: p.id,
      label: `${p.project_name} ${p.code_name ? `(${p.code_name})` : ""}`,
    })), [projects]);

  const versionOptions = useMemo(() => (versionsCache[projectId] || []).map((v) => {
    const tags = [];
    if (v.published_to_crew) tags.push("Crew");
    if (v.published_to_client) tags.push("Client");
    const tagStr = tags.length > 0 && !isClient ? ` [Published: ${tags.join(" & ")}]` : "";
    return {
      value: String(v.id),
      versionNumber: String(v.version_number),
      label: `Version ${v.version_number}${tagStr}`,
    };
  }), [versionsCache, projectId, isClient]);

  const [selectedCatId, setSelectedCatId] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [autoAlignEnabled, setAutoAlignEnabled] = useState(true);
  const [showPublishModal, setShowPublishModal] = useState(false);

  const [compareProjectId, setCompareProjectId] = useState("");
  const [compareVersionId, setCompareVersionId] = useState("");
  const [comparisonData, setComparisonData] = useState(null);
  const [isCompareLoading, setIsCompareLoading] = useState(false);

  // Active target row ID for vertical drawer tracking
  const activeTargetId = useMemo(() => {
    if (!autoAlignEnabled) return null;
    if (activeDrawer === "item" && selectedCatId) {
      return `cat-section-${selectedCatId}`;
    }
    if (activeDrawer === "category" && selectedDeptId) {
      return `dept-section-${selectedDeptId}`;
    }
    return null;
  }, [autoAlignEnabled, activeDrawer, selectedCatId, selectedDeptId]);

  // Synchronized vertical tracking of flyout drawer with focused budget row
  useEffect(() => {
    if (!activeTargetId) {
      setDrawerOffset(0);
      return;
    }

    const updateOffset = () => {
      const targetEl = document.getElementById(activeTargetId);
      if (!targetEl || !dockContainerRef.current || !drawerRef.current) return;

      const dockRect = dockContainerRef.current.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const drawerHeight = drawerRef.current.offsetHeight || 420;
      const viewportHeight = window.innerHeight;

      // Vertical position relative to the sticky dock top
      const relativeTop = targetRect.top - dockRect.top;
      // Clamp to viewport bounds so drawer never clips or exceeds screen
      const maxOffset = Math.max(0, viewportHeight - dockRect.top - drawerHeight - 24);
      const clamped = Math.max(0, Math.min(relativeTop, maxOffset));

      setDrawerOffset(Math.round(clamped));
    };

    // Calculate once DOM expands and smooth scrolling starts (180ms) and once it settles (550ms)
    const timer1 = setTimeout(updateOffset, 180);
    const timer2 = setTimeout(updateOffset, 550);

    const handleResize = () => updateOffset();
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener("resize", handleResize);
    };
  }, [activeTargetId]);

  // Toggle drawer open/close (opening drawer does not change viewport focus)
  const handleDrawerToggle = useCallback((drawerKey) => {
    setActiveDrawer((prev) => {
      const next = prev === drawerKey ? null : drawerKey;
      if (next === "compare" && !compareProjectId && projectId) {
        setCompareProjectId(String(projectId));
      }
      return next;
    });
  }, [compareProjectId, projectId]);

  // Close drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && activeDrawer) {
        setActiveDrawer(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDrawer]);

  // Click outside drawer to dismiss
  useEffect(() => {
    if (!activeDrawer) return;
    const handleClickOutside = (e) => {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(e.target) &&
        !e.target.closest(".budget-dock") &&
        !e.target.closest(".budget-dock-indicator") &&
        !e.target.closest(".glass-dropdown-menu") &&
        !e.target.closest(".glass-datepicker-positioner") &&
        !e.target.closest(".glass-timepicker-modal") &&
        !e.target.closest(".modal-portal-overlay")
      ) {
        setActiveDrawer(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeDrawer]);

  // Unsaved changes protection state
  const [budgetIsDirty, setBudgetIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNav, setPendingNav] = useState(null); // { type, value }

  const location = useLocation();
  const prevLocationKeyRef = useRef(location.key);

  useEffect(() => {
    if (prevLocationKeyRef.current !== location.key) {
      prevLocationKeyRef.current = location.key;
      if (!budgetIsDirty && !searchParams.get("projectId")) {
        setProjectId("");
        setVersionId("");
        setSelectedCatId("");
        setSelectedDeptId("");
      }
    }
  }, [location.key, budgetIsDirty, searchParams]);

  // Router-level navigation blocker (for Navbar, browser back, links)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      canEditBudget && budgetIsDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  const { showConfirm } = useModal();

  const handleDirtyChange = useCallback((isDirty) => {
    setBudgetIsDirty(isDirty);
  }, []);

  useEffect(() => {
    refreshProjects(true);
    getBudgetMetadata(refreshKey > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const proceedWithProjectChange = useCallback(async (id) => {
    setProjectId(id);
    setVersionId("");
    setSelectedCatId("");
    setSelectedDeptId("");
    setCompareProjectId("");
    setCompareVersionId("");
    setComparisonData(null);
    if (id) {
      const vData = await getBudgetVersions(id, true);
      if (Array.isArray(vData) && vData.length > 0) {
        if (queryVersionId && String(id) === String(queryProjectId)) {
          const matched = vData.find(
            (v) => String(v.id) === String(queryVersionId) || String(v.version_number) === String(queryVersionId)
          );
          if (matched) {
            setVersionId(String(matched.id));
            return;
          }
        }
        setVersionId(String(vData[vData.length - 1].id));
      }
    }
  }, [getBudgetVersions, queryVersionId, queryProjectId]);

  // Whenever projectId is set/changed, ensure versions are loaded
  useEffect(() => {
    if (projectId) {
      getBudgetVersions(projectId, false);
    }
  }, [projectId, getBudgetVersions]);

  // Auto-select project from query param or default for clients
  useEffect(() => {
    if (queryProjectId) {
      const found = projects.find((p) => String(p.id) === String(queryProjectId));
      if (found && String(projectId) !== String(found.id)) {
        proceedWithProjectChange(found.id);
      }
    } else if (isClient && projects.length > 0 && !projectId) {
      proceedWithProjectChange(projects[0].id);
    }
  }, [queryProjectId, projects, isClient, projectId, proceedWithProjectChange]);

  // Auto-select specified version from query param or latest version when project versions load
  useEffect(() => {
    if (projectId && !versionId && versionOptions.length > 0) {
      if (queryVersionId && String(projectId) === String(queryProjectId)) {
        const matched = versionOptions.find(
          (v) => String(v.value) === String(queryVersionId) || String(v.versionNumber) === String(queryVersionId)
        );
        if (matched) {
          setVersionId(matched.value);
          return;
        }
      }
      setVersionId(versionOptions[versionOptions.length - 1].value);
    }
  }, [projectId, versionId, versionOptions, queryVersionId, queryProjectId]);

  // Fetch comparison data when Compare budget changes
  useEffect(() => {
    let isCancelled = false;

    const fetchCompareData = async () => {
      if (!compareProjectId || !compareVersionId) {
        setComparisonData(null);
        return;
      }
      setIsCompareLoading(true);
      try {
        const data = await budgetService.getBudgetFull(compareProjectId, compareVersionId);
        if (isCancelled) return;

        let vAList = versionsCache[projectId];
        if (!vAList || vAList.length === 0) {
          vAList = await getBudgetVersions(projectId, false);
        }

        let vBList = versionsCache[compareProjectId];
        if (!vBList || vBList.length === 0) {
          vBList = await getBudgetVersions(compareProjectId, false);
        }

        const vA = (vAList || []).find((v) => String(v.id) === String(versionId))?.version_number || "1";
        const vB = (vBList || []).find((v) => String(v.id) === String(compareVersionId))?.version_number || "1";

        const projA = projects.find((p) => String(p.id) === String(projectId));
        const projB = projects.find((p) => String(p.id) === String(compareProjectId));

        const isSameProject = String(projectId) === String(compareProjectId);
        const nameA = isSameProject
          ? `V${vA} (Current)`
          : `${projA?.code_name || projA?.project_name || "Proj A"} V${vA}`;
        const nameB = isSameProject
          ? `V${vB}`
          : `${projB?.code_name || projB?.project_name || "Proj B"} V${vB}`;

        setComparisonData({
          budgetB: data?.values || {},
          compareProjectId,
          compareVersionId,
          versionNameA: nameA,
          versionNameB: nameB,
          projectNameA: projA?.project_name || "",
          projectNameB: projB?.project_name || "",
          rawVersionA: vA,
          rawVersionB: vB,
          isSameProject,
        });
      } catch (err) {
        if (!isCancelled) {
          console.error("Failed to fetch compare data:", err);
          setComparisonData(null);
        }
      } finally {
        if (!isCancelled) {
          setIsCompareLoading(false);
        }
      }
    };

    fetchCompareData();

    return () => {
      isCancelled = true;
    };
  }, [compareProjectId, compareVersionId, projectId, versionId, versionsCache, projects, getBudgetVersions]);

  const handleClearCompare = useCallback(() => {
    setCompareProjectId("");
    setCompareVersionId("");
    setComparisonData(null);
  }, []);

  // Browser-level unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (budgetIsDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [budgetIsDirty]);

  const handleProjectChange = async (id) => {
    if (budgetIsDirty) {
      setPendingNav({ type: "project", value: id });
      setShowUnsavedModal(true);
      return;
    }
    proceedWithProjectChange(id);
  };

  const handleVersionChange = (val) => {
    if (budgetIsDirty && String(val) !== String(versionId)) {
      setPendingNav({ type: "version", value: val });
      setShowUnsavedModal(true);
      return;
    }
    setVersionId(val);
    setSelectedCatId("");
    setSelectedDeptId("");
  };

  const handleDiscard = () => {
    setBudgetIsDirty(false);
    setShowUnsavedModal(false);

    // If blocked by router
    if (blocker.state === "blocked") {
      blocker.proceed();
      return;
    }

    // If blocked by internal project/version switch
    if (!pendingNav) return;
    if (pendingNav.type === "project") {
      proceedWithProjectChange(pendingNav.value);
    } else if (pendingNav.type === "version") {
      setVersionId(pendingNav.value);
    }
    setPendingNav(null);
  };

  const handleStayAndSave = () => {
    setShowUnsavedModal(false);
    setPendingNav(null);

    // If blocked by router, reset it
    if (blocker.state === "blocked") {
      blocker.reset();
    }

    // Execute save directly via budgetActions
    if (budgetActions?.submitAll) {
      budgetActions.submitAll();
    }
  };

  const handleCreateNewVersion = async () => {
    if (!projectId) return;

    if (budgetIsDirty) {
      const ok = await showConfirm(
        "You have unsaved changes. These will not be included in the new cloned version unless you save first. Proceed anyway?",
      );
      if (!ok) return;
    }

    const isInitial = !versionId;
    const ok = await showConfirm(
      isInitial
        ? "Create initial budget version (Version 1) for this project?"
        : "Do you want to clone the current budget version?",
    );
    if (!ok) return;

    try {
      const data = await budgetService.cloneBudgetVersion(projectId, versionId || null);

      if (data && !data.error) {
        const vData = await getBudgetVersions(projectId, true);
        if (data.id) {
          setVersionId(String(data.id));
        } else if (Array.isArray(vData) && vData.length > 0) {
          setVersionId(String(vData[vData.length - 1].id));
        }
        alert(isInitial ? "Initial budget version created successfully." : "Version cloned successfully.");
      } else {
        alert(`Failed to create version: ${data?.error || "Unknown error"}`);
      }
    } catch (err) {
      alert("Error creating version.");
    }
  };

  const handleOpenPublishModal = useCallback(() => {
    if (!versionId) return;
    setShowPublishModal(true);
  }, [versionId]);

  const handleDataAdded = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleDeleteVersion = async () => {
    if (!versionId) return;

    const confirmed = await showConfirm(
      "Are you sure you want to delete this budget version? This action cannot be undone.",
    );

    if (confirmed) {
      try {
        const data = await budgetService.deleteBudgetVersion(versionId);
        if (data && data.error) {
          throw new Error(data.error || "Failed to delete version");
        }
        setVersionId("");
        // Force refresh versions list in context
        await getBudgetVersions(projectId, true);
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    }
  };

  // ── Memoized Spring-Physics Dock Items (Matches Payment Confirmation Modal) ──
  // All items remain permanently visible on the dock for balanced macOS dock aesthetic
  const dockItems = useMemo(() => {
    const hasVersion = Boolean(projectId && versionId);
    const isReady = Boolean(budgetActions?.isReady);

    const items = [
      // 1. Project & Version Selector (Option B)
      {
        id: "project",
        icon: <Icon name="account_tree" modifiers="sm" />,
        label: isClient ? "Project & Version" : "Select Project & Version",
        active: activeDrawer === "project",
        onClick: () => handleDrawerToggle("project"),
      },
    ];

    // 2. Hierarchy CRUD (Department, Category, Budget Item)
    if (canEditBudget) {
      items.push(
        {
          id: "department",
          icon: <Icon name="corporate_fare" modifiers="sm" />,
          label: hasVersion ? "Add Department" : "Add Department (Select Version First)",
          active: activeDrawer === "department",
          onClick: () => handleDrawerToggle("department"),
        },
        {
          id: "category",
          icon: <Icon name="label" modifiers="sm" />,
          label: hasVersion ? "Add Category" : "Add Category (Select Version First)",
          active: activeDrawer === "category",
          onClick: () => handleDrawerToggle("category"),
        },
        {
          id: "item",
          icon: <Icon name="post_add" modifiers="sm" />,
          label: hasVersion ? "Add Budget Item" : "Add Budget Item (Select Version First)",
          active: activeDrawer === "item",
          onClick: () => handleDrawerToggle("item"),
        }
      );
    }

    // 3. Compare Budgets (if not client)
    if (!isClient) {
      items.push({
        id: "compare",
        icon: <Icon name="compare_arrows" modifiers="sm" />,
        label: compareProjectId && compareVersionId
          ? "Comparing Versions"
          : hasVersion
            ? "Compare Budgets"
            : "Compare Budgets (Select Version First)",
        active: activeDrawer === "compare" || Boolean(compareProjectId && compareVersionId),
        onClick: () => handleDrawerToggle("compare"),
      });
    }

    // Separator between tools and export actions
    items.push({ separator: true });

    // 4. Export Actions
    items.push(
      {
        id: "export-topsheet",
        icon: <Icon name="summarize" modifiers="sm" />,
        label: isReady ? "Export Top-Sheet PDF" : "Top-Sheet PDF (Load Budget First)",
        disabled: !isReady,
        onClick: () => budgetActions?.exportTopSheet?.(),
      },
      {
        id: "export-pdf",
        icon: <Icon name="picture_as_pdf" modifiers="sm" />,
        label: isReady ? "Export Detail PDF" : "Detail PDF (Load Budget First)",
        disabled: !isReady,
        onClick: () => budgetActions?.exportDetailPDF?.(),
      },
      {
        id: "export-excel",
        icon: <Icon name="table_view" modifiers="sm" />,
        label: isReady ? "Export Detail Excel" : "Detail Excel (Load Budget First)",
        disabled: !isReady,
        onClick: () => budgetActions?.exportDetailExcel?.(),
      }
    );

    // 5. Publish Action (if authorized)
    if (canPublishBudget) {
      items.push({
        id: "publish",
        icon: <Icon name="publish" modifiers="sm" />,
        label: hasVersion ? "Publish Budget" : "Publish Budget (Select Version First)",
        disabled: !hasVersion,
        onClick: handleOpenPublishModal,
      });
    }

    // 6. Save & Clear Actions (if editing allowed)
    if (canEditBudget) {
      items.push({ separator: true });

      items.push(
        {
          id: "clear",
          icon: <Icon name="clear_all" modifiers="sm" />,
          label: isReady ? "Clear All Entries" : "Clear All (Load Budget First)",
          disabled: !isReady || budgetActions?.submitting,
          onClick: () => budgetActions?.clearAll?.(),
        },
        {
          id: "save",
          icon: (
            <Icon
              name={budgetActions?.submitting ? "sync" : "save"}
              modifiers={`sm ${budgetActions?.submitting ? "spin" : ""}`}
            />
          ),
          label: budgetActions?.submitting
            ? "Saving Changes…"
            : isReady
              ? "Submit All / Save"
              : "Save Budget (Load Budget First)",
          disabled: !isReady || budgetActions?.submitting,
          onClick: () => budgetActions?.submitAll?.(),
        }
      );
    }

    // Separator before Pin toggle
    items.push({ separator: true });

    // 7. Dock Pin / Auto-Hide Toggle (Pinned by default per requirements)
    items.push({
      id: "pin",
      icon: (
        <Icon
          name={autoHide ? "push_pin" : "keep"}
          modifiers={`sm ${!autoHide ? "filled" : ""}`}
        />
      ),
      label: autoHide
        ? "Auto-Hide: ON (Click to Pin)"
        : "Dock Pinned (Click to Auto-Hide)",
      active: !autoHide,
      className: `dock-toggle-item ${!autoHide ? "is-pinned" : ""}`,
      onClick: () => setAutoHide((prev) => !prev),
    });

    return items;
  }, [
    isClient,
    activeDrawer,
    handleDrawerToggle,
    canEditBudget,
    projectId,
    versionId,
    compareProjectId,
    compareVersionId,
    budgetActions,
    canPublishBudget,
    handleOpenPublishModal,
    autoHide,
  ]);

  // Drawer Title & Subtitle helper functions
  const getDrawerTitle = (key) => {
    switch (key) {
      case "project": return isClient ? "Project & Version" : "Select Project & Version";
      case "department": return "Add Department";
      case "category": return "Add Category";
      case "item": return "Add Budget Item";
      case "compare": return "Compare Budgets";
      default: return "";
    }
  };

  const getDrawerSubtitle = (key) => {
    switch (key) {
      case "project": return "Switch active production project and budget revisions";
      case "department": return "Create a new department within a production phase";
      case "category": return "Create a category under a designated department";
      case "item": return "Add a line item to calculate in the budget sheet";
      case "compare": return "Compare variance against an alternate version";
      default: return "";
    }
  };

  return (
    <PageContainer id="admin-budget">
      <PageHeader
        category={isClient ? "Client Portal" : "Production Budget"}
        title={isClient ? "Project Budget" : "Entry"}
        description={
          isClient
            ? "View published production budget breakdowns for your assigned projects"
            : "Enhanced view for managing hierarchy and budget entry"
        }
      />

      {/* ── Outer Budget Workspace: Detached Dock + Main Card ── */}
      <div
        ref={workspaceRef}
        className={`admin-budget-workspace ${!autoHide ? "is-dock-pinned" : ""} ${activeDrawer ? "has-active-drawer" : ""}`}
      >
        {/* ── Detached Spring-Physics Budget Dock Container (Floating Outside Card) ── */}
        <div className="budget-dock-container" ref={dockContainerRef}>
          <Dock
            items={dockItems}
            position="left"
            autoHide={autoHide}
            autoFit={false}
            baseItemSize={45}
            magnification={60}
            panelHeight={70}
            distance={190}
            gap={10}
            roundness={0.5}
            spring="smooth"
            bounce={false}
            tiles={true}
            showLabels={true}
            showIndicators={false}
            showBadges={false}
            accentColor="#00c6e6"
            className="budget-dock"
          />

          {/* Navigation Edge Indicator (Visible when dock is auto-hidden) */}
          <button
            type="button"
            className="budget-dock-indicator"
            onClick={() => setAutoHide(false)}
            title="Budget Actions (Hover to reveal, Click to pin)"
            aria-label="Reveal Budget Actions Dock"
          >
            <span className="indicator-handle">
              <span className="indicator-dot" />
              <Icon name="chevron_left" modifiers="xs" className="indicator-chevron" />
            </span>
          </button>

          {/* ── Flyout Drawer for Active Section ── */}
          {activeDrawer && (
            <div
              ref={drawerRef}
              className="budget-flyout-drawer open"
              style={{ "--drawer-y": `${drawerOffset}px` }}
              role="dialog"
              aria-modal="false"
              aria-label={getDrawerTitle(activeDrawer)}
            >
              <div className="budget-drawer-header">
                <div className="budget-drawer-title-group">
                  <div className="budget-drawer-title-text">
                    <h3 className="budget-drawer-title">{getDrawerTitle(activeDrawer)}</h3>
                    <p className="budget-drawer-subtitle">{getDrawerSubtitle(activeDrawer)}</p>
                  </div>
                </div>
                <div className="budget-drawer-header-actions">
                  {(activeDrawer === "item" || activeDrawer === "category") && versionId && (
                    <WidgetOptionsMenu
                      autoAlignEnabled={autoAlignEnabled}
                      onToggleAutoAlign={setAutoAlignEnabled}
                    />
                  )}
                  <button
                    type="button"
                    className="budget-drawer-close-btn"
                    onClick={() => setActiveDrawer(null)}
                    aria-label="Close panel"
                  >
                    <Icon name="close" modifiers="sm" />
                  </button>
                </div>
              </div>

              <div className="budget-drawer-body">
                {activeDrawer === "project" && (
                  <ProjectVersionWidget
                    isClient={isClient}
                    canEditBudget={canEditBudget}
                    projectId={projectId}
                    versionId={versionId}
                    projectOptions={projectOptions}
                    versionOptions={versionOptions}
                    onProjectChange={handleProjectChange}
                    onVersionChange={handleVersionChange}
                    onDeleteVersion={handleDeleteVersion}
                    onCreateNewVersion={handleCreateNewVersion}
                  />
                )}

                {activeDrawer === "department" && (
                  versionId ? (
                    <AddDepartment
                      phases={phasesCache || []}
                      onAdded={handleDataAdded}
                      inDrawer={true}
                    />
                  ) : (
                    <div className="budget-drawer-notice">
                      <Icon name="info" modifiers="sm" />
                      <div className="budget-drawer-notice-content">
                        <p>Please select an active project and budget version before adding departments.</p>
                        <NeoButton
                          type="button"
                          variant="neutral"
                          className="budget-drawer-notice-btn"
                          icon="account_tree"
                          onClick={() => setActiveDrawer("project")}
                        >
                          Choose Project & Version
                        </NeoButton>
                      </div>
                    </div>
                  )
                )}

                {activeDrawer === "category" && (
                  versionId ? (
                    <AddCategory
                      departments={sortedDepts}
                      onAdded={handleDataAdded}
                      onDeptSelect={setSelectedDeptId}
                      inDrawer={true}
                    />
                  ) : (
                    <div className="budget-drawer-notice">
                      <Icon name="info" modifiers="sm" />
                      <div className="budget-drawer-notice-content">
                        <p>Please select an active project and budget version before adding categories.</p>
                        <NeoButton
                          type="button"
                          variant="neutral"
                          className="budget-drawer-notice-btn"
                          icon="account_tree"
                          onClick={() => setActiveDrawer("project")}
                        >
                          Choose Project & Version
                        </NeoButton>
                      </div>
                    </div>
                  )
                )}

                {activeDrawer === "item" && (
                  versionId ? (
                    <AddBudgetItem
                      categories={sortedCats}
                      onAdded={handleDataAdded}
                      onCategorySelect={setSelectedCatId}
                      inDrawer={true}
                    />
                  ) : (
                    <div className="budget-drawer-notice">
                      <Icon name="info" modifiers="sm" />
                      <div className="budget-drawer-notice-content">
                        <p>Please select an active project and budget version before adding budget items.</p>
                        <NeoButton
                          type="button"
                          variant="neutral"
                          className="budget-drawer-notice-btn"
                          icon="account_tree"
                          onClick={() => setActiveDrawer("project")}
                        >
                          Choose Project & Version
                        </NeoButton>
                      </div>
                    </div>
                  )
                )}

                {activeDrawer === "compare" && (
                  versionId ? (
                    <CompareBudgetWidget
                      projects={projects}
                      currentProjectId={projectId}
                      currentVersionId={versionId}
                      compareProjectId={compareProjectId}
                      setCompareProjectId={setCompareProjectId}
                      compareVersionId={compareVersionId}
                      setCompareVersionId={setCompareVersionId}
                      onClearCompare={handleClearCompare}
                      inDrawer={true}
                    />
                  ) : (
                    <div className="budget-drawer-notice">
                      <Icon name="info" modifiers="sm" />
                      <div className="budget-drawer-notice-content">
                        <p>Please select an active project and budget version before comparing budgets.</p>
                        <NeoButton
                          type="button"
                          variant="neutral"
                          className="budget-drawer-notice-btn"
                          icon="account_tree"
                          onClick={() => setActiveDrawer("project")}
                        >
                          Choose Project & Version
                        </NeoButton>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Scroll-to-Top Floating Glass Button (Glides with scroll in dock column) ── */}
        <div
          ref={scrollTopWidgetRef}
          className={`budget-scroll-top-widget ${showScrollTop ? "visible" : ""}`}
        >
          <div className="budget-scroll-top-inner">
            <GlassSurface
              className="budget-scroll-top-btn"
              onClick={handleScrollToTop}
              onKeyDown={handleScrollToTopKeyDown}
              width={48}
              height={48}
              borderRadius={24}
              blur={10}
              opacity={0}
              backgroundOpacity={0}
              role="button"
              tabIndex={0}
              aria-label="Scroll to top of budget"
            >
              <Icon name="arrow_upward" modifiers="sm" />
            </GlassSurface>
            <div className="budget-scroll-top-tooltip" role="tooltip">
              Back to top
            </div>
          </div>
        </div>

        {/* ── Main Budget Content Card (Single Elevated Glass Surface) ── */}
        <PageContentCard className="budget-main-card">
          <BudgetEntryForm
            embedded={true}
            externalProjectId={projectId}
            versionId={versionId}
            projectName={
              projects.find((p) => p.id === projectId)?.project_name || ""
            }
            versionName={
              (versionsCache[projectId] || []).find(
                (v) => String(v.id) === String(versionId),
              )?.version_number || ""
            }
            refreshKey={refreshKey}
            onDirtyChange={handleDirtyChange}
            selectedCatId={autoAlignEnabled ? selectedCatId : ""}
            selectedDeptId={autoAlignEnabled ? selectedDeptId : ""}
            onPublish={canPublishBudget ? handleOpenPublishModal : undefined}
            onActionsReady={setBudgetActions}
            hideActionsFooter={true}
            comparisonData={comparisonData}
            isCompareLoading={isCompareLoading}
            onClearCompare={handleClearCompare}
            canEdit={canEditBudget}
          />
        </PageContentCard>
      </div>

      <ConfirmationModal
        isOpen={showUnsavedModal || blocker.state === "blocked"}
        title="Unsaved Changes"
        message="You have unsaved modifications in your budget. If you leave now, these changes will be permanently lost."
        onConfirm={handleStayAndSave}
        onCancel={handleDiscard}
        confirmLabel="Save Changes"
        cancelLabel="Discard & Leave"
        confirmVariant="accent"
        cancelVariant="danger"
      />

      <PublishBudgetModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        projectId={projectId}
        versionsCache={versionsCache}
        initialVersionId={versionId}
        onSuccess={() => getBudgetVersions(projectId, true)}
      />
    </PageContainer>
  );
};

export default AdminBudget;
