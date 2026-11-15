import React, { useState, useEffect, useMemo, useCallback } from "react";
import Icon from "../../../components/common/Icon";
import NeoButton from "../../../components/common/NeoButton";
import { formatCurrency } from "../../../utils/currencyUtils";
import { sanitizeRealtime } from "../../../utils/sanitizer";
import { useFinance } from "../context/FinanceContext";
import { financeService } from "../../../services/financeService";
import VoucherDetailModal from "./VoucherDetailModal";
import FinanceSkeleton from "./FinanceSkeleton";
import "./TransactionsLedgerView.css";

const REGISTER_TABS = [
  { id: "all", label: "All Vouchers", icon: "receipt_long" },
  { id: "expense", label: "Expenses", icon: "receipt" },
  { id: "income", label: "Income", icon: "trending_up" },
  { id: "drawing", label: "Drawings", icon: "account_balance_wallet", requiresPersonal: true },
  { id: "capital", label: "Capital", icon: "savings", requiresPersonal: true },
  { id: "invoice_ar", label: "Invoices (AR)", icon: "description" },
  { id: "bill_ap", label: "Bills (AP)", icon: "payments" },
];

const SCOPES = [
  { id: "all", label: "All Scopes" },
  { id: "project", label: "Project" },
  { id: "company", label: "Company" },
  { id: "personal", label: "Personal" },
];

const STATUSES = [
  { id: "all", label: "All Statuses" },
  { id: "posted", label: "Posted" },
  { id: "draft", label: "Draft" },
  { id: "voided", label: "Voided" },
];

