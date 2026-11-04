import React, { useState, useMemo } from "react";
import Icon from "../../../components/common/Icon";
import { formatCurrency, getCurrencySymbol } from "../../../utils/currencyUtils";
import BudgetVersionComparisonGraph from "./BudgetVersionComparisonGraph";
import "./BudgetSummary.css";

const BudgetSummary = ({
  projectId,
  versionId,
  versions = [],
  hierarchy = [],
  values = {},
  loading = false,
  totalPaid = 0,
  onSwitchToPayments,
  onSelectVersion,
}) => {
  const [viewMode, setViewMode] = useState("visual"); // 'visual' | 'table'

  // Recursive helpers for detailed table mode
  const calculateCategoryTotal = (cat) => {
    return cat.items.reduce((sum, item) => {
      const v = values[item.id] || {};
      return sum + (parseFloat(v.total) || 0);
    }, 0);
  };

  const calculateDepartmentTotal = (dept) => {
    return dept.categories.reduce(
      (sum, cat) => sum + calculateCategoryTotal(cat),
      0,
    );
  };

  const calculatePhaseTotal = (phase) => {
    return phase.departments.reduce(
      (sum, dept) => sum + calculateDepartmentTotal(dept),
      0,
    );
  };

  // Comprehensive analytics calculation
  const summaryData = useMemo(() => {
    let grandTotal = 0;
    let totalCost = 0;
    let totalHeadcount = 0;
    const deptList = [];

    const isCrewEntity = (deptName, catName) => {
      const d = (deptName || "").toLowerCase();
      const c = (catName || "").toLowerCase();
      return (
        d.includes("crew") ||
        d.includes("staff") ||
        d.includes("camera") ||
        d.includes("lighting") ||
        d.includes("sound") ||
        d.includes("art") ||
        d.includes("wardrobe") ||
        d.includes("grip") ||
        d.includes("electric") ||
        d.includes("talent") ||
        d.includes("cast") ||
        c.includes("crew") ||
        c.includes("staff") ||
        c.includes("cast")
      );
    };

    hierarchy.forEach((phase) => {
      (phase.departments || []).forEach((dept) => {
        let deptTotal = 0;
        let deptCost = 0;
        let deptHeadcount = 0;

        (dept.categories || []).forEach((cat) => {
          (cat.items || []).forEach((item) => {
            const v = values[item.id] || {};
            const itemTotal = parseFloat(v.total) || 0;
            const grossVal = parseFloat(v.gross_revenue);
            const qty = parseFloat(v.quantity) || 0;
            const rate = parseFloat(v.rate) || 0;
            const mult = parseFloat(v.rate_multiplier) || 1;

            let itemCost = 0;
            if (!isNaN(grossVal) && grossVal > 0) {
              itemCost = grossVal;
            } else if (qty > 0 && rate > 0) {
              itemCost = qty * rate * mult;
            } else {
              itemCost = itemTotal;
            }

            deptTotal += itemTotal;
            deptCost += itemCost;

            if (isCrewEntity(dept.department_name, cat.category_name) && qty > 0) {
              deptHeadcount += Math.round(qty);
            }
          });
        });

        if (deptTotal > 0 || deptCost > 0 || deptHeadcount > 0) {
          const deptMargin = Math.max(0, deptTotal - deptCost);
          const deptMarginPct = deptTotal > 0 ? (deptMargin / deptTotal) * 100 : 0;
          deptList.push({
            id: dept.id,
            name: dept.department_name,
            phaseName: phase.phase_name,
            total: deptTotal,
            cost: deptCost,
            margin: deptMargin,
            marginPct: deptMarginPct,
            headcount: deptHeadcount,
          });

          grandTotal += deptTotal;
          totalCost += deptCost;
          totalHeadcount += deptHeadcount;
        }
      });
    });

    const totalMargin = Math.max(0, grandTotal - totalCost);
    const marginPct = grandTotal > 0 ? (totalMargin / grandTotal) * 100 : 0;
    const costPct = grandTotal > 0 ? Math.min(100, (totalCost / grandTotal) * 100) : 0;
    const balance = Math.max(0, grandTotal - totalPaid);
    const paidPct = grandTotal > 0 ? Math.min(100, (totalPaid / grandTotal) * 100) : 0;

    deptList.sort((a, b) => b.total - a.total);

    const departmentsWithPct = deptList.map((d) => ({
      ...d,
      percent: grandTotal > 0 ? ((d.total / grandTotal) * 100).toFixed(1) : 0,
    }));

    return {
      grandTotal,
      totalCost,
      totalMargin,
      marginPct,
      costPct,
      totalHeadcount,
      balance,
      paidPct,
      departments: departmentsWithPct,
    };
  }, [hierarchy, values, totalPaid]);

  if (loading) {
    return (
      <div className="budget-summary-loader">
        <div className="skeleton-base skeleton-summary-box"></div>
      </div>
    );
  }

  // Circular gauge arc parameters
  const ringRadius = 40;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const paidOffset = ringCircumference - (summaryData.paidPct / 100) * ringCircumference;

  return (
    <div className="budget-summary-root">
      {/* View Mode & Version Switcher Row */}
      <div className="summary-controls-row">
        {versions && versions.length > 0 ? (
          <div className="stage-version-cluster">
            <span className="bvb-label">
              <Icon name="layers" modifiers="sm" />
            </span>
            <div className="bvb-pills">
              {versions.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`bvb-pill ${
                    String(v.id) === String(versionId) ? "active" : ""
                  }`}
                  onClick={() => onSelectVersion && onSelectVersion(String(v.id))}
                >
                  v{v.version_number}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div />
        )}

        <div className="summary-mode-pills">
          <button
            type="button"
            className={`mode-pill ${viewMode === "visual" ? "active" : ""}`}
            onClick={() => setViewMode("visual")}
          >
            <Icon name="insights" modifiers="sm" />
            <span>Visual Overview</span>
          </button>
          <button
            type="button"
            className={`mode-pill ${viewMode === "table" ? "active" : ""}`}
            onClick={() => setViewMode("table")}
          >
            <Icon name="table_chart" modifiers="sm" />
            <span>Detailed Table</span>
          </button>
        </div>
      </div>

      {viewMode === "visual" ? (
        <div className="budget-bento-grid">
          {/* Top Row: Hero Trajectory (64%) + Cashflow Card (36%) */}
          <div className="bento-row bento-row-top">
            {/* 1. Hero Trajectory Card with 3 Integrated Metrics underneath */}
            <div className="bento-card bento-hero-trajectory">
              <div className="hero-chart-container">
                <BudgetVersionComparisonGraph
                  projectId={projectId}
                  versions={versions}
                  currentVersionId={versionId}
                  currentHierarchy={hierarchy}
                  currentValues={values}
                />
              </div>

              {/* 3 Metric Columns integrated at bottom of hero card (matching reference layout) */}
              <div className="hero-metrics-strip">
                <div className="hero-metric-col col-budget">
                  <span className="hero-metric-label">Project Total Budget</span>
                  <h3 className="hero-metric-value">{formatCurrency(summaryData.grandTotal)}</h3>
                  <div className="hero-metric-sub">
                    <span className="sub-paid">Paid: {formatCurrency(totalPaid)}</span>
                    <span className="sub-divider">•</span>
                    <span className="sub-bal">Bal: {formatCurrency(summaryData.balance)}</span>
                  </div>
                </div>

                <div className="hero-metric-divider" />

                <div className="hero-metric-col col-cost">
                  <span className="hero-metric-label">Direct Cost</span>
                  <h3 className="hero-metric-value">{formatCurrency(summaryData.totalCost)}</h3>
                  <span className="hero-metric-sub">
                    {summaryData.costPct.toFixed(1)}% of total budget
                  </span>
                </div>

                <div className="hero-metric-divider" />

                <div className="hero-metric-col col-margin">
                  <div className="hero-margin-header">
                    <span className="hero-metric-label">Profit Margin</span>
                    <span className="hero-margin-badge">+{summaryData.marginPct.toFixed(1)}%</span>
                  </div>
                  <h3 className="hero-metric-value highlight-margin">
                    {formatCurrency(summaryData.totalMargin)}
                  </h3>
                  <span className="hero-metric-sub">Retained markup & fees</span>
                </div>
              </div>
            </div>

            {/* 2. Payment Health & Cashflow Card (Top-Right, matching calendar card position) */}
            <div className="bento-card bento-cashflow-card">
              <div className="bento-card-header">
                <div className="card-title-group">
                  <Icon name="account_balance_wallet" modifiers="sm" />
                  <h4>Payment Health</h4>
                </div>
                <span className="card-header-badge">
                  {summaryData.paidPct.toFixed(0)}% Settled
                </span>
              </div>

              {/* Circular Gauge Ring */}
              <div className="cashflow-ring-wrap">
                <svg className="cashflow-ring-svg" viewBox="0 0 100 100">
                  <circle
                    className="ring-track"
                    cx="50"
                    cy="50"
                    r={ringRadius}
                  />
                  <circle
                    className="ring-fill ring-fill-paid"
                    cx="50"
                    cy="50"
                    r={ringRadius}
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={paidOffset}
                  />
                </svg>
                <div className="cashflow-ring-label">
                  <strong className="ring-pct-text">{summaryData.paidPct.toFixed(0)}%</strong>
                  <span className="ring-sub-text">Paid</span>
                </div>
              </div>

              {/* Cashflow Stat Details */}
              <div className="cashflow-stats-list">
                <div className="cashflow-stat-row">
                  <span className="stat-row-label">Received</span>
                  <strong className="stat-row-val text-emerald">
                    {formatCurrency(totalPaid)}
                  </strong>
                </div>
                <div className="cashflow-stat-row">
                  <span className="stat-row-label">Outstanding Balance</span>
                  <strong className="stat-row-val text-amber">
                    {formatCurrency(summaryData.balance)}
                  </strong>
                </div>
              </div>

              {onSwitchToPayments && (
                <button
                  type="button"
                  className="bento-quick-action-btn"
                  onClick={onSwitchToPayments}
                >
                  <span>Open Payment Ledger</span>
                  <Icon name="arrow_forward" modifiers="xs" />
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: Stacked Metrics (36%) + Department Grid (64%) */}
          <div className="bento-row bento-row-bottom">
            {/* 3. Stacked Mini-Cards (matching sleep/weight widgets in reference) */}
            <div className="bento-stack-col">
              {/* Mini Card A: Profit Margin Ring */}
              <div className="bento-card bento-mini-margin">
                <div className="mini-margin-content">
                  <span className="mini-card-label">Net Profit Margin</span>
                  <h3 className="mini-card-val highlight-margin">
                    {formatCurrency(summaryData.totalMargin)}
                  </h3>
                  <span className="mini-card-sub">
                    +{summaryData.marginPct.toFixed(1)}% Markup & Production Fee
                  </span>
                </div>

                <div className="mini-ring-wrap">
                  <svg className="mini-ring-svg" viewBox="0 0 100 100">
                    <circle className="ring-track" cx="50" cy="50" r="34" />
                    <circle
                      className="ring-fill ring-fill-margin"
                      cx="50"
                      cy="50"
                      r="34"
                      strokeDasharray={2 * Math.PI * 34}
                      strokeDashoffset={2 * Math.PI * 34 - (Math.min(100, summaryData.marginPct) / 100) * (2 * Math.PI * 34)}
                    />
                  </svg>
                  <span className="mini-ring-text">+{summaryData.marginPct.toFixed(0)}%</span>
                </div>
              </div>

              {/* Mini Card B: Production Force & Expenses */}
              <div className="bento-card bento-mini-crew">
                <div className="mini-crew-header">
                  <div className="mini-crew-title-group">
                    <Icon name="groups" modifiers="xs" />
                    <span className="mini-card-label">Production Force</span>
                  </div>
                  <strong className="mini-crew-roles-val">
                    {summaryData.totalHeadcount} Crew Roles
                  </strong>
                </div>

                <div className="mini-cost-progress-wrap">
                  <div className="mini-progress-labels">
                    <span>Direct Cost Allocation</span>
                    <span>{summaryData.costPct.toFixed(1)}%</span>
                  </div>
                  <div className="mini-progress-track">
                    <div
                      className="mini-progress-fill"
                      style={{ width: `${summaryData.costPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Department Allocation Tiles (matching "My Activities" in reference) */}
            <div className="bento-card bento-departments-card">
              <div className="bento-card-header">
                <div className="card-title-group">
                  <Icon name="pie_chart" modifiers="sm" />
                  <h4>Department Allocation</h4>
                </div>
                <span className="card-header-badge">
                  {summaryData.departments.length} Active Departments
                </span>
              </div>

              <div className="dept-tiles-grid">
                {summaryData.departments.map((dept, index) => (
                  <div key={dept.id || index} className="dept-tile">
                    <div className="dept-tile-top">
                      <div className="dept-tile-title-group">
                        <span className="dept-tile-name">{dept.name}</span>
                        <span className="dept-tile-phase">{dept.phaseName}</span>
                      </div>
                      {dept.headcount > 0 && (
                        <span className="dept-tile-crew-chip">
                          <Icon name="person" modifiers="xs" />
                          {dept.headcount} Crew
                        </span>
                      )}
                    </div>

                    <div className="dept-tile-figures">
                      <strong className="dept-tile-total">
                        {formatCurrency(dept.total)}
                      </strong>
                      <span className="dept-tile-share">({dept.percent}%)</span>
                    </div>

                    <div className="dept-tile-progress-track">
                      <div
                        className="dept-tile-progress-fill"
                        style={{ width: `${dept.percent}%` }}
                      />
                    </div>

                    <div className="dept-tile-breakdown">
                      <span>Cost: {formatCurrency(dept.cost)}</span>
                      {dept.margin > 0 && (
                        <span className="text-emerald">+Margin: {formatCurrency(dept.margin)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Detailed Table fallback mode */
        <div className="summary-table-container">
          <table className="summary-table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-right">Total ({getCurrencySymbol()})</th>
              </tr>
            </thead>
            <tbody>
              {hierarchy.map((phase) => {
                const pTotal = calculatePhaseTotal(phase);
                if (pTotal === 0) return null;

                return (
                  <React.Fragment key={phase.phase_id}>
                    <tr className="phase-row">
                      <td>
                        <div className="phase-indicator">
                          <Icon name="folder" modifiers="xs" />
                          {phase.phase_name}
                        </div>
                      </td>
                      <td className="text-right font-bold">
                        {formatCurrency(pTotal)}
                      </td>
                    </tr>

                    {phase.departments.map((dept) => {
                      const dTotal = calculateDepartmentTotal(dept);
                      if (dTotal === 0) return null;

                      return (
                        <React.Fragment key={dept.id}>
                          <tr className="dept-row">
                            <td className="padding-left-lg">
                              <div className="dept-indicator">
                                <Icon
                                  name="subdirectory_arrow_right"
                                  modifiers="sm"
                                />
                                {dept.department_name}
                              </div>
                            </td>
                            <td className="text-right">
                              {formatCurrency(dTotal)}
                            </td>
                          </tr>

                          {dept.categories.map((cat) => {
                            const cTotal = calculateCategoryTotal(cat);
                            if (cTotal === 0) return null;

                            return (
                              <tr key={cat.id} className="cat-row">
                                <td className="padding-left-xl">
                                  {cat.category_name}
                                </td>
                                <td className="text-right opacity-80">
                                  {formatCurrency(cTotal)}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="summary-disclaimer">
        <Icon name="info" modifiers="xs" />
        <span>
          This summary updates automatically for each selected budget version.
        </span>
      </div>
    </div>
  );
};

export default BudgetSummary;