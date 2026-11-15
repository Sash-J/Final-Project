import React, { useState, useEffect, useCallback, useMemo } from "react";
import Icon from "../../../components/common/Icon";
import NeoButton from "../../../components/common/NeoButton";
import GlassDatePicker from "../../../components/common/GlassDatePicker";
import FinanceSkeleton from "./FinanceSkeleton";
import { useFinance } from "../context/FinanceContext";
import { financeService } from "../../../services/financeService";
import { formatCurrency } from "../../../utils/currencyUtils";
import {
  exportReportToPDF,
  exportReportToExcel,
} from "../utils/financeExportService";
import toast from "react-hot-toast";
import "./FinancialReportsView.css";

const REPORT_TABS = [
  { id: "pnl", label: "Profit & Loss (P&L)", icon: "assessment" },
  { id: "income_expense", label: "Income & Expense", icon: "stacked_line_chart" },
  { id: "trial_balance", label: "Trial Balance", icon: "balance" },
  { id: "general_ledger", label: "General Ledger", icon: "receipt_long" },
  {
    id: "capital_drawings",
    label: "Capital & Drawings",
    icon: "savings",
    requiresPersonal: true,
  },
];

const FinancialReportsView = () => {
  const { permissions, taxonomy } = useFinance();

  const [activeReport, setActiveReport] = useState("pnl");
  const [filterScope, setFilterScope] = useState("all");
  const [projectId, setProjectId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const projects = taxonomy?.projects || [];

  const availableTabs = useMemo(() => {
    return REPORT_TABS.filter(
      (tab) => !tab.requiresPersonal || permissions.canViewPersonal
    );
  }, [permissions.canViewPersonal]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await financeService.getFinancialReport({
        report_type: activeReport,
        scope: filterScope,
        project_id: projectId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setReportData(data || null);
    } catch (err) {
      toast.error(err?.message || "Failed to generate financial statement.");
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [activeReport, filterScope, projectId, dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrintView = () => {
    const url = financeService.getPrintViewUrl({
      report_type: activeReport,
      scope: filterScope,
      project_id: projectId || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleExportPDF = async () => {
    if (!reportData) return;
    setExporting(true);
    try {
      await exportReportToPDF(reportData, activeReport);
      toast.success("PDF statement downloaded successfully.");
    } catch (err) {
      toast.error("Failed to generate PDF document.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!reportData) return;
    setExporting(true);
    try {
      await exportReportToExcel(reportData, activeReport);
      toast.success("Excel statement downloaded successfully.");
    } catch (err) {
      toast.error("Failed to export Excel workbook.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fin-reports-view" data-testid="financial-reports-view">
      {/* Header & Export Actions */}
      <div className="fin-reports-header">
        <div className="fin-reports-title-wrap">
          <h2 className="fin-reports-title">
            <Icon name="monitoring" size={24} />
            Financial Reports Studio
          </h2>
          <p className="fin-reports-subtitle">
            Statutory double-entry statements, GAAP compliance, and print/export engines.
          </p>
        </div>

        <div className="fin-reports-actions">
          <NeoButton
            variant="secondary"
            size="small"
            onClick={handlePrintView}
            data-testid="reports-print-btn"
          >
            <Icon name="print" size={16} />
            Print View
          </NeoButton>
          <NeoButton
            variant="secondary"
            size="small"
            disabled={exporting || loading || !reportData}
            onClick={handleExportPDF}
            data-testid="reports-export-pdf-btn"
          >
            <Icon name="picture_as_pdf" size={16} />
            Export PDF
          </NeoButton>
          <NeoButton
            variant="secondary"
            size="small"
            disabled={exporting || loading || !reportData}
            onClick={handleExportExcel}
            data-testid="reports-export-excel-btn"
          >
            <Icon name="table_view" size={16} />
            Export Excel
          </NeoButton>
        </div>
      </div>

      {/* Tabs */}
      <div className="fin-reports-tabs">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`fin-reports-tab-btn ${activeReport === tab.id ? "active" : ""}`}
            onClick={() => setActiveReport(tab.id)}
            data-testid={`report-tab-${tab.id}`}
          >
            <Icon name={tab.icon} size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="fin-reports-filter-bar">
        <div className="fin-reports-filter-group">
          <label className="fin-reports-filter-label">Scope</label>
          <select
            className="fin-reports-select"
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value)}
            data-testid="reports-scope-select"
          >
            <option value="all">Consolidated (All)</option>
            <option value="project">Project Scope</option>
            {permissions.canViewPersonal && (
              <>
                <option value="company">Company Overhead</option>
                <option value="personal">Personal Books</option>
              </>
            )}
          </select>
        </div>

        {filterScope !== "company" && filterScope !== "personal" && (
          <div className="fin-reports-filter-group">
            <label className="fin-reports-filter-label">Project</label>
            <select
              className="fin-reports-select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              data-testid="reports-project-select"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="fin-reports-filter-group">
          <label className="fin-reports-filter-label">Date From</label>
          <GlassDatePicker
            value={dateFrom}
            onChange={(val) => setDateFrom(val)}
            placeholder="From Date"
          />
        </div>

        <div className="fin-reports-filter-group">
          <label className="fin-reports-filter-label">Date To</label>
          <GlassDatePicker
            value={dateTo}
            onChange={(val) => setDateTo(val)}
            placeholder="To Date"
          />
        </div>

        <div className="fin-reports-filter-btn">
          <NeoButton
            variant="primary"
            size="small"
            onClick={fetchReport}
            disabled={loading}
            data-testid="reports-refresh-btn"
          >
            <Icon name="refresh" size={16} />
            Run Statement
          </NeoButton>
        </div>
      </div>

      {/* Report Data Body */}
      {loading ? (
        <FinanceSkeleton rows={6} />
      ) : !reportData ? (
        <div className="fin-reports-empty">
          <Icon name="error_outline" size={48} />
          <p>No financial data available for the selected filters.</p>
        </div>
      ) : (
        <ReportContent
          activeReport={activeReport}
          reportData={reportData}
          canViewPersonal={permissions.canViewPersonal}
        />
      )}
    </div>
  );
};

const ReportContent = ({ activeReport, reportData, canViewPersonal }) => {
  if (activeReport === "pnl" || activeReport === "income_expense") {
    const totals = reportData.totals || {};
    const sections = reportData.sections || {};
    const equityMemo = reportData.equity_memo || {};

    return (
      <>
        {/* KPI Summary Cards */}
        <div className="fin-reports-kpi-grid">
          <div className="fin-reports-kpi-card">
            <span className="fin-reports-kpi-label">Total Revenue</span>
            <span className="fin-reports-kpi-val positive">
              {formatCurrency(totals.total_revenue || 0)}
            </span>
            <span className="fin-reports-kpi-sub">
              {(sections.income || []).length} revenue streams
            </span>
          </div>

          <div className="fin-reports-kpi-card">
            <span className="fin-reports-kpi-label">Direct Costs (COGS)</span>
            <span className="fin-reports-kpi-val">
              {formatCurrency(totals.total_cogs || 0)}
            </span>
            <span className="fin-reports-kpi-sub">
              {(sections.cogs || []).length} project cost items
            </span>
          </div>

          <div className="fin-reports-kpi-card">
            <span className="fin-reports-kpi-label">Gross Margin</span>
            <span
              className={`fin-reports-kpi-val ${
                (totals.gross_profit || 0) >= 0 ? "positive" : "negative"
              }`}
            >
              {formatCurrency(totals.gross_profit || 0)}
            </span>
            <span className="fin-reports-kpi-sub">
              {totals.total_revenue > 0
                ? `${Math.round(
                    ((totals.gross_profit || 0) / totals.total_revenue) * 100
                  )}% margin`
                : "0% margin"}
            </span>
          </div>

          <div className="fin-reports-kpi-card">
            <span className="fin-reports-kpi-label">Operating Overhead</span>
            <span className="fin-reports-kpi-val">
              {formatCurrency(totals.total_operating_expenses || 0)}
            </span>
            <span className="fin-reports-kpi-sub">Studio operating costs</span>
          </div>

          <div className="fin-reports-kpi-card">
            <span className="fin-reports-kpi-label">Operating Net Profit</span>
            <span
              className={`fin-reports-kpi-val ${
                (totals.net_profit || 0) >= 0 ? "positive" : "negative"
              }`}
            >
              {formatCurrency(totals.net_profit || 0)}
            </span>
            <span className="fin-reports-kpi-sub">
              Excludes owner drawings & equity
            </span>
          </div>
        </div>

        {/* Detailed Breakdown Tables */}
        <div className="fin-reports-table-card">
          <h3 className="fin-reports-section-title">
            <Icon name="trending_up" size={18} />
            1. Operating Revenue & Income
          </h3>
          <div className="fin-reports-table-wrap">
            <table className="fin-reports-table">
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Account Name</th>
                  <th>Classification</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(sections.income || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center">
                      No income entries found in range.
                    </td>
                  </tr>
                ) : (
                  (sections.income || []).map((row) => (
                    <tr key={row.account_id}>
                      <td className="code-cell">{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.sub_type || "Operating Income"}</td>
                      <td className="text-right">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))
                )}
                <tr className="total-row">
                  <td colSpan={3}>Total Operating Revenue</td>
                  <td className="text-right">
                    {formatCurrency(totals.total_revenue || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="fin-reports-table-card">
          <h3 className="fin-reports-section-title">
            <Icon name="movie_edit" size={18} />
            2. Direct Project Costs (COGS)
          </h3>
          <div className="fin-reports-table-wrap">
            <table className="fin-reports-table">
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Account Name</th>
                  <th>Classification</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(sections.cogs || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center">
                      No direct project cost entries found in range.
                    </td>
                  </tr>
                ) : (
                  (sections.cogs || []).map((row) => (
                    <tr key={row.account_id}>
                      <td className="code-cell">{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.sub_type || "Direct Cost"}</td>
                      <td className="text-right">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))
                )}
                <tr className="total-row">
                  <td colSpan={3}>Total Direct Costs</td>
                  <td className="text-right">
                    {formatCurrency(totals.total_cogs || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="fin-reports-table-card">
          <h3 className="fin-reports-section-title">
            <Icon name="business" size={18} />
            3. Operating Overhead & Expenses
          </h3>
          <div className="fin-reports-table-wrap">
            <table className="fin-reports-table">
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Account Name</th>
                  <th>Classification</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(sections.operating_expenses || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center">
                      No operating overhead entries found in range.
                    </td>
                  </tr>
                ) : (
                  (sections.operating_expenses || []).map((row) => (
                    <tr key={row.account_id}>
                      <td className="code-cell">{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.sub_type || "Overhead"}</td>
                      <td className="text-right">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))
                )}
                <tr className="total-row">
                  <td colSpan={3}>Total Operating Expenses</td>
                  <td className="text-right">
                    {formatCurrency(totals.total_operating_expenses || 0)}
                  </td>
                </tr>
                <tr className="net-profit-row">
                  <td colSpan={3}>Operating Net Profit / (Loss)</td>
                  <td className="text-right">
                    {formatCurrency(totals.net_profit || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {canViewPersonal && (
          <div className="fin-reports-table-card">
            <h3 className="fin-reports-section-title">
              <Icon name="account_balance_wallet" size={18} />
              4. Director Equity & Drawings Memo (Isolated From P&L)
            </h3>
            <div className="fin-reports-table-wrap">
              <table className="fin-reports-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Account / Description</th>
                    <th className="text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Capital Injections</td>
                    <td>Owner / Partner Paid-in Capital (3010)</td>
                    <td className="text-right">
                      {formatCurrency(equityMemo.total_capital || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td>Owner Drawings</td>
                    <td>Partner / Director Drawings Taken (3020)</td>
                    <td className="text-right">
                      {formatCurrency(equityMemo.total_drawings || 0)}
                    </td>
                  </tr>
                  <tr className="total-row">
                    <td colSpan={2}>Net Owner Equity Shift</td>
                    <td className="text-right">
                      {formatCurrency(
                        (equityMemo.total_capital || 0) -
                          (equityMemo.total_drawings || 0)
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  }

  if (activeReport === "trial_balance") {
    const rows = reportData.rows || [];
    const totals = reportData.totals || {};

    return (
      <>
        <div
          className={`fin-reports-tb-banner ${
            totals.is_balanced ? "balanced" : "unbalanced"
          }`}
        >
          <div className="fin-reports-tb-banner-left">
            <Icon
              name={totals.is_balanced ? "verified" : "warning"}
              size={20}
            />
            {totals.is_balanced
              ? "DOUBLE-ENTRY BOOKS IN BALANCE"
              : "OUT OF BALANCE: Debits and credits do not match"}
          </div>
          <div className="fin-reports-tb-banner-right">
            Total Debits: {formatCurrency(totals.total_debit || 0)} | Total Credits:{" "}
            {formatCurrency(totals.total_credit || 0)}
          </div>
        </div>

        <div className="fin-reports-table-card">
          <div className="fin-reports-table-wrap">
            <table className="fin-reports-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account Name</th>
                  <th>Class</th>
                  <th className="text-right">Period Debit</th>
                  <th className="text-right">Period Credit</th>
                  <th className="text-right">Closing Debit</th>
                  <th className="text-right">Closing Credit</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center">
                      No trial balance balances for this range.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.account_id}>
                      <td className="code-cell">{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.account_class?.toUpperCase()}</td>
                      <td className="text-right">
                        {formatCurrency(row.period_debit)}
                      </td>
                      <td className="text-right">
                        {formatCurrency(row.period_credit)}
                      </td>
                      <td className="text-right">
                        {formatCurrency(row.closing_debit)}
                      </td>
                      <td className="text-right">
                        {formatCurrency(row.closing_credit)}
                      </td>
                    </tr>
                  ))
                )}
                <tr className="total-row">
                  <td colSpan={3}>TOTALS</td>
                  <td className="text-right">
                    {formatCurrency(totals.total_debit || 0)}
                  </td>
                  <td className="text-right">
                    {formatCurrency(totals.total_credit || 0)}
                  </td>
                  <td colSpan={2} className="text-center">
                    {totals.is_balanced ? "BALANCED" : "DISCREPANCY"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  if (activeReport === "general_ledger") {
    const rows = reportData.rows || [];
    const totals = reportData.totals || {};

    return (
      <div className="fin-reports-table-card">
        <h3 className="fin-reports-section-title">
          <Icon name="receipt_long" size={18} />
          General Ledger Journal Lines ({totals.row_count || rows.length} records)
        </h3>
        <div className="fin-reports-table-wrap">
          <table className="fin-reports-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher No</th>
                <th>Doc Type</th>
                <th>Scope</th>
                <th>Account</th>
                <th>Project / Counterparty</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th>Memo</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center">
                    No general ledger journal lines in range.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.entry_date}</td>
                    <td className="code-cell">{row.voucher_no}</td>
                    <td>{row.doc_type?.toUpperCase()}</td>
                    <td>{row.scope?.toUpperCase()}</td>
                    <td>
                      {row.account_code} - {row.account_name}
                    </td>
                    <td>{row.project_name || row.person_name || "-"}</td>
                    <td className="text-right">{formatCurrency(row.debit)}</td>
                    <td className="text-right">{formatCurrency(row.credit)}</td>
                    <td>{row.memo || "-"}</td>
                  </tr>
                ))
              )}
              <tr className="total-row">
                <td colSpan={6}>TOTALS</td>
                <td className="text-right">
                  {formatCurrency(totals.total_debit || 0)}
                </td>
                <td className="text-right">
                  {formatCurrency(totals.total_credit || 0)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (activeReport === "capital_drawings") {
    const rows = reportData.rows || [];

    return (
      <div className="fin-reports-table-card">
        <h3 className="fin-reports-section-title">
          <Icon name="savings" size={18} />
          Director & Partner Equity Statements
        </h3>
        <div className="fin-reports-table-wrap">
          <table className="fin-reports-table">
            <thead>
              <tr>
                <th>Stakeholder</th>
                <th>Role</th>
                <th className="text-right">Capital Injected</th>
                <th className="text-right">Drawings Taken</th>
                <th className="text-right">Net Equity Pool Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center">
                    No capital or drawing entries found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const cap = Number(row.capital_contributed || 0);
                  const draw = Number(row.drawings_taken || 0);
                  const net = cap - draw;
                  return (
                    <tr key={row.user_id || row.owner_name}>
                      <td className="font-semibold">{row.owner_name}</td>
                      <td>{row.role || "Director"}</td>
                      <td className="text-right">{formatCurrency(cap)}</td>
                      <td className="text-right">{formatCurrency(draw)}</td>
                      <td
                        className={`text-right font-bold ${
                          net >= 0 ? "positive" : "negative"
                        }`}
                      >
                        {formatCurrency(net)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
};

export default FinancialReportsView;

