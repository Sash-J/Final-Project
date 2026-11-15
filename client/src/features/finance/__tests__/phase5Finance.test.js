import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { financeService } from "../../../services/financeService";
import { useAuth } from "../../auth/context/AuthContext";
import { FinanceProvider } from "../context/FinanceContext";
import FinancialReportsView from "../components/FinancialReportsView";
import AccountsTaxonomyView from "../components/AccountsTaxonomyView";
import PerformanceAuditView from "../components/PerformanceAuditView";
import {
  exportReportToPDF,
  exportReportToExcel,
} from "../utils/financeExportService";

jest.mock("../../../components/common/Grainient", () => () => (
  <div data-testid="grainient-mock" />
));

jest.mock("jspdf", () => {
  function MockJsPDF() {
    return {
      setFillColor: jest.fn(),
      rect: jest.fn(),
      setFontSize: jest.fn(),
      setTextColor: jest.fn(),
      setFont: jest.fn(),
      text: jest.fn(),
      save: jest.fn(),
    };
  }
  return {
    __esModule: true,
    default: MockJsPDF,
    jsPDF: MockJsPDF,
  };
});

jest.mock("jspdf-autotable", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("xlsx", () => ({
  utils: {
    book_new: jest.fn(() => ({})),
    aoa_to_sheet: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
  writeFile: jest.fn(),
}));

jest.mock("../../../services/financeService", () => ({
  __esModule: true,
  financeService: {
    getWorkspaceInit: jest.fn(),
    getFinancialReport: jest.fn(),
    getPrintViewUrl: jest.fn(() => "http://localhost:5000/api/finance/reports/print-view?report_type=pnl"),
    getTaxonomy: jest.fn(),
    createAccount: jest.fn(),
    updateAccount: jest.fn(),
    updateFiscalPeriodStatus: jest.fn(),
    getFinanceTelemetry: jest.fn(),
  },
}));

jest.mock("../../auth/context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../../../utils/webVitalsReporter", () => ({
  sendWebVitalMetric: jest.fn(),
}));

const MOCK_WORKSPACE_DATA = {
  scope: "all",
  timeframe: "6M",
  can_view_personal: true,
  summary: {
    total_income: 1500000,
    total_expenses: 300000,
    net_profit: 1200000,
    total_drawings: 150000,
    total_capital: 500000,
    cash_balance: 1550000,
    ar_balance: 75000,
    ap_balance: 0,
    quoted_client_total: 2000000,
    total_collections: 1500000,
  },
  buckets: {
    income: { count: 3, total: 1500000 },
    expense: { count: 2, total: 300000 },
    drawing: { count: 1, total: 150000 },
    capital: { count: 1, total: 500000 },
  },
  chart: [
    { period: "2026-06", income: 200000, expense: 50000, net_profit: 150000 },
    { period: "2026-07", income: 400000, expense: 90000, net_profit: 310000 },
  ],
  watchlist: { projects: [], debtors: [], creditors: [] },
  taxonomy: {
    projects: [{ id: 16, project_name: "The Midnight Heist" }],
    users: [{ id: 1, full_name: "Director Dave", role: "director" }],
    bank_accounts: [
      {
        id: 1,
        account_name: "Commercial Bank Main",
        account_number: "8001234567",
        bank_name: "Commercial Bank",
        currency: "LKR",
        opening_balance: 500000,
        current_balance: 1550000,
        is_active: true,
      },
    ],
    accounts: [
      {
        id: 1,
        code: "1010",
        name: "Operating Bank Account",
        account_class: "asset",
        sub_type: "cash",
        normal_balance: "debit",
        is_system: true,
      },
      {
        id: 2,
        code: "4010",
        name: "Commercial Video Income",
        account_class: "income",
        sub_type: "production",
        normal_balance: "credit",
        is_system: false,
      },
      {
        id: 3,
        code: "5010",
        name: "Direct Crew Wages",
        account_class: "cogs",
        sub_type: "payroll",
        normal_balance: "debit",
        is_system: false,
      },
      {
        id: 4,
        code: "6010",
        name: "Office Studio Rent",
        account_class: "expense",
        sub_type: "overhead",
        normal_balance: "debit",
        is_system: false,
      },
    ],
    fiscal_periods: [
      { id: 1, period_code: "2026-11", start_date: "2026-11-01", end_date: "2026-11-30", status: "open" },
      { id: 2, period_code: "2026-10", start_date: "2026-10-01", end_date: "2026-10-31", status: "locked" },
    ],
    counterparties: [
      { id: 1, name: "Neon Cine Rentals", party_type: "Vendor", tax_number: "VAT-8910", phone: "+94771234567", email: "info@neoncine.lk" },
    ],
  },
};

const MOCK_PNL_REPORT = {
  meta: {
    report_type: "pnl",
    scope: "all",
    generated_on: "2026-11-13",
  },
  sections: {
    income: [
      { account_id: 2, code: "4010", name: "Commercial Video Income", sub_type: "Operating Income", amount: 1500000 },
    ],
    cogs: [
      { account_id: 3, code: "5010", name: "Direct Crew Wages", sub_type: "Direct Cost", amount: 400000 },
    ],
    operating_expenses: [
      { account_id: 4, code: "6010", name: "Office Studio Rent", sub_type: "Overhead", amount: 150000 },
    ],
  },
  equity_memo: {
    capital_injections: [],
    owner_drawings: [],
    total_capital: 500000,
    total_drawings: 150000,
  },
  totals: {
    total_revenue: 1500000,
    total_cogs: 400000,
    gross_profit: 1100000,
    total_operating_expenses: 150000,
    net_profit: 950000,
  },
};

const MOCK_TRIAL_BALANCE_REPORT = {
  meta: { report_type: "trial_balance", scope: "all", generated_on: "2026-11-13" },
  rows: [
    { account_id: 1, code: "1010", name: "Operating Bank Account", account_class: "asset", period_debit: 1500000, period_credit: 550000, closing_debit: 950000, closing_credit: 0 },
    { account_id: 2, code: "4010", name: "Commercial Video Income", account_class: "income", period_debit: 0, period_credit: 1500000, closing_debit: 0, closing_credit: 1500000 },
    { account_id: 3, code: "5010", name: "Direct Crew Wages", account_class: "cogs", period_debit: 400000, period_credit: 0, closing_debit: 400000, closing_credit: 0 },
    { account_id: 4, code: "6010", name: "Office Studio Rent", account_class: "expense", period_debit: 150000, period_credit: 0, closing_debit: 150000, closing_credit: 0 },
  ],
  totals: {
    total_debit: 2050000,
    total_credit: 2050000,
    is_balanced: true,
  },
};

const MOCK_TELEMETRY_DATA = {
  web_vitals: {
    sample_count: 45,
    averages: {
      LCP: 1420,
      CLS: 0.002,
      FCP: 890,
      TTFB: 185,
      "finance:tti": 640,
    },
    ratings: { LCP: "good", CLS: "good", FCP: "good", TTFB: "good" },
  },
  db_audit: {
    audit_started_at: "2026-11-13T00:00:00",
    total_queries_executed: 184,
    total_db_time_ms: 124.5,
    average_query_time_ms: 0.68,
    slow_query_threshold_ms: 50,
    slow_queries_count: 1,
    slow_queries_percent: 0.54,
    recent_slow_queries: [
      { query: "SELECT * FROM finance_ledger_entries WHERE scope = 'all'", duration_ms: 52.4, timestamp: "01:20:15" },
    ],
    recent_queries: [
      { query: "SELECT id, code, name FROM finance_accounts", duration_ms: 1.2, timestamp: "01:25:30", rows_affected: 24 },
    ],
  },
};

const renderWithFinance = (component, authRole = "admin") => {
  useAuth.mockReturnValue({
    user: { id: 1, username: "admin", role: authRole },
    hasPermission: (perm) =>
      authRole === "admin"
        ? true
        : perm !== "finance.personal.view" &&
          perm !== "finance.personal" &&
          perm !== "finance.approve",
  });
  return render(<FinanceProvider>{component}</FinanceProvider>);
};

describe("Phase 5 Financial Reports Studio, Taxonomy & Telemetry", () => {
  beforeAll(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    global.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    window.open = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    financeService.getWorkspaceInit.mockResolvedValue(MOCK_WORKSPACE_DATA);
    financeService.getFinancialReport.mockResolvedValue(MOCK_PNL_REPORT);
    financeService.getPrintViewUrl.mockReturnValue("http://localhost:5000/api/finance/reports/print-view?report_type=pnl");
    financeService.getTaxonomy.mockResolvedValue(MOCK_WORKSPACE_DATA.taxonomy);
    financeService.getFinanceTelemetry.mockResolvedValue(MOCK_TELEMETRY_DATA);
  });

  describe("1. FinancialReportsView", () => {
    test("renders P&L statement with revenue, direct cost, and net profit", async () => {
      renderWithFinance(<FinancialReportsView />);

      expect(await screen.findByText("Financial Reports Studio")).toBeInTheDocument();
      expect(await screen.findByText("Total Revenue")).toBeInTheDocument();
      expect(await screen.findByText("Operating Net Profit")).toBeInTheDocument();
      expect(await screen.findByText("Commercial Video Income")).toBeInTheDocument();
      expect(await screen.findByText("Direct Crew Wages")).toBeInTheDocument();
      expect(await screen.findByText("Office Studio Rent")).toBeInTheDocument();
    });

    test("switches tab to Trial Balance and renders double-entry balance banner", async () => {
      financeService.getFinancialReport.mockResolvedValue(MOCK_TRIAL_BALANCE_REPORT);

      renderWithFinance(<FinancialReportsView />);

      const tbTab = await screen.findByTestId("report-tab-trial_balance");
      fireEvent.click(tbTab);

      expect(await screen.findByText("DOUBLE-ENTRY BOOKS IN BALANCE")).toBeInTheDocument();
      expect(await screen.findByText("Operating Bank Account")).toBeInTheDocument();
    });

    test("triggers print view url and export buttons without crashing", async () => {
      renderWithFinance(<FinancialReportsView />);

      const printBtn = await screen.findByTestId("reports-print-btn");
      fireEvent.click(printBtn);
      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining("/api/finance/reports/print-view"),
        "_blank",
        "noopener,noreferrer"
      );

      const pdfBtn = await screen.findByTestId("reports-export-pdf-btn");
      fireEvent.click(pdfBtn);

      const xlsxBtn = await screen.findByTestId("reports-export-excel-btn");
      fireEvent.click(xlsxBtn);
    });
  });

  describe("2. AccountsTaxonomyView", () => {
    test("renders Chart of Accounts table and filters by search query", async () => {
      renderWithFinance(<AccountsTaxonomyView />);

      expect(await screen.findByText("Chart of Accounts & Studio Taxonomy")).toBeInTheDocument();
      expect(await screen.findByText("Operating Bank Account")).toBeInTheDocument();
      expect(await screen.findByText("Office Studio Rent")).toBeInTheDocument();

      const searchInput = screen.getByTestId("accounts-search-input");
      fireEvent.change(searchInput, { target: { value: "Rent" } });

      expect(screen.getByText("Office Studio Rent")).toBeInTheDocument();
      expect(screen.queryByText("Direct Crew Wages")).not.toBeInTheDocument();
    });

    test("switches tabs to bank accounts, fiscal periods and triggers period lock toggle", async () => {
      financeService.updateFiscalPeriodStatus.mockResolvedValue({ id: 1, status: "locked" });

      renderWithFinance(<AccountsTaxonomyView />);

      // Bank accounts tab
      const bankTab = await screen.findByTestId("taxonomy-tab-bank_accounts");
      fireEvent.click(bankTab);
      expect(await screen.findByText("Commercial Bank Main")).toBeInTheDocument();

      // Fiscal periods tab
      const periodsTab = await screen.findByTestId("taxonomy-tab-fiscal_periods");
      fireEvent.click(periodsTab);
      expect(await screen.findByText("2026-11")).toBeInTheDocument();

      const toggleBtn = screen.getByTestId("toggle-period-btn-2026-11");
      fireEvent.click(toggleBtn);
      expect(financeService.updateFiscalPeriodStatus).toHaveBeenCalledWith(1, "locked");
    });

    test("opens add account modal and submits new account node", async () => {
      financeService.createAccount.mockResolvedValue({ id: 99, code: "5040", name: "Art Dept Wardrobe" });

      renderWithFinance(<AccountsTaxonomyView />);

      const addBtn = await screen.findByTestId("add-account-btn");
      fireEvent.click(addBtn);

      expect(await screen.findByTestId("account-modal")).toBeInTheDocument();

      const codeInput = screen.getByTestId("account-code-input");
      fireEvent.change(codeInput, { target: { value: "5040" } });

      const nameInput = screen.getByTestId("account-name-input");
      fireEvent.change(nameInput, { target: { value: "Art Dept Wardrobe" } });

      const saveBtn = screen.getByTestId("save-account-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(financeService.createAccount).toHaveBeenCalledWith(
          expect.objectContaining({
            code: "5040",
            name: "Art Dept Wardrobe",
            account_class: "expense",
            normal_balance: "debit",
          })
        );
      });
    });
  });

  describe("3. PerformanceAuditView", () => {
    test("renders Web Vitals RUM cards and SQL query auditor metrics", async () => {
      renderWithFinance(<PerformanceAuditView />);

      expect(await screen.findByText("Real-User Web Vitals & SQL Performance Audit")).toBeInTheDocument();
      expect(await screen.findByTestId("vital-card-lcp")).toBeInTheDocument();
      expect(await screen.findByTestId("vital-card-cls")).toBeInTheDocument();
      expect(await screen.findByTestId("vital-card-fcp")).toBeInTheDocument();
      expect(await screen.findByTestId("vital-card-ttfb")).toBeInTheDocument();

      expect(await screen.findByText("184")).toBeInTheDocument();
      expect(await screen.findByText("0.68 ms")).toBeInTheDocument();
      expect(await screen.findByText("12 Web Performance Tricks Implemented in Vision Division")).toBeInTheDocument();
    });
  });

  describe("4. financeExportService Functions", () => {
    test("exportReportToPDF and exportReportToExcel execute successfully", async () => {
      await expect(exportReportToPDF(MOCK_PNL_REPORT, "pnl")).resolves.not.toThrow();
      await expect(exportReportToPDF(MOCK_TRIAL_BALANCE_REPORT, "trial_balance")).resolves.not.toThrow();
      await expect(exportReportToExcel(MOCK_PNL_REPORT, "pnl")).resolves.not.toThrow();
      await expect(exportReportToExcel(MOCK_TRIAL_BALANCE_REPORT, "trial_balance")).resolves.not.toThrow();
    });
  });
});
