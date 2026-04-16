import React, { useState, useEffect } from "react";
import axios from "axios";
import PageHeader from "../common/PageHeader";
import "./FinancialDashboard.css";

import { API } from "../../config";
import { formatCurrency, getCurrencySymbol } from "../../utils/currencyUtils";

const FinancialDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [sumRes, projRes] = await Promise.all([
          axios.get(`${API}/api/admin/finance/summary`, { withCredentials: true }),
          axios.get(`${API}/api/admin/finance/projects`, { withCredentials: true })
        ]);
        setSummary(sumRes.data);
        setProjects(projRes.data);
      } catch (err) {
        console.error("Error fetching financial data:", err);
        setError("Failed to load financial data. Please ensure you have permission.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="fd-root">
        <div className="fd-stats-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="fd-stat-card skeleton-card"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="fd-root"><div className="fd-empty">{error}</div></div>;
  }

  return (
    <div className="fd-root">
      <PageHeader title="Financial Overview">
        <span className="bef-pill">Studio Accounts</span>
      </PageHeader>

      <div className="fd-content-wrap">
        <div className="fd-stats-grid">
          <div className="fd-stat-card" style={{"--accent-rgb": "0, 198, 230"}}>
            <h3>Gross Revenue</h3>
            <div className="fd-stat-value">
              <span className="fd-stat-currency">{getCurrencySymbol()}</span>
              {formatCurrency(summary?.gross_revenue, false)}
            </div>
          </div>
          <div className="fd-stat-card" style={{"--accent-rgb": "139, 92, 246"}}>
            <h3>Gross Profit</h3>
            <div className="fd-stat-value">
              <span className="fd-stat-currency">{getCurrencySymbol()}</span>
              {formatCurrency(summary?.gross_profit, false)}
            </div>
          </div>
          <div className="fd-stat-card" style={{"--accent-rgb": "52, 211, 153"}}>
            <h3>Total Received</h3>
            <div className="fd-stat-value">
              <span className="fd-stat-currency">{getCurrencySymbol()}</span>
              {formatCurrency(summary?.total_received, false)}
            </div>
          </div>
          <div className="fd-stat-card" style={{"--accent-rgb": "251, 113, 133"}}>
            <h3>Outstanding Balance</h3>
            <div className="fd-stat-value">
              <span className="fd-stat-currency">{getCurrencySymbol()}</span>
              {formatCurrency(summary?.pending_balance, false)}
            </div>
          </div>
        </div>

        <PageHeader title="Project Accounts" />

        <div className="fd-table-container">
          <table className="fd-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Gross Revenue</th>
                <th>Total Budget</th>
                <th>Total Paid</th>
                <th>Payment Progress</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => {
                const progress = p.latest_budget_total > 0 
                  ? (p.total_paid / p.latest_budget_total) * 100 
                  : 0;
                
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="fd-project-name">
                        {p.project_name}
                        <span className="fd-project-code">{p.code_name}</span>
                      </div>
                    </td>
                    <td className="fd-amount-pos">{formatCurrency(p.latest_gross_total)}</td>
                    <td className="fd-amount-pos">{formatCurrency(p.latest_budget_total)}</td>
                    <td className="fd-amount-paid">{formatCurrency(p.total_paid)}</td>
                    <td>
                      <div className="fd-progress-cell">
                        <div className="fd-progress-bar">
                          <div className="fd-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                        </div>
                        <span className="fd-progress-text">{Math.round(progress)}%</span>
                      </div>
                    </td>
                    <td className={p.balance > 0 ? "fd-amount-neg" : "fd-amount-paid"}>
                      {formatCurrency(p.balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {projects.length === 0 && <div className="fd-empty">No projects found with financial data.</div>}
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;