const TransactionsLedgerView = () => {
  const {
    permissions,
    openRecordModal,
    sectionPreset,
    scope: globalScope,
    dateRange,
  } = useFinance();

  // Tab & filters
  const initialDocType = sectionPreset?.ledger?.doc_type || "all";
  const [docType, setDocType] = useState(initialDocType);
  const [localScope, setLocalScope] = useState(globalScope || "all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Data state
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Inspection modal state
  const [inspectTxId, setInspectTxId] = useState(null);

  // Available tabs respecting permissions
  const visibleTabs = useMemo(() => {
    return REGISTER_TABS.filter((t) => !t.requiresPersonal || permissions?.canViewPersonal);
  }, [permissions?.canViewPersonal]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const filters = {
        doc_type: docType === "all" ? undefined : docType,
        scope: localScope === "all" ? undefined : localScope,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search.trim() || undefined,
        date_from: dateRange?.start || undefined,
        date_to: dateRange?.end || undefined,
        page,
        per_page: perPage,
      };
      const res = await financeService.getTransactions(filters);
      setItems(res?.items || []);
      setPagination(res?.pagination || { page: 1, per_page: perPage, total: 0 });
    } catch (err) {
      setError(err.message || "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, [docType, localScope, statusFilter, search, dateRange, page, perPage]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / perPage));

  return (
    <div className="fin-ledger-view" data-testid="transactions-ledger-view">
      {/* Top Header Card */}
      <div className="fin-ledger-head-card">
        <div className="fin-ledger-header-info">
          <span className="fin-ledger-eyebrow">General Ledger & Separated Registers</span>
          <h2 className="fin-ledger-title">Transaction Registers & Vouchers</h2>
          <p className="fin-ledger-desc">
            Complete audited registry of vouchers strictly separated across Income, Expenses,
            Drawings, Capital, Invoices, and Vendor Bills.
          </p>
        </div>

        <div className="fin-ledger-header-actions">
          <NeoButton
            variant="secondary"
            icon="refresh"
            loading={loading}
            onClick={fetchTransactions}
          >
            Refresh
          </NeoButton>
          <NeoButton
            variant="solid"
            icon="add"
            onClick={() =>
              openRecordModal({
                doc_type: docType !== "all" ? docType : "expense",
                scope: localScope !== "all" ? localScope : "project",
              })
            }
          >
            + Record Voucher
          </NeoButton>
        </div>
      </div>

      {error && (
        <div className="fin-ledger-error-banner" role="alert">
          <Icon name="error" modifiers="sm" />
          <span>{error}</span>
        </div>
      )}

      {/* Register Tabs */}
      <div className="fin-ledger-tabs" role="tablist" aria-label="Transaction Register Tabs">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={docType === tab.id}
            className={`fin-ledger-tab ${docType === tab.id ? "active" : ""}`}
            onClick={() => {
              setDocType(tab.id);
              setPage(1);
            }}
          >
            <Icon name={tab.icon} modifiers="sm" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="fin-ledger-filter-bar">
        <div className="fin-ledger-search-box">
          <Icon name="search" modifiers="sm" />
          <input
            type="text"
            className="fin-ledger-search-input"
            placeholder="Search voucher #, counterparty, description..."
            value={search}
            onChange={(e) => {
              setSearch(sanitizeRealtime(e.target.value));
              setPage(1);
            }}
          />
          {search && (
            <button
              type="button"
              className="fin-ledger-search-clear"
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
            >
              <Icon name="close" modifiers="sm" />
            </button>
          )}
        </div>

        <div className="fin-ledger-dropdowns">
          <select
            className="fin-ledger-select"
            value={localScope}
            onChange={(e) => {
              setLocalScope(e.target.value);
              setPage(1);
            }}
            aria-label="Scope filter"
          >
            {SCOPES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            className="fin-ledger-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Status filter"
          >
            {STATUSES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table / List */}
      <div className="fin-ledger-table-container">
        {loading && items.length === 0 ? (
          <FinanceSkeleton variant="subview" />
        ) : items.length === 0 ? (
          <div className="fin-ledger-empty">
            <Icon name="receipt_long" modifiers="lg" />
            <p className="fin-ledger-empty-title">No vouchers match the filters.</p>
            <p className="fin-ledger-empty-desc">
              Try switching registers or clearing your search keywords.
            </p>
          </div>
        ) : (
          <table className="fin-ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher #</th>
                <th>Type</th>
                <th>Scope</th>
                <th>Target / Association</th>
                <th>Settlement</th>
                <th className="align-right">Amount</th>
                <th className="align-right">Balance</th>
                <th>Status</th>
                <th className="align-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const targetText =
                  row.project_name
                    ? `${row.project_code || ""} · ${row.project_name}`
                    : row.counterparty_name
                    ? row.counterparty_name
                    : row.person_name
                    ? row.person_name
                    : "Studio Overhead";

                const hasAttachments = Number(row.attachment_count || 0) > 0;

                return (
                  <tr
                    key={row.id}
                    className="fin-ledger-row"
                    onClick={() => setInspectTxId(row.id)}
                    data-testid={`voucher-row-${row.id}`}
                  >
                    <td className="fin-ledger-cell-date">{row.tx_date}</td>
                    <td className="fin-ledger-cell-voucher">
                      <span className="fin-ledger-vch-tag">{row.voucher_no}</span>
                      {hasAttachments && (
                        <span className="fin-ledger-att-icon" title="Has attachments">
                          <Icon name="attach_file" modifiers="xs" />
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`fin-ledger-doc-badge doc-${row.doc_type}`}>
                        {(row.doc_type || "").replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <span className="fin-ledger-scope-pill">{row.scope}</span>
                    </td>
                    <td className="fin-ledger-cell-target">{targetText}</td>
                    <td className="fin-ledger-cell-method">
                      {row.payment_method || "Transfer"}
                    </td>
                    <td className="align-right fin-ledger-cell-amount">
                      {formatCurrency(row.total_amount, row.currency_code || "LKR")}
                    </td>
                    <td className="align-right fin-ledger-cell-balance">
                      {Number(row.balance || 0) > 0
                        ? formatCurrency(row.balance, row.currency_code || "LKR")
                        : "—"}
                    </td>
                    <td>
                      <span className={`fin-ledger-status-tag status-${row.status}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="align-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="fin-ledger-btn-view"
                        onClick={() => setInspectTxId(row.id)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="fin-ledger-pagination-bar">
        <span className="fin-ledger-page-info">
          Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({pagination.total || 0} vouchers total)
        </span>

        <div className="fin-ledger-page-actions">
          <NeoButton
            variant="secondary"
            icon="chevron_left"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </NeoButton>
          <NeoButton
            variant="secondary"
            icon="chevron_right"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </NeoButton>
        </div>
      </div>

      {/* Voucher Detail Modal */}
      {inspectTxId && (
        <VoucherDetailModal
          isOpen={Boolean(inspectTxId)}
          txId={inspectTxId}
          onClose={() => setInspectTxId(null)}
          onVoucherUpdated={fetchTransactions}
        />
      )}
    </div>
  );
};

export default TransactionsLedgerView;

