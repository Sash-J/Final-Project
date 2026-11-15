import React, { useState, useEffect } from "react";
import Icon from "../../../components/common/Icon";
import NeoButton from "../../../components/common/NeoButton";
import { formatCurrency } from "../../../utils/currencyUtils";
import { financeService } from "../../../services/financeService";
import "./ProjectLedgerDrawer.css";

const ProjectLedgerDrawer = ({
  projectId,
  onClose,
  onRecordExpense,
}) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("departments");

  useEffect(() => {
    if (!projectId) return;

    let mounted = true;
    setLoading(true);
    setError("");

    financeService
      .getProjectFinanceDetail(projectId)
      .then((data) => {
        if (mounted) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "Failed to load project details.");
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [projectId]);

  if (!projectId) return null;

  const project = detail?.project || {};
  const departments = detail?.department_variance || [];
  const personalStatuses = detail?.personal_statuses || [];

  const margin = Number(project.actual_net_margin || 0);
  const quoted = Number(project.quoted_client_total || 0);
  const marginPct = quoted > 0 ? Math.round((margin / quoted) * 100) : 0;

  return (
    <div
      className="fin-drawer-backdrop"
      onClick={onClose}
      data-testid="project-ledger-drawer"
    >
      <div className="fin-drawer-pane" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="fin-drawer-header">
          <div className="fin-drawer-title-group">
            <span className="fin-drawer-code">{project.code_name || "PROJECT"}</span>
            <h2 className="fin-drawer-title">{project.project_name || "Project Finances"}</h2>
            <p className="fin-drawer-client">
              Client: <strong>{project.client_name || "Not specified"}</strong> · Status:{" "}
              <span className={`fin-status-tag status-${project.status}`}>
                {project.status || "active"}
              </span>
            </p>
          </div>
          <button
            type="button"
            className="fin-drawer-close-btn"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <Icon name="close" modifiers="md" />
          </button>
        </div>

        {/* Quick KPI Strip */}
        <div className="fin-drawer-kpis">
          <div className="fin-drawer-kpi">
            <span className="fin-drawer-kpi-label">Quoted Total</span>
            <span className="fin-drawer-kpi-val">{formatCurrency(project.quoted_client_total)}</span>
          </div>
          <div className="fin-drawer-kpi">
            <span className="fin-drawer-kpi-label">Budgeted Cost</span>
            <span className="fin-drawer-kpi-val">{formatCurrency(project.budgeted_direct_cost)}</span>
          </div>
          <div className="fin-drawer-kpi">
            <span className="fin-drawer-kpi-label">Actual Direct Expense</span>
            <span className="fin-drawer-kpi-val">{formatCurrency(project.actual_expense)}</span>
          </div>
          <div className="fin-drawer-kpi">
            <span className="fin-drawer-kpi-label">Net Margin</span>
            <span
              className={`fin-drawer-kpi-val ${
                margin >= 0 ? "is-positive" : "is-negative"
              }`}
            >
              {formatCurrency(margin)} ({marginPct}%)
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="fin-drawer-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "departments"}
            className={`fin-drawer-tab ${activeTab === "departments" ? "is-active" : ""}`}
            onClick={() => setActiveTab("departments")}
          >
            Department Variance ({departments.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "stakeholders"}
            className={`fin-drawer-tab ${activeTab === "stakeholders" ? "is-active" : ""}`}
            onClick={() => setActiveTab("stakeholders")}
          >
            Crew / Personal Statuses ({personalStatuses.length})
          </button>
        </div>

        {/* Body Content */}
        <div className="fin-drawer-body">
          {loading ? (
            <div className="fin-drawer-loading">
              <Icon name="sync" modifiers="md" />
              <span>Loading ledger breakdown...</span>
            </div>
          ) : error ? (
            <div className="fin-drawer-error" role="alert">
              {error}
            </div>
          ) : activeTab === "departments" ? (
            departments.length === 0 ? (
              <div className="fin-drawer-empty">
                <Icon name="folder_open" modifiers="md" />
                <span>No department expense lines recorded for this project yet.</span>
              </div>
            ) : (
              <div className="fin-drawer-table-wrap">
                <table className="fin-drawer-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th className="is-num">Budgeted Cost</th>
                      <th className="is-num">Actual Expense</th>
                      <th className="is-num">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((d) => {
                      const budgeted = Number(d.budgeted_cost || 0);
                      const actual = Number(d.actual_expense || 0);
                      const variance = budgeted - actual;
                      return (
                        <tr key={d.department_id}>
                          <td className="is-name">{d.department_name}</td>
                          <td className="is-num">{formatCurrency(budgeted)}</td>
                          <td className="is-num">{formatCurrency(actual)}</td>
                          <td
                            className={`is-num ${
                              variance >= 0 ? "is-positive" : "is-negative"
                            }`}
                          >
                            {variance >= 0 ? "+" : ""}
                            {formatCurrency(variance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : personalStatuses.length === 0 ? (
            <div className="fin-drawer-empty">
              <Icon name="group" modifiers="md" />
              <span>No individual stakeholder fee or payable lines on this project.</span>
            </div>
          ) : (
            <div className="fin-drawer-table-wrap">
              <table className="fin-drawer-table">
                <thead>
                  <tr>
                    <th>Stakeholder</th>
                    <th>Role</th>
                    <th className="is-num">Fees Incurred</th>
                    <th className="is-num">Unpaid Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {personalStatuses.map((p) => (
                    <tr key={p.user_id}>
                      <td className="is-name">{p.full_name}</td>
                      <td>
                        <span className="fin-role-badge">{p.role}</span>
                      </td>
                      <td className="is-num">{formatCurrency(p.incurred_fees)}</td>
                      <td
                        className={`is-num ${
                          Number(p.payable_balance || 0) > 0 ? "is-warning" : ""
                        }`}
                      >
                        {formatCurrency(p.payable_balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="fin-drawer-footer">
          <NeoButton
            variant="solid"
            icon="add"
            onClick={() => {
              onRecordExpense?.(project.id);
            }}
          >
            Record Project Expense
          </NeoButton>
          <NeoButton variant="secondary" onClick={onClose}>
            Close
          </NeoButton>
        </div>
      </div>
    </div>
  );
};

export default ProjectLedgerDrawer;
