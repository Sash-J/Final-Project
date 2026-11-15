import React, { useEffect, useMemo } from "react";
import Icon from "../../../components/common/Icon";
import NeoButton from "../../../components/common/NeoButton";
import { formatCurrency } from "../../../utils/currencyUtils";
import { useFinance } from "../context/FinanceContext";
import FinanceSkeleton from "./FinanceSkeleton";
import "./CompanyFinancesView.css";

const CompanyFinancesView = () => {
  const {
    permissions,
    sectionPayloads,
    sectionLoading,
    sectionErrors,
    loadSectionData,
    openRecordModal,
  } = useFinance();

  const payload = sectionPayloads?.company;
  const isLoading = Boolean(sectionLoading?.company);
  const error = sectionErrors?.company;

  useEffect(() => {
    if (permissions?.canViewPersonal && !payload) {
      loadSectionData("company");
    }
  }, [permissions?.canViewPersonal, payload, loadSectionData]);

  const summary = useMemo(() => {
    return payload?.summary || {};
  }, [payload]);

  const bankAccounts = useMemo(() => {
    return payload?.bank_accounts || [];
  }, [payload]);

  const breakdown = useMemo(() => {
    return payload?.breakdown || [];
  }, [payload]);

  // Guard: require canViewPersonal permission
  if (!permissions?.canViewPersonal) {
    return (
      <div className="fin-comp-restricted" data-testid="company-finances-restricted">
        <Icon name="lock" modifiers="lg" />
        <h3 className="fin-comp-restricted-title">Access Restricted</h3>
        <p className="fin-comp-restricted-desc">
          Company overhead, bank vault balances, and owner equity accounts are restricted to
          administrative and owner roles.
        </p>
      </div>
    );
  }

  if (isLoading && !payload) {
    return <FinanceSkeleton variant="subview" />;
  }

  const netOperating = Number(summary.company_net_operating || 0);

  return (
    <div className="fin-comp-view" data-testid="company-finances-view">
      {/* Top Header Card */}
      <div className="fin-comp-head-card">
        <div className="fin-comp-header-info">
          <span className="fin-comp-eyebrow">Studio Treasury & Operating Overhead</span>
          <h2 className="fin-comp-title">Company Finances & Equity Isolation</h2>
          <p className="fin-comp-desc">
            Manage company-level operating overhead, bank & petty cash reserves, non-project income,
            and owner capital vs. drawings.
          </p>
        </div>

        <div className="fin-comp-header-actions">
          <NeoButton
            variant="secondary"
            icon="refresh"
            loading={isLoading}
            onClick={() => loadSectionData("company", {}, { force: true })}
          >
            Refresh
          </NeoButton>
          <NeoButton
            variant="glass"
            icon="receipt_long"
            onClick={() => openRecordModal({ doc_type: "expense", scope: "company" })}
          >
            + Overhead Expense
          </NeoButton>
          <NeoButton
            variant="glass"
            icon="savings"
            onClick={() => openRecordModal({ doc_type: "capital", scope: "company" })}
          >
            + Inject Capital
          </NeoButton>
          <NeoButton
            variant="solid"
            icon="account_balance_wallet"
            onClick={() => openRecordModal({ doc_type: "drawing", scope: "company" })}
          >
            + Owner Drawing
          </NeoButton>
        </div>
      </div>

      {error && (
        <div className="fin-comp-error-banner" role="alert">
          <Icon name="error" modifiers="sm" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Summary Tiles */}
      <div className="fin-comp-kpi-grid">
        <div className="fin-comp-kpi-tile highlight-cyan">
          <span className="fin-comp-kpi-label">Liquid Bank & Cash</span>
          <span className="fin-comp-kpi-val">{formatCurrency(summary.total_cash || 0)}</span>
          <span className="fin-comp-kpi-sub">Across {bankAccounts.length} active accounts</span>
        </div>

        <div className="fin-comp-kpi-tile">
          <span className="fin-comp-kpi-label">Operating Overhead</span>
          <span className="fin-comp-kpi-val negative">{formatCurrency(summary.company_overhead || 0)}</span>
          <span className="fin-comp-kpi-sub">Fixed studio & administrative costs</span>
        </div>

        <div className="fin-comp-kpi-tile">
          <span className="fin-comp-kpi-label">Non-Project Revenue</span>
          <span className="fin-comp-kpi-val positive">{formatCurrency(summary.company_income || 0)}</span>
          <span className="fin-comp-kpi-sub">General studio revenue</span>
        </div>

        <div className="fin-comp-kpi-tile">
          <span className="fin-comp-kpi-label">Operating Net Position</span>
          <span className={`fin-comp-kpi-val ${netOperating >= 0 ? "positive" : "negative"}`}>
            {formatCurrency(netOperating)}
          </span>
          <span className="fin-comp-kpi-sub">Income less overhead burn</span>
        </div>

        <div className="fin-comp-kpi-tile">
          <span className="fin-comp-kpi-label">Capital Injected</span>
          <span className="fin-comp-kpi-val positive">{formatCurrency(summary.owner_capital || 0)}</span>
          <span className="fin-comp-kpi-sub">Owner paid-in capital</span>
        </div>

        <div className="fin-comp-kpi-tile">
          <span className="fin-comp-kpi-label">Owner Drawings</span>
          <span className="fin-comp-kpi-val warning">{formatCurrency(summary.owner_drawings || 0)}</span>
          <span className="fin-comp-kpi-sub">Contra-equity withdrawals</span>
        </div>

        <div className="fin-comp-kpi-tile highlight-blue">
          <span className="fin-comp-kpi-label">Net Equity & Liquidity</span>
          <span className="fin-comp-kpi-val">{formatCurrency(summary.net_liquidity || 0)}</span>
          <span className="fin-comp-kpi-sub">
            Cash ({formatCurrency(summary.total_cash || 0)}) + AR ({formatCurrency(summary.total_ar || 0)}) - AP ({formatCurrency(summary.total_ap || 0)})
          </span>
        </div>
      </div>

      {/* Main Two-Column Layout: Bank Accounts & Overhead Breakdown */}
      <div className="fin-comp-content-layout">
        {/* Left Column: Bank Accounts */}
        <div className="fin-comp-section-box">
          <div className="fin-comp-box-header">
            <div className="fin-comp-box-title-group">
              <Icon name="account_balance" modifiers="md" />
              <h3 className="fin-comp-box-title">Bank & Treasury Accounts</h3>
            </div>
            <span className="fin-comp-badge">{bankAccounts.length} Connected</span>
          </div>

          <div className="fin-comp-accounts-list">
            {bankAccounts.length === 0 ? (
              <div className="fin-comp-empty-list">No bank or cash accounts configured.</div>
            ) : (
              bankAccounts.map((b) => (
                <div key={b.id} className="fin-comp-acc-card" data-testid={`bank-card-${b.id}`}>
                  <div className="fin-comp-acc-icon-box">
                    <Icon name={b.account_type === "cash" ? "payments" : "account_balance"} modifiers="md" />
                  </div>
                  <div className="fin-comp-acc-info">
                    <span className="fin-comp-acc-bank">{b.bank_name || "Treasury Account"}</span>
                    <span className="fin-comp-acc-name">{b.account_name}</span>
                    <span className="fin-comp-acc-num">
                      Account: {b.account_number ? `•••• ${String(b.account_number).slice(-4)}` : "Vault"} · {b.currency || "LKR"}
                    </span>
                  </div>
                  <div className="fin-comp-acc-balance-group">
                    <span className="fin-comp-acc-balance-label">Current Balance</span>
                    <span className="fin-comp-acc-balance-val">
                      {formatCurrency(b.current_balance || 0, b.currency || "LKR")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Overhead Breakdown */}
        <div className="fin-comp-section-box">
          <div className="fin-comp-box-header">
            <div className="fin-comp-box-title-group">
              <Icon name="pie_chart" modifiers="md" />
              <h3 className="fin-comp-box-title">Operating Overhead Ledger Breakdown</h3>
            </div>
            <span className="fin-comp-badge">Fixed Expenses</span>
          </div>

          <div className="fin-comp-overhead-table-wrapper">
            {breakdown.length === 0 ? (
              <div className="fin-comp-empty-list">No overhead expenses recorded in this period.</div>
            ) : (
              <table className="fin-comp-table">
                <thead>
                  <tr>
                    <th>Account Code</th>
                    <th>Account Name</th>
                    <th className="align-right">Net Expense</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row, idx) => (
                    <tr key={row.account_id || idx}>
                      <td>
                        <span className="fin-comp-code-tag">{row.code}</span>
                      </td>
                      <td className="fin-comp-table-name">{row.name}</td>
                      <td className="align-right fin-comp-table-amount">
                        {formatCurrency(row.net_expense || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyFinancesView;
