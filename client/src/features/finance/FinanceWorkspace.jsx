import React, { Suspense, lazy, useMemo, useState } from "react";
import {
  PageContainer,
  PageContentCard,
} from "../../components/common/PageContainer";
import PageHeader from "../../components/common/PageHeader";
import Icon from "../../components/common/Icon";
import NeoButton from "../../components/common/NeoButton";
import ViewToggle from "../../components/common/ViewToggle";
import GlassDatePicker from "../../components/common/GlassDatePicker";
import HoverTooltip from "../../components/common/HoverTooltip";
import { sanitizeRealtime } from "../../utils/sanitizer";
import { FinanceProvider, useFinance } from "./context/FinanceContext";
import OverviewBento from "./components/OverviewBento";
import FinanceSkeleton from "./components/FinanceSkeleton";
import TransactionModal from "./components/TransactionModal";
import "./FinanceWorkspace.css";

// Trick #5: Lazy-load non-Overview sub-workspaces cleanly into split chunks
const FinanceLazySection = lazy(() => import("./components/FinanceLazySection"));

const SECTION_DESCRIPTIONS = {
  overview:
    "Project, company, and personal finances with real-time double-entry telemetry.",
  projects:
    "Per-project revenue, direct cost execution, quotes, and net margin health.",
  company:
    "Studio overhead, entity cashflows, capital injections, and operating burn.",
  personal:
    "Private owner capital, drawings, reimbursements, and personal balances.",
  ledger:
    "General ledger vouchers separated across income, expenses, drawings, and capital.",
  debtors:
    "Open client receivables, vendor payables, and one-click partial settlements.",
  reports:
    "Executive Profit & Loss, Trial Balance, Balance Sheet, and print-ready statements.",
  accounts:
    "Hierarchical Chart of Accounts managing assets, liabilities, equity, and P&L buckets.",
  periods:
    "Fiscal period controls for posting windows, month-end close, and audit safety.",
};

