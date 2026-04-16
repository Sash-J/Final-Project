import React from "react";
import Icon from "../common/Icon";
import { formatCurrency, getCurrencySymbol } from "../../utils/currencyUtils";
import "./BudgetSummary.css";

const BudgetSummary = ({
  projectId,
  versionId,
  hierarchy = [],
  values = {},
  loading = false,
  totalPaid = 0,
}) => {

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

  if (loading) {
    return (
      <div className="budget-summary-loader">
        <div
          className="skeleton-base"
          style={{ width: "100%", height: "300px" }}
        ></div>
      </div>
    );
  }

  const grandTotal = hierarchy.reduce(
    (sum, p) => sum + calculatePhaseTotal(p),
    0,
  );

  return (
    <div className="budget-summary-root">
      <div className="budget-summary-header">
        <div className="grand-total-display glass-card">
          <label>Project Total Budget</label>
          <h2>{formatCurrency(grandTotal)}</h2>
        </div>
        <div className="grand-total-display glass-card">
          <label>Total Payments</label>
          <h2 className="success-text">{formatCurrency(totalPaid)}</h2>
        </div>
      </div>

      <div className="summary-table-container glass-card">
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

      <div className="summary-disclaimer">
        <Icon name="info" modifiers="xs" />
        <span>
          This is a read-only snapshot. Line-item edits are restricted in this
          dashboard view.
        </span>
      </div>
    </div>
  );
};

export default BudgetSummary;
