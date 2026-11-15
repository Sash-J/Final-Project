import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  validateAccountForm,
  validateSettlementForm,
  validateVoucherDate,
  validateVoucherForm,
} from "../../../utils/validators";
import { useAuth } from "../../auth/context/AuthContext";
import { financeService } from "../../../services/financeService";
import FinanceWorkspace from "../FinanceWorkspace";

jest.mock("../../../components/common/Grainient", () => () => (
  <div data-testid="grainient-mock" />
));

// Mock axios-backed services cleanly for CRA Jest environment (hoisted automatically by Babel Jest)
jest.mock("../../../services/financeService", () => ({
  __esModule: true,
  financeService: {
    getWorkspaceInit: jest.fn(),
    getTransactions: jest.fn(),
    getProjectFinances: jest.fn(),
    getCompanyFinances: jest.fn(),
    getPersonalFinances: jest.fn(),
    getDebtorsCreditors: jest.fn(),
    getFinancialReport: jest.fn(),
    getTaxonomy: jest.fn(),
    getFinanceTelemetry: jest.fn(),
    getPrintViewUrl: jest.fn(() => "/api/finance/reports/print-view?report_type=pnl"),
  },
}));

jest.mock("../../auth/context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../../../utils/webVitalsReporter", () => ({
  sendWebVitalMetric: jest.fn(),
}));

const SAMPLE_WORKSPACE_DATA = {
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
  watchlist: {
    projects: [
      {
        id: 16,
        project_name: "Prologue IV",
        code_name: "THE FINAL WALK",
        status: "in_progress",
        quoted_client_total: 1200000,
        actual_income: 1000000,
        actual_expense: 200000,
        net_margin: 800000,
      },
    ],
    debtors: [
      {
        id: 41,
        voucher_no: "INV-202611-0001",
        doc_type: "invoice_ar",
        party_name: "Silverline Client",
        due_date: "2026-11-30",
        balance: 75000,
        status: "posted",
      },
    ],
    creditors: [],
  },
  trajectory: [
    { month: "2026-04", income: 1000000, expenses: 200000, drawings: 0, capital: 500000, net_profit: 800000 },
    { month: "2026-05", income: 500000, expenses: 100000, drawings: 150000, capital: 0, net_profit: 400000 },
  ],
  taxonomy: {
    entity: { id: 1, code: "VD-STUDIO", name: "Vision Division Studio", base_currency: "LKR" },
    fiscal_periods: [{ id: 11, period_code: "2026-11", period_name: "Nov 2026", status: "open" }],
  },
};

beforeAll(() => {
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  financeService.getWorkspaceInit.mockResolvedValue(SAMPLE_WORKSPACE_DATA);
  financeService.getTransactions.mockResolvedValue({ items: [], total: 1 });
});

describe("Phase 3 Finance Validators", () => {
  test("validateVoucherDate rejects calendar rollover dates and malformed inputs", () => {
    expect(validateVoucherDate("2026-11-12")).toBe("");
    expect(validateVoucherDate("2026-02-30")).toMatch(/valid calendar date/i);
    expect(validateVoucherDate("12/11/2026")).toMatch(/YYYY-MM-DD/i);
  });

  test("validateVoucherForm enforces scope integrity, prohibited XSS chars, and balanced journals", () => {
    const projectMissing = validateVoucherForm({
      doc_type: "expense",
      scope: "project",
      primary_project_id: "",
      tx_date: "2026-11-12",
      amount: "5000",
      description: "Camera Kit <script>",
    });
    expect(projectMissing.primary_project_id).toMatch(/project must be selected/i);
    expect(projectMissing.description).toMatch(/prohibited/i);

    const unbalancedJournal = validateVoucherForm({
      doc_type: "journal",
      scope: "company",
      tx_date: "2026-11-12",
      description: "Month-end accrual",
      lines: [
        { account_id: 6010, debit: 10000, credit: 0 },
        { account_id: 1020, debit: 0, credit: 8500 },
      ],
    });
    expect(unbalancedJournal.lines).toMatch(/equal Credits/i);
  });

  test("validateAccountForm & validateSettlementForm enforce code regex and overpayment limits", () => {
    const acctErrs = validateAccountForm({
      code: "50 10!",
      name: "Direct Film Cost",
      account_class: "cogs",
      normal_balance: "debit",
    });
    expect(acctErrs.code).toMatch(/letters, digits/i);
    expect(acctErrs.name).toBe("");

    const settleErrs = validateSettlementForm(
      { target_tx_id: 41, amount: "80000", settlement_date: "2026-11-12" },
      75000
    );
    expect(settleErrs.amount).toMatch(/remaining balance/i);
  });
});

const expectGlobalPageHeaderAboveShell = () => {
  expect(screen.getByText("Finance & Accounting")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
  const mainPane = screen.getByRole("main");
  expect(
    within(mainPane).queryByRole("heading", { level: 1 })
  ).not.toBeInTheDocument();
};

describe("Phase 3 FinanceWorkspace & OverviewBento", () => {
  test("renders full Admin Overview Bento with separated Income, Expenses, Drawings & Capital buckets", async () => {
    useAuth.mockReturnValue({
      user: { id: 1, username: "admin", role: "admin" },
      hasPermission: () => true,
    });

    render(<FinanceWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Accountable Buckets")).toBeInTheDocument();
    });

    // Global PageHeader sits at root above PageContentCard / main pane (matching AdminDashboard)
    expectGlobalPageHeaderAboveShell();

    const bucketsCard = screen.getByLabelText("Accountable Buckets");
    expect(within(bucketsCard).getByText("Income")).toBeInTheDocument();
    expect(within(bucketsCard).getByText("Expenses")).toBeInTheDocument();
    expect(within(bucketsCard).getByText("Drawings")).toBeInTheDocument();
    expect(within(bucketsCard).getByText("Capital")).toBeInTheDocument();
    expect(screen.getByText("Prologue IV")).toBeInTheDocument();
    expect(screen.getByText("Cashflow & P&L Performance")).toBeInTheDocument();

    // Clicking Drawings bucket switches lazily to Ledger & Records and loads drawing transactions
    fireEvent.click(within(bucketsCard).getByRole("button", { name: /Drawings/i }));
    await waitFor(() => {
      expect(financeService.getTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ doc_type: "drawing" })
      );
    });
  });

  test("hides Company, Personal, Drawings and Capital for users without finance.personal.view", async () => {
    useAuth.mockReturnValue({
      user: { id: 5, username: "pm_user", role: "manager" },
      hasPermission: (perm) => perm !== "finance.personal.view",
    });

    render(<FinanceWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Accountable Buckets")).toBeInTheDocument();
    });

    expectGlobalPageHeaderAboveShell();

    const bucketsCard = screen.getByLabelText("Accountable Buckets");
    expect(financeService.getWorkspaceInit).toHaveBeenCalledWith("project", "6M");
    expect(screen.queryByText("Company Finances")).not.toBeInTheDocument();
    expect(screen.queryByText("Personal Status")).not.toBeInTheDocument();
    expect(within(bucketsCard).queryByText("Drawings")).not.toBeInTheDocument();
    expect(within(bucketsCard).queryByText("Capital")).not.toBeInTheDocument();
  });
});

