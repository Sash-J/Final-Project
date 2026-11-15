import React, { useState, useEffect, useMemo, useCallback } from "react";
import Icon from "../../../components/common/Icon";
import NeoButton from "../../../components/common/NeoButton";
import { formatCurrency } from "../../../utils/currencyUtils";
import { sanitizeRealtime } from "../../../utils/sanitizer";
import { financeService } from "../../../services/financeService";
import { useFinance } from "../context/FinanceContext";
import SettlementModal from "./SettlementModal";
import FinanceSkeleton from "./FinanceSkeleton";
import "./DebtorsCreditorsView.css";

const VIEW_TABS = [
  { id: "all", label: "All Items", icon: "fact_check" },
  { id: "debtors", label: "Debtors (Receivables - AR)", icon: "trending_up" },
  { id: "creditors", label: "Creditors (Payables - AP)", icon: "trending_down" },
  { id: "contracts", label: "Project Contract Balances", icon: "movie_edit" },
];

const DebtorsCreditorsView = () => {
  const { openRecordModal } = useFinance();

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Settlement modal state
  const [settlementTarget, setSettlementTarget] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const partyFilter = activeTab === "contracts" ? "all" : activeTab;
      const res = await financeService.getDebtorsCreditors(partyFilter);
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load debtors and creditors.");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const debtors = useMemo(() => data?.debtors || [], [data]);
  const creditors = useMemo(() => data?.creditors || [], [data]);
  const contracts = useMemo(() => data?.project_contract_receivables || [], [data]);
  const aging = useMemo(() => data?.aging || {}, [data]);

  // Combined aging summary
  const agingSummary = useMemo(() => {
    const arAging = aging.debtors || {};
    const apAging = aging.creditors || {};

    return {
      current: (arAging.current || 0) + (apAging.current || 0),
      days_1_30: (arAging.days_1_30 || 0) + (apAging.days_1_30 || 0),
      days_31_60: (arAging.days_31_60 || 0) + (apAging.days_31_60 || 0),
      days_60_plus: (arAging.days_60_plus || 0) + (apAging.days_60_plus || 0),
      totalAR: arAging.total || 0,
      totalAP: apAging.total || 0,
    };
  }, [aging]);

  // Filtered items based on activeTab and search
  const displayedItems = useMemo(() => {
    let combined = [];
    if (activeTab === "all") {
      combined = [...debtors, ...creditors];
    } else if (activeTab === "debtors") {
      combined = [...debtors];
    } else if (activeTab === "creditors") {
      combined = [...creditors];
    }

    const q = search.trim().toLowerCase();
    if (!q) return combined;

    return combined.filter((item) => {
      const name = (item.counterparty_name || item.person_name || "").toLowerCase();
      const vch = (item.voucher_no || "").toLowerCase();
      const proj = (item.project_name || item.project_code || "").toLowerCase();
      return name.includes(q) || vch.includes(q) || proj.includes(q);
    });
  }, [activeTab, debtors, creditors, search]);

  const filteredContracts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contracts;
    return contracts.filter((c) => {
      const name = (c.project_name || "").toLowerCase();
      const code = (c.code_name || "").toLowerCase();
      const client = (c.client_name || "").toLowerCase();
      return name.includes(q) || code.includes(q) || client.includes(q);
    });
  }, [contracts, search]);

  return (
    <div className="fin-debt-view" data-testid="debtors-creditors-view">
      {/* Top Header Card */}
      <div className="fin-debt-head-card">
        <div className="fin-debt-header-info">
          <span className="fin-debt-eyebrow">Receivables & Payables Aging Control</span>
          <h2 className="fin-debt-title">Debtors (AR) & Creditors (AP)</h2>
          <p className="fin-debt-desc">
            Track client invoices, contractor bills, aging delinquency buckets, and allocate one-click
            settlement remittances.
          </p>
        </div>

        <div className="fin-debt-header-actions">
          <NeoButton
            variant="secondary"
            icon="refresh"
            loading={loading}
            onClick={fetchData}
          >
            Refresh
          </NeoButton>
          <NeoButton
            variant="solid"
            icon="add"
            onClick={() =>
              openRecordModal({
                doc_type: activeTab === "creditors" ? "bill_ap" : "invoice_ar",
                scope: "project",
              })
            }
          >
            + New Invoice / Bill
          </NeoButton>
        </div>
      </div>

      {error && (
        <div className="fin-debt-error-banner" role="alert">
          <Icon name="error" modifiers="sm" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Aging Summary Grid */}
      <div className="fin-debt-kpi-grid">
        <div className="fin-debt-kpi-tile highlight-cyan">
          <span className="fin-debt-kpi-label">Open Debtors (AR)</span>
          <span className="fin-debt-kpi-val positive">{formatCurrency(agingSummary.totalAR)}</span>
          <span className="fin-debt-kpi-sub">Receivable from clients</span>
        </div>

        <div className="fin-debt-kpi-tile highlight-amber">
          <span className="fin-debt-kpi-label">Open Creditors (AP)</span>
          <span className="fin-debt-kpi-val negative">{formatCurrency(agingSummary.totalAP)}</span>
          <span className="fin-debt-kpi-sub">Payable to vendors & crew</span>
        </div>

        <div className="fin-debt-kpi-tile">
          <span className="fin-debt-kpi-label">Current (Within Term)</span>
          <span className="fin-debt-kpi-val">{formatCurrency(agingSummary.current)}</span>
          <span className="fin-debt-kpi-sub">Not yet past due</span>
        </div>

        <div className="fin-debt-kpi-tile">
          <span className="fin-debt-kpi-label">1–30 Days Past Due</span>
          <span className="fin-debt-kpi-val warning">{formatCurrency(agingSummary.days_1_30)}</span>
          <span className="fin-debt-kpi-sub">First escalation stage</span>
        </div>

        <div className="fin-debt-kpi-tile">
          <span className="fin-debt-kpi-label">31–60 Days Past Due</span>
          <span className="fin-debt-kpi-val warning">{formatCurrency(agingSummary.days_31_60)}</span>
          <span className="fin-debt-kpi-sub">Moderate overdue aging</span>
        </div>

        <div className="fin-debt-kpi-tile">
          <span className="fin-debt-kpi-label">60+ Days Past Due</span>
          <span className="fin-debt-kpi-val critical">{formatCurrency(agingSummary.days_60_plus)}</span>
          <span className="fin-debt-kpi-sub">Critical delinquency risk</span>
        </div>
      </div>

      {/* View Tabs & Search Bar */}
      <div className="fin-debt-controls-bar">
        <div className="fin-debt-tabs" role="tablist">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`fin-debt-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon name={tab.icon} modifiers="sm" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="fin-debt-search-wrapper">
          <Icon name="search" modifiers="sm" />
          <input
            type="text"
            className="fin-debt-search-input"
            placeholder="Search party name, voucher, or project..."
            value={search}
            onChange={(e) => setSearch(sanitizeRealtime(e.target.value))}
          />
          {search && (
            <button
              type="button"
              className="fin-debt-search-clear"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <Icon name="close" modifiers="sm" />
            </button>
          )}
        </div>
      </div>

      {/* Items Table (if tab is not contracts-only) */}
      {activeTab !== "contracts" && (
        <div className="fin-debt-table-box">
          {loading && !data ? (
            <FinanceSkeleton variant="subview" />
          ) : displayedItems.length === 0 ? (
            <div className="fin-debt-empty">
              <Icon name="verified" modifiers="lg" />
              <p className="fin-debt-empty-title">All items are fully settled.</p>
              <p className="fin-debt-empty-desc">
                No open invoices or bills match your search criteria.
              </p>
            </div>
          ) : (
            <table className="fin-debt-table">
              <thead>
                <tr>
                  <th>Counterparty</th>
                  <th>Type</th>
                  <th>Voucher #</th>
                  <th>Project</th>
                  <th>Due Date</th>
                  <th>Aging Status</th>
                  <th className="align-right">Total</th>
                  <th className="align-right">Settled</th>
                  <th className="align-right">Balance Due</th>
                  <th className="align-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((item) => {
                  const partyName =
                    item.counterparty_name || item.person_name || "Counterparty";
                  const dpd = Number(item.days_past_due || 0);
                  const isAR = item.doc_type === "invoice_ar";

                  let agingClass = "nominal";
                  let agingLabel = "Current";
                  if (dpd > 60) {
                    agingClass = "critical";
                    agingLabel = `+${dpd}d Critical`;
                  } else if (dpd > 30) {
                    agingClass = "warning-high";
                    agingLabel = `+${dpd}d Overdue`;
                  } else if (dpd > 0) {
                    agingClass = "warning";
                    agingLabel = `+${dpd}d Past Due`;
                  }

                  return (
                    <tr key={item.id} data-testid={`debt-item-${item.id}`}>
                      <td className="fin-debt-table-party">{partyName}</td>
                      <td>
                        <span className={`fin-debt-type-pill ${isAR ? "ar" : "ap"}`}>
                          {isAR ? "Invoice (AR)" : "Bill (AP)"}
                        </span>
                      </td>
                      <td className="fin-debt-table-vch">{item.voucher_no}</td>
                      <td>
                        <span className="fin-debt-proj-tag">
                          {item.project_code || "GEN"} · {item.project_name || "Company"}
                        </span>
                      </td>
                      <td className="fin-debt-cell-due">{item.due_date || "—"}</td>
                      <td>
                        <span className={`fin-debt-aging-badge ${agingClass}`}>
                          {agingLabel}
                        </span>
                      </td>
                      <td className="align-right">
                        {formatCurrency(item.total_amount, item.currency_code || "LKR")}
                      </td>
                      <td className="align-right">
                        {formatCurrency(item.settled_amount || 0, item.currency_code || "LKR")}
                      </td>
                      <td className="align-right fin-debt-table-balance">
                        {formatCurrency(item.balance, item.currency_code || "LKR")}
                      </td>
                      <td className="align-center">
                        <button
                          type="button"
                          className="fin-debt-btn-settle"
                          onClick={() => setSettlementTarget(item)}
                        >
                          <Icon name="payments" modifiers="xs" />
                          <span>Settle</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Contract Receivables Section (if tab is 'all' or 'contracts') */}
      {(activeTab === "all" || activeTab === "contracts") && (
        <div className="fin-debt-contracts-card" data-testid="contracts-receivables-section">
          <div className="fin-debt-contracts-header">
            <div className="fin-debt-contracts-title-group">
              <Icon name="assignment" modifiers="md" />
              <h3 className="fin-debt-contracts-title">Project Contract Balance Receivables</h3>
            </div>
            <span className="fin-debt-contracts-count">{filteredContracts.length} Projects</span>
          </div>

          <div className="fin-debt-table-box">
            {filteredContracts.length === 0 ? (
              <div className="fin-debt-empty-list">No open contract balances remaining.</div>
            ) : (
              <table className="fin-debt-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Client</th>
                    <th className="align-right">Contract Quote</th>
                    <th className="align-right">Collected</th>
                    <th className="align-right">Contract Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map((c) => (
                    <tr key={c.project_id || c.id}>
                      <td className="fin-debt-table-party">
                        <span className="fin-debt-proj-tag">{c.code_name}</span>{" "}
                        {c.project_name}
                      </td>
                      <td>{c.client_name || "—"}</td>
                      <td className="align-right">
                        {formatCurrency(c.quoted_client_total || 0)}
                      </td>
                      <td className="align-right">
                        {formatCurrency(c.total_paid || 0)}
                      </td>
                      <td className="align-right fin-debt-table-balance">
                        {formatCurrency(c.contract_balance || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Settlement Allocation Modal */}
      {settlementTarget && (
        <SettlementModal
          isOpen={Boolean(settlementTarget)}
          targetTx={settlementTarget}
          onClose={() => setSettlementTarget(null)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
};

export default DebtorsCreditorsView;

