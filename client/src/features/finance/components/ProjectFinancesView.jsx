import React, { useState, useMemo, useEffect } from "react";
import Icon from "../../../components/common/Icon";
import NeoButton from "../../../components/common/NeoButton";
import { formatCurrency } from "../../../utils/currencyUtils";
import { sanitizeRealtime } from "../../../utils/sanitizer";
import { useFinance } from "../context/FinanceContext";
import ProjectLedgerDrawer from "./ProjectLedgerDrawer";
import FinanceSkeleton from "./FinanceSkeleton";
import "./ProjectFinancesView.css";

const STATUS_FILTERS = [
  { id: "all", label: "All Projects" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "on_hold", label: "On Hold" },
];

const ProjectFinancesView = () => {
  const {
    sectionPayloads,
    sectionLoading,
    sectionErrors,
    loadSectionData,
    openRecordModal,
  } = useFinance();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const rawProjects = useMemo(() => {
    return sectionPayloads?.projects?.projects || [];
  }, [sectionPayloads?.projects]);

  const isLoading = Boolean(sectionLoading?.projects);
  const error = sectionErrors?.projects;

  useEffect(() => {
    if (!sectionPayloads?.projects) {
      loadSectionData("projects");
    }
  }, [sectionPayloads?.projects, loadSectionData]);

  // Aggregate KPI summary
  const summary = useMemo(() => {
    let totalQuoted = 0;
    let totalBudgeted = 0;
    let totalActualExp = 0;
    let totalPaid = 0;
    let totalNetMargin = 0;

    rawProjects.forEach((p) => {
      totalQuoted += Number(p.quoted_client_total || 0);
      totalBudgeted += Number(p.budgeted_direct_cost || 0);
      totalActualExp += Number(p.actual_expense || 0);
      totalPaid += Number(p.payments_received || 0);
      totalNetMargin += Number(p.actual_net_margin || 0);
    });

    const marginPct =
      totalQuoted > 0 ? Math.round((totalNetMargin / totalQuoted) * 100) : 0;
    const collectionPct =
      totalQuoted > 0 ? Math.round((totalPaid / totalQuoted) * 100) : 0;

    return {
      count: rawProjects.length,
      totalQuoted,
      totalBudgeted,
      totalActualExp,
      totalPaid,
      totalNetMargin,
      marginPct,
      collectionPct,
    };
  }, [rawProjects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawProjects.filter((p) => {
      if (statusFilter !== "all" && (p.status || "").toLowerCase() !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const name = (p.project_name || "").toLowerCase();
      const code = (p.code_name || "").toLowerCase();
      const client = (p.client_name || "").toLowerCase();
      return name.includes(q) || code.includes(q) || client.includes(q);
    });
  }, [rawProjects, search, statusFilter]);

  if (isLoading && rawProjects.length === 0) {
    return <FinanceSkeleton variant="subview" />;
  }

  return (
    <div className="fin-proj-view" data-testid="project-finances-view">
      {/* Top Header Card */}
      <div className="fin-proj-head-card">
        <div className="fin-proj-header-info">
          <span className="fin-proj-eyebrow">Project Portfolios & Direct Cost Control</span>
          <h2 className="fin-proj-title">Project Financial Scorecards</h2>
          <p className="fin-proj-desc">
            Monitor client quotes, departmental budget execution, real-time expenses, and realized margins.
          </p>
        </div>

        <div className="fin-proj-header-actions">
          <NeoButton
            variant="secondary"
            icon="refresh"
            loading={isLoading}
            onClick={() => loadSectionData("projects", {}, { force: true })}
          >
            Refresh
          </NeoButton>
          <NeoButton
            variant="solid"
            icon="add"
            onClick={() => openRecordModal({ doc_type: "expense", scope: "project" })}
          >
            + Record Project Expense
          </NeoButton>
        </div>
      </div>

      {error && (
        <div className="fin-proj-error-banner" role="alert">
          <Icon name="error" modifiers="sm" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Summary Tiles */}
      <div className="fin-proj-kpi-grid">
        <div className="fin-proj-kpi-tile">
          <span className="fin-proj-kpi-label">Tracked Projects</span>
          <span className="fin-proj-kpi-val">{summary.count}</span>
          <span className="fin-proj-kpi-sub">Across all active & historic production</span>
        </div>

        <div className="fin-proj-kpi-tile">
          <span className="fin-proj-kpi-label">Quoted Baseline</span>
          <span className="fin-proj-kpi-val">{formatCurrency(summary.totalQuoted)}</span>
          <span className="fin-proj-kpi-sub">Contractual customer quotes</span>
        </div>

        <div className="fin-proj-kpi-tile">
          <span className="fin-proj-kpi-label">Budgeted Direct Cost</span>
          <span className="fin-proj-kpi-val">{formatCurrency(summary.totalBudgeted)}</span>
          <span className="fin-proj-kpi-sub">Approved baseline allocations</span>
        </div>

        <div className="fin-proj-kpi-tile">
          <span className="fin-proj-kpi-label">Actual Direct Expense</span>
          <span className="fin-proj-kpi-val">{formatCurrency(summary.totalActualExp)}</span>
          <span className="fin-proj-kpi-sub">Incurred & posted vouchers</span>
        </div>

        <div className="fin-proj-kpi-tile highlight">
          <span className="fin-proj-kpi-label">Net Realized Margin</span>
          <span className="fin-proj-kpi-val">{formatCurrency(summary.totalNetMargin)}</span>
          <span className="fin-proj-kpi-sub">{summary.marginPct}% overall profit health</span>
        </div>

        <div className="fin-proj-kpi-tile">
          <span className="fin-proj-kpi-label">Payments Collected</span>
          <span className="fin-proj-kpi-val">{formatCurrency(summary.totalPaid)}</span>
          <span className="fin-proj-kpi-sub">{summary.collectionPct}% collection rate</span>
        </div>
      </div>

      {/* Controls Bar: Filter tabs & Search */}
      <div className="fin-proj-controls-bar">
        <div className="fin-proj-tabs" role="tablist" aria-label="Project Status Tabs">
          {STATUS_FILTERS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.id}
              className={`fin-proj-tab ${statusFilter === tab.id ? "active" : ""}`}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="fin-proj-search-wrapper">
          <Icon name="search" modifiers="sm" />
          <input
            type="text"
            className="fin-proj-search-input"
            placeholder="Search projects, code, or client..."
            value={search}
            onChange={(e) => setSearch(sanitizeRealtime(e.target.value))}
          />
          {search && (
            <button
              type="button"
              className="fin-proj-search-clear"
              aria-label="Clear project search"
              onClick={() => setSearch("")}
            >
              <Icon name="close" modifiers="sm" />
            </button>
          )}
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="fin-proj-empty">
          <Icon name="movie_edit" modifiers="lg" />
          <p className="fin-proj-empty-title">No projects match the selected criteria.</p>
          <p className="fin-proj-empty-desc">
            Try adjusting your search query or status filter to see other financial scorecards.
          </p>
        </div>
      ) : (
        <div className="fin-proj-grid">
          {filteredProjects.map((p) => {
            const quoted = Number(p.quoted_client_total || 0);
            const budgeted = Number(p.budgeted_direct_cost || 0);
            const actual = Number(p.actual_expense || 0);
            const margin = Number(p.actual_net_margin || 0);
            const paid = Number(p.payments_received || 0);
            const variance = Number(p.budget_variance || 0);

            const marginPct = quoted > 0 ? Math.round((margin / quoted) * 100) : 0;
            const collectionPct = quoted > 0 ? Math.round((paid / quoted) * 100) : 0;
            const costPct = quoted > 0 ? Math.min(100, Math.round((actual / quoted) * 100)) : 0;

            const isVariancePositive = variance >= 0;

            return (
              <div key={p.id} className="fin-proj-card" data-testid={`project-card-${p.id}`}>
                <div className="fin-proj-card-head">
                  <div className="fin-proj-card-title-group">
                    <span className="fin-proj-card-code">{p.code_name || "PROJ"}</span>
                    <h3 className="fin-proj-card-name">{p.project_name}</h3>
                    <span className="fin-proj-card-client">Client: {p.client_name || "Standard Client"}</span>
                  </div>
                  <span className={`fin-proj-card-status status-${(p.status || "active").toLowerCase()}`}>
                    {p.status || "active"}
                  </span>
                </div>

                <div className="fin-proj-card-stats">
                  <div className="fin-proj-stat-cell">
                    <span className="fin-stat-label">Quoted Contract</span>
                    <span className="fin-stat-val bold">{formatCurrency(quoted)}</span>
                  </div>
                  <div className="fin-proj-stat-cell">
                    <span className="fin-stat-label">Direct Expenses</span>
                    <span className="fin-stat-val">{formatCurrency(actual)}</span>
                    <span className="fin-stat-sub">of {formatCurrency(budgeted)} budget</span>
                  </div>
                  <div className="fin-proj-stat-cell">
                    <span className="fin-stat-label">Budget Variance</span>
                    <span className={`fin-stat-val ${isVariancePositive ? "positive" : "negative"}`}>
                      {isVariancePositive ? "+" : ""}
                      {formatCurrency(variance)}
                    </span>
                    <span className="fin-stat-sub">
                      {isVariancePositive ? "Under budget" : "Over budget"}
                    </span>
                  </div>
                  <div className="fin-proj-stat-cell">
                    <span className="fin-stat-label">Realized Margin</span>
                    <span className={`fin-stat-val bold ${margin >= 0 ? "positive" : "negative"}`}>
                      {formatCurrency(margin)}
                    </span>
                    <span className="fin-stat-sub">{marginPct}% profit margin</span>
                  </div>
                </div>

                {/* Progress bar showing expense vs quote */}
                <div className="fin-proj-progress-wrapper">
                  <div className="fin-proj-progress-labels">
                    <span>Direct Cost Consumption</span>
                    <span>{costPct}% of Quote</span>
                  </div>
                  <div className="fin-proj-progress-track">
                    <div
                      className={`fin-proj-progress-fill ${costPct > 90 ? "critical" : costPct > 75 ? "warning" : "nominal"}`}
                      style={{ width: `${Math.min(100, Math.max(0, costPct))}%` }}
                    />
                  </div>
                </div>

                <div className="fin-proj-card-footer">
                  <div className="fin-proj-collection-pill">
                    <Icon name="payments" modifiers="sm" />
                    <span>Collected {formatCurrency(paid)} ({collectionPct}%)</span>
                  </div>

                  <div className="fin-proj-card-actions">
                    <button
                      type="button"
                      className="fin-proj-btn-record"
                      onClick={() =>
                        openRecordModal({
                          doc_type: "expense",
                          scope: "project",
                          project_id: p.id,
                        })
                      }
                      title="Record direct project expense voucher"
                    >
                      <Icon name="add" modifiers="sm" />
                      <span>Expense</span>
                    </button>

                    <button
                      type="button"
                      className="fin-proj-btn-inspect"
                      onClick={() => setSelectedProjectId(p.id)}
                    >
                      <span>Inspect Details</span>
                      <Icon name="chevron_right" modifiers="sm" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project Detail Ledger & Departments Drawer */}
      {selectedProjectId && (
        <ProjectLedgerDrawer
          projectId={selectedProjectId}
          onClose={() => setSelectedProjectId(null)}
          onRecordExpense={(projId) => {
            setSelectedProjectId(null);
            openRecordModal({
              doc_type: "expense",
              scope: "project",
              project_id: projId,
            });
          }}
        />
      )}
    </div>
  );
};

export default ProjectFinancesView;