const FinanceWorkspaceInner = () => {
  const {
    permissions,
    availableSections,
    activeSection,
    setActiveSection,
    scope,
    setScope,
    dateRange,
    setDateRange,
    clearDateRange,
    searchQuery,
    setSearchQuery,
    workspaceData,
    loadingInit,
    revalidating,
    initError,
    refreshWorkspace,
    openRecordModal,
    recordModalRequest,
    closeRecordModal,
  } = useFinance();

  const [railCollapsed, setRailCollapsed] = useState(false);

  const entity = workspaceData?.taxonomy?.entity || {
    name: "Vision Division Studio",
    code: "VD-STUDIO",
    base_currency: "LKR",
  };
  const periods = workspaceData?.taxonomy?.fiscal_periods || [];
  const activePeriod = periods.find((p) => p.status === "open") || periods[0];

  const currentSectionDef = useMemo(
    () => availableSections.find((s) => s.id === activeSection) || availableSections[0],
    [availableSections, activeSection]
  );

  const scopeOptions = useMemo(() => {
    if (!permissions.canViewPersonal) {
      return [
        {
          value: "project",
          label: "Projects",
          icon: "movie_edit",
          showLabel: true,
        },
      ];
    }
    return [
      { value: "all", label: "All Scope", icon: "apps", showLabel: true },
      { value: "project", label: "Projects", icon: "movie_edit", showLabel: true },
      { value: "company", label: "Company", icon: "apartment", showLabel: true },
      { value: "personal", label: "Personal", icon: "person_book", showLabel: true },
    ];
  }, [permissions.canViewPersonal]);

  const coreSections = availableSections.filter((s) => s.group === "core");
  const adminSections = availableSections.filter((s) => s.group === "admin");

  const headerTitle =
    activeSection === "overview"
      ? "Dashboard"
      : currentSectionDef?.label || "Dashboard";
  const headerDescription =
    SECTION_DESCRIPTIONS[activeSection] ||
    "Project, company, and personal finances with real-time double-entry telemetry.";

  return (
    <PageContainer id="finance-workspace">
      <PageHeader
        category="Finance & Accounting"
        title={headerTitle}
        description={headerDescription}
      >
        <div className="fin-header-actions">
          <span
            className={`fin-sync-pill ${
              revalidating ? "is-revalidating" : ""
            }`}
          >
            <Icon name={revalidating ? "sync" : "verified"} modifiers="sm" />
            <span>{revalidating ? "Syncing..." : "Double-Entry Live"}</span>
          </span>

          <button
            type="button"
            className="fin-refresh-icon-btn"
            aria-label="Refresh financial workspace"
            title="Force refresh telemetry and ledger data"
            onClick={refreshWorkspace}
          >
            <Icon name="refresh" modifiers="sm" />
          </button>

          {permissions.canEdit && (
            <NeoButton
              variant="solid"
              icon="add"
              onClick={() =>
                openRecordModal({
                  doc_type: "expense",
                  scope: scope === "company" ? "company" : "project",
                })
              }
            >
              Record Entry
            </NeoButton>
          )}
        </div>
      </PageHeader>

      <PageContentCard className="fin-shell-card">
        <div
          className={`fin-workspace-layout ${
            railCollapsed ? "is-rail-collapsed" : ""
          }`}
        >
          {/* Left Navigation Rail (Reference Image 1 Composition) */}
          <aside className="fin-rail" aria-label="Finance workspace sections">
            <div className="fin-rail-brand-row">
              <div className="fin-rail-brand">
                <span className="fin-rail-emblem">
                  <Icon name="account_balance" modifiers="sm" />
                </span>
                <div className="fin-rail-brand-copy">
                  <span className="fin-rail-brand-name">Finance Studio</span>
                  <span className="fin-rail-brand-code">
                    {entity.code} · {entity.base_currency}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="fin-rail-collapse-btn"
                onClick={() => setRailCollapsed((c) => !c)}
                aria-label={railCollapsed ? "Expand rail" : "Collapse rail"}
                title={railCollapsed ? "Expand rail" : "Collapse rail"}
              >
                <Icon
                  name={railCollapsed ? "dock_to_left" : "dock_to_right"}
                  modifiers="sm"
                />
              </button>
            </div>

            <nav className="fin-rail-nav">
              {coreSections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`fin-rail-item ${
                    activeSection === item.id ? "is-active" : ""
                  }`}
                  onClick={() => setActiveSection(item.id)}
                  title={item.label}
                >
                  <Icon name={item.icon} modifiers="sm" />
                  <span className="fin-rail-item-label">{item.label}</span>
                </button>
              ))}

              <div className="fin-rail-divider" role="separator" />

              {adminSections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`fin-rail-item ${
                    activeSection === item.id ? "is-active" : ""
                  }`}
                  onClick={() => setActiveSection(item.id)}
                  title={item.label}
                >
                  <Icon name={item.icon} modifiers="sm" />
                  <span className="fin-rail-item-label">{item.label}</span>
                </button>
              ))}
            </nav>

            {activePeriod && (
              <div className="fin-rail-footer">
                <span className="fin-rail-period-label">Active Fiscal Period</span>
                <span className="fin-rail-period-val">
                  <span>{activePeriod.period_code}</span>
                  <span
                    className="fin-status-dot"
                    title={`Status: ${activePeriod.status}`}
                  />
                </span>
              </div>
            )}
          </aside>

          {/* Right Main Workspace */}
          <main className="fin-main-pane">
            {/* Top Scope Switcher (ViewToggle), Fiscal Date Range & Quick Search */}
            <div className="fin-control-bar">
              <ViewToggle
                className="fin-scope-view-toggle"
                ariaLabel="Finance accounting scope"
                size="sm"
                options={scopeOptions}
                value={scope}
                onChange={setScope}
              />

              <div className="fin-control-right">
                <HoverTooltip
                  title="Fiscal Date Filter"
                  description="Filter monthly P&L telemetry and pre-fill Ledger & Report exports."
                >
                  <div
                    className={`fin-date-range-pill ${
                      dateRange.from || dateRange.to ? "is-filtered" : ""
                    }`}
                    role="group"
                    aria-label="Fiscal date range filter"
                  >
                    <div className="fin-date-start">
                      <GlassDatePicker
                        value={dateRange.from}
                        onChange={(val) =>
                          setDateRange((prev) => ({ ...prev, from: val }))
                        }
                        placeholder="From date"
                        className="fin-date-picker-input"
                      />
                    </div>
                    <span className="fin-date-sep" aria-hidden="true">
                      –
                    </span>
                    <div className="fin-date-end">
                      <GlassDatePicker
                        value={dateRange.to}
                        onChange={(val) =>
                          setDateRange((prev) => ({ ...prev, to: val }))
                        }
                        placeholder="To date"
                        className="fin-date-picker-input"
                      />
                    </div>
                    {(dateRange.from || dateRange.to) && (
                      <button
                        type="button"
                        className="fin-date-clear-btn"
                        aria-label="Clear date range"
                        onClick={clearDateRange}
                      >
                        <Icon name="close" modifiers="sm" />
                      </button>
                    )}
                  </div>
                </HoverTooltip>

                <div className="fin-search-box">
                  <Icon name="search" modifiers="sm" className="fin-search-icon" />
                  <input
                    type="text"
                    className="fin-search-input"
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(sanitizeRealtime(e.target.value, "text"))
                    }
                    placeholder="Search projects, debtors, creditors..."
                    aria-label="Search finance records"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="fin-search-clear"
                      aria-label="Clear search"
                      onClick={() => setSearchQuery("")}
                    >
                      <Icon name="close" modifiers="sm" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {loadingInit && !workspaceData ? (
              <FinanceSkeleton variant="overview" />
            ) : initError && !workspaceData ? (
              <div className="fin-error-state" role="alert">
                <span>{initError}</span>
                <NeoButton variant="solid" icon="refresh" onClick={refreshWorkspace}>
                  Retry Sync
                </NeoButton>
              </div>
            ) : activeSection === "overview" ? (
              <OverviewBento />
            ) : (
              <Suspense fallback={<FinanceSkeleton variant="subview" />}>
                <FinanceLazySection sectionKey={activeSection} />
              </Suspense>
            )}
          </main>
        </div>
      </PageContentCard>

      {/* Transaction Entry Modal */}
      {recordModalRequest && (
        <TransactionModal
          isOpen={Boolean(recordModalRequest)}
          initialPreset={recordModalRequest || {}}
          onClose={closeRecordModal}
          onSuccess={refreshWorkspace}
        />
      )}
    </PageContainer>
  );
};

const FinanceWorkspace = () => (
  <FinanceProvider>
    <FinanceWorkspaceInner />
  </FinanceProvider>
);

export default FinanceWorkspace;

