import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { financeService } from "../../../services/financeService";
import FinanceWorkspace from "../FinanceWorkspace";
import FinanceSkeleton from "../components/FinanceSkeleton";

const mockAuthState = {
  user: {
    id: 1,
    username: "admin",
    role: "admin",
    permissions: [
      "finance.view",
      "finance.personal.view",
      "finance.company.view",
      "finance.records.manage",
    ],
  },
  hasPermission: () => true,
  hasRole: () => true,
};

jest.mock("../../auth/context/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

jest.mock("../../../utils/webVitalsReporter", () => ({
  ...jest.requireActual("../../../utils/webVitalsReporter"),
  sendWebVitalMetric: jest.fn(),
}));

jest.mock("../../../components/common/Grainient", () => () => (
  <div data-testid="grainient-mock" />
));

jest.mock("../../../services/financeService", () => ({
  financeService: {
    getWorkspaceInit: jest.fn(),
    getTransactions: jest.fn(),
    getDebtorsCreditors: jest.fn(),
    getFinancialReport: jest.fn(),
    getTaxonomy: jest.fn(),
    getProjectScorecard: jest.fn(),
    getCompanyOverview: jest.fn(),
    getPersonalOverview: jest.fn(),
    getFinanceTelemetry: jest.fn(),
  },
}));

const MOCK_WORKSPACE_PAYLOAD = {
  scope: "all",
  timeframe: "6M",
  can_view_personal: true,
  summary: {
    total_income: 1500000,
    total_expenses: 1000000,
    net_profit: 500000,
    total_drawings: 50000,
    total_capital: 250000,
    cash_balance: 1240000,
    ar_balance: 450000,
    ap_balance: 120000,
    quoted_client_total: 2000000,
    total_collections: 1500000,
  },
  buckets: {
    income: { count: 4, total: 1500000 },
    expense: { count: 3, total: 1000000 },
    drawing: { count: 1, total: 50000 },
    capital: { count: 1, total: 250000 },
  },
  watchlist: {
    projects: [
      {
        id: 11,
        project_name: "Prologue IV",
        code_name: "THE FINAL WALK",
        status: "active",
        quoted_client_total: 1200000,
        actual_income: 1000000,
        actual_expense: 350000,
        net_margin: 650000,
      },
      {
        id: 12,
        project_name: "Midnight Heist",
        code_name: "TMH-01",
        status: "active",
        quoted_client_total: 800000,
        actual_income: 500000,
        actual_expense: 200000,
        net_margin: 300000,
      },
    ],
    debtors: [
      {
        id: 21,
        voucher_no: "AR-2027-01",
        doc_type: "invoice_ar",
        party_name: "Apex Films",
        due_date: "2027-12-30",
        total_amount: 450000,
        settled_amount: 0,
        balance: 450000,
        status: "posted",
      },
    ],
    creditors: [
      {
        id: 31,
        voucher_no: "AP-2027-09",
        doc_type: "bill_ap",
        party_name: "CineLight Rentals",
        due_date: "2027-12-22",
        total_amount: 120000,
        settled_amount: 0,
        balance: 120000,
        status: "posted",
      },
    ],
  },
  trajectory: [
    {
      month: "2027-10",
      income: 400000,
      expenses: 250000,
      net_profit: 150000,
      drawings: 0,
      capital: 0,
    },
    {
      month: "2027-11",
      income: 500000,
      expenses: 300000,
      net_profit: 200000,
      drawings: 25000,
      capital: 0,
    },
    {
      month: "2027-12",
      income: 600000,
      expenses: 450000,
      net_profit: 150000,
      drawings: 25000,
      capital: 250000,
    },
  ],
  taxonomy: {
    entity: { name: "Vision Division", code: "VD-STUDIO", currency: "LKR" },
    bank_accounts: [{ id: 1, name: "HNB Studio", opening_balance: 500000 }],
    fiscal_periods: [
      { id: 1, period_code: "2027-12", status: "open", is_current: true },
    ],
    accounts: [],
  },
};

describe("Finance Composite Bento Redesign", () => {
  beforeAll(() => {
    if (typeof global.ResizeObserver === "undefined") {
      global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
    if (typeof global.IntersectionObserver === "undefined") {
      global.IntersectionObserver = class IntersectionObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    financeService.getWorkspaceInit.mockResolvedValue(MOCK_WORKSPACE_PAYLOAD);
    financeService.getDebtorsCreditors.mockResolvedValue({ items: [] });
    financeService.getFinancialReport.mockResolvedValue({ sections: [] });
  });

  test("renders all 5 CompositeBentoCard slots, Treasury & Exposure card, and Watchlist drawer", async () => {
    render(<FinanceWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Treasury & Exposure")).toBeInTheDocument();
    });

    // All 5 CompositeBentoCard slots (Hero, Treasury, Buckets, Trajectory, Watchlist) mount Grainient layers
    expect(
      screen.getAllByTestId("grainient-mock").length
    ).toBeGreaterThanOrEqual(5);

    const treasuryCard = screen.getByLabelText("Treasury and Exposure");
    expect(within(treasuryCard).getByText("Liquid Cash")).toBeInTheDocument();
    expect(within(treasuryCard).getByText("Open AR / AP")).toBeInTheDocument();
    expect(within(treasuryCard).getByText(/Ratio/i)).toBeInTheDocument();

    expect(screen.getByLabelText("Financial Position")).toBeInTheDocument();
    expect(screen.getByLabelText("Accountable Buckets")).toBeInTheDocument();
    expect(screen.getByLabelText("Financial Watchlist")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Cashflow and P&L Trajectory")
    ).toBeInTheDocument();
    expect(screen.getByText("Decisions Powered by Data")).toBeInTheDocument();
  });

  test("switches KPI lens pills and navigates to Reports via Explore Reports CTA", async () => {
    render(<FinanceWorkspace />);

    await waitFor(() => {
      expect(screen.getByLabelText("Financial Position")).toBeInTheDocument();
    });

    const heroCard = screen.getByLabelText("Financial Position");
    const lensGroup = within(heroCard).getByRole("group", {
      name: "Metric lens",
    });

    fireEvent.click(within(lensGroup).getByRole("button", { name: "Cash" }));
    expect(within(heroCard).getByText("Liquid Cash")).toBeInTheDocument();
    expect(within(heroCard).getByText("Treasury Balance")).toBeInTheDocument();

    fireEvent.click(within(lensGroup).getByRole("button", { name: "Income" }));
    expect(within(heroCard).getByText("Total Income")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Explore Reports/i })
    );
    await waitFor(() => {
      expect(financeService.getFinancialReport).toHaveBeenCalled();
    });
  });

  test("filters trajectory via GlassDatePicker range inputs and clears cleanly", async () => {
    render(<FinanceWorkspace />);

    await waitFor(() => {
      expect(
        screen.getByLabelText("Fiscal date range filter")
      ).toBeInTheDocument();
    });

    const fromInput = screen.getByPlaceholderText("From date");
    const toInput = screen.getByPlaceholderText("To date");

    fireEvent.change(fromInput, { target: { value: "2027-11-01" } });
    fireEvent.change(toInput, { target: { value: "2027-12-31" } });

    expect(screen.getByText("Filtered Period Telemetry")).toBeInTheDocument();
    expect(screen.getByText(/across 2 active periods/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear date range" }));
    expect(screen.getByText("Monthly Income vs. Expenses")).toBeInTheDocument();
  });

  test("filters Watchlist across Projects, Debtors, and Creditors tabs", async () => {
    render(<FinanceWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Prologue IV")).toBeInTheDocument();
    });

    const quickInput = screen.getByLabelText("Filter watchlist");
    fireEvent.change(quickInput, { target: { value: "Midnight" } });

    expect(screen.getByText("Midnight Heist")).toBeInTheDocument();
    expect(screen.queryByText("Prologue IV")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Clear watchlist filter" })
    );
    expect(screen.getByText("Prologue IV")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Debtors" }));
    expect(screen.getByText("Apex Films")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Creditors" }));
    expect(screen.getByText("CineLight Rentals")).toBeInTheDocument();
  });

  test("toggles CashflowTrajectoryChart series/timeframes and opens GlassDatePicker calendar popover", async () => {
    render(<FinanceWorkspace />);

    await waitFor(() => {
      expect(
        screen.getByLabelText("Cashflow and P&L Trajectory")
      ).toBeInTheDocument();
    });

    const chartCard = screen.getByLabelText("Cashflow and P&L Trajectory");
    const expensesToggle = within(chartCard).getByRole("button", {
      name: "Expenses",
    });
    expect(expensesToggle).toHaveClass("is-active");
    fireEvent.click(expensesToggle);
    expect(expensesToggle).not.toHaveClass("is-active");

    const oneYearBtn = within(chartCard).getByRole("button", { name: "1Y" });
    fireEvent.click(oneYearBtn);
    await waitFor(() => {
      expect(financeService.getWorkspaceInit).toHaveBeenCalledWith("all", "1Y");
    });

    // Clicking From date opens GlassDatePicker portal calendar
    const fromInput = screen.getByPlaceholderText("From date");
    fireEvent.click(fromInput);
    expect(screen.getByText("Su")).toBeInTheDocument();
  });

  test("renders FinanceSkeleton overview and subview without errors", () => {
    const { rerender } = render(<FinanceSkeleton variant="overview" />);
    expect(
      screen.getByLabelText("Loading Finance Workspace")
    ).toBeInTheDocument();

    rerender(<FinanceSkeleton variant="subview" />);
    expect(screen.getByLabelText("Loading section")).toBeInTheDocument();
  });
});
