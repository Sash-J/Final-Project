import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  validateVoucherForm,
  validateSettlementForm,
} from "../../../utils/validators";
import { financeService } from "../../../services/financeService";
import { useAuth } from "../../auth/context/AuthContext";
import { FinanceProvider } from "../context/FinanceContext";
import TransactionModal from "../components/TransactionModal";
import ProjectFinancesView from "../components/ProjectFinancesView";
import CompanyFinancesView from "../components/CompanyFinancesView";
import PersonalFinancesView from "../components/PersonalFinancesView";
import TransactionsLedgerView from "../components/TransactionsLedgerView";
import DebtorsCreditorsView from "../components/DebtorsCreditorsView";

jest.mock("../../../components/common/Grainient", () => () => (
  <div data-testid="grainient-mock" />
));

jest.mock("../../../services/financeService", () => ({
  __esModule: true,
  financeService: {
    getWorkspaceInit: jest.fn(),
    getTransactions: jest.fn(),
    getTransactionDetail: jest.fn(),
    postVoucher: jest.fn(),
    approvePostVoucher: jest.fn(),
    voidVoucher: jest.fn(),
    createSettlement: jest.fn(),
    getProjectFinances: jest.fn(),
    getProjectFinanceDetail: jest.fn(),
    getCompanyFinances: jest.fn(),
    getPersonalFinances: jest.fn(),
    getDebtorsCreditors: jest.fn(),
    getFinancialReport: jest.fn(),
    getTaxonomy: jest.fn(),
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
  taxonomy: {
    entity: { name: "Vision Division Studio", code: "VD-STUDIO", base_currency: "LKR" },
    projects: [
      { id: 16, project_name: "Prologue IV", code_name: "THE FINAL WALK", client_name: "Sony Pictures", status: "active" },
      { id: 18, project_name: "Midnight Heist", code_name: "TMH-01", client_name: "Netflix", status: "completed" },
    ],
    users: [
      { id: 1, full_name: "Admin User", username: "admin", role: "admin" },
      { id: 4, full_name: "Umaria Singha", username: "umaria", role: "producer" },
    ],
    bank_accounts: [
      { id: 1, bank_name: "Commercial Bank", account_name: "Studio Operations", current_balance: 1200000, currency: "LKR" },
      { id: 2, bank_name: "Petty Cash", account_name: "Vault Safe", current_balance: 350000, currency: "LKR" },
    ],
    fiscal_periods: [{ id: 1, period_code: "2026-11", status: "open" }],
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

describe("Phase 4 Interactive Finance Workflows", () => {
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
  });

  beforeEach(() => {
    jest.clearAllMocks();
    financeService.getWorkspaceInit.mockResolvedValue(MOCK_WORKSPACE_DATA);
  });

  describe("1. Validators for Phase 4 Forms", () => {
    test("validateSettlementForm checks target, amount, remaining bounds, and date", () => {
      const errEmpty = validateSettlementForm({});
      expect(errEmpty.target_tx_id).toBeTruthy();
      expect(errEmpty.amount).toBeTruthy();
      expect(errEmpty.settlement_date).toBeTruthy();

      // Amount exceeds remaining balance
      const errExceed = validateSettlementForm(
        { target_tx_id: 10, amount: "5500", settlement_date: "2026-11-13" },
        5000
      );
      expect(errExceed.amount).toContain("cannot exceed remaining balance");

      // Valid settlement
      const valid = validateSettlementForm(
        { target_tx_id: 10, amount: "4500", settlement_date: "2026-11-13", bank_ref: "FT-99" },
        5000
      );
      expect(valid.amount).toBe("");
      expect(valid.settlement_date).toBe("");
      expect(valid.target_tx_id).toBe("");
    });

    test("validateVoucherForm validates required project for project scope", () => {
      const err = validateVoucherForm({
        doc_type: "expense",
        scope: "project",
        primary_project_id: "",
        amount: "1500",
        tx_date: "2026-11-13",
      });
      expect(err.primary_project_id).toContain("A project must be selected");
    });
  });

  describe("2. TransactionModal Voucher Entry", () => {
    test("renders modal with presets and submits expense voucher", async () => {
      financeService.postVoucher.mockResolvedValue({ id: 99, voucher_no: "VCH-202611-0099" });

      renderWithFinance(
        <TransactionModal
          isOpen={true}
          initialPreset={{ doc_type: "expense", scope: "project", project_id: 16 }}
          onClose={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("transaction-modal-form")).toBeInTheDocument();
      });

      // Fill in amount
      const amountInput = screen.getByTestId("tx-amount-input");
      fireEvent.change(amountInput, { target: { value: "25000" } });

      // Fill in description
      const descInput = screen.getByTestId("tx-description-input");
      fireEvent.change(descInput, { target: { value: "Sound equipment rental" } });

      // Submit form
      const form = screen.getByTestId("transaction-modal-form");
      fireEvent.submit(form);

      await waitFor(() => {
        expect(financeService.postVoucher).toHaveBeenCalledWith(
          expect.objectContaining({
            doc_type: "expense",
            scope: "project",
            primary_project_id: 16,
            amount: 25000,
            description: "Sound equipment rental",
          })
        );
      });
    });
  });

  describe("3. ProjectFinancesView & ProjectLedgerDrawer", () => {
    test("renders project scorecards, searches, and opens details drawer", async () => {
      financeService.getProjectFinances.mockResolvedValue({
        projects: [
          {
            id: 16,
            project_name: "Prologue IV",
            code_name: "THE FINAL WALK",
            client_name: "Sony Pictures",
            status: "active",
            quoted_client_total: 2000000,
            budgeted_direct_cost: 1200000,
            actual_income: 1500000,
            actual_expense: 450000,
            actual_net_margin: 1050000,
            budget_variance: 750000,
            payments_received: 1500000,
          },
        ],
      });

      financeService.getProjectFinanceDetail.mockResolvedValue({
        project: {
          id: 16,
          project_name: "Prologue IV",
          code_name: "THE FINAL WALK",
          client_name: "Sony Pictures",
          status: "active",
          quoted_client_total: 2000000,
          budgeted_direct_cost: 1200000,
          actual_income: 1500000,
          actual_expense: 450000,
          actual_net_margin: 1050000,
          budget_variance: 750000,
          payments_received: 1500000,
        },
        department_variance: [
          { department_id: 1, department_name: "Camera", budgeted_cost: 400000, actual_expense: 150000 },
        ],
        personal_statuses: [
          { user_id: 4, full_name: "Umaria Singha", role: "producer", incurred_fees: 100000, payable_balance: 0 },
        ],
      });

      renderWithFinance(<ProjectFinancesView />);

      await waitFor(() => {
        expect(screen.getByTestId("project-finances-view")).toBeInTheDocument();
      });

      // Check scorecard name
      expect(screen.getByText("Prologue IV")).toBeInTheDocument();

      // Open drawer
      const inspectBtn = screen.getByRole("button", { name: /inspect details/i });
      fireEvent.click(inspectBtn);

      await waitFor(() => {
        expect(screen.getByTestId("project-ledger-drawer")).toBeInTheDocument();
      });
      expect(screen.getByText("Camera")).toBeInTheDocument();
    });
  });

  describe("4. CompanyFinancesView", () => {
    test("restricts access for unauthorized non-personal roles", async () => {
      renderWithFinance(<CompanyFinancesView />, "crew");

      await waitFor(() => {
        expect(screen.getByTestId("company-finances-restricted")).toBeInTheDocument();
      });
    });

    test("renders bank accounts and overhead ledger for authorized admin", async () => {
      financeService.getCompanyFinances.mockResolvedValue({
        bank_accounts: [
          { id: 1, bank_name: "Commercial Bank", account_name: "Studio Operations", current_balance: 1200000, currency: "LKR" },
        ],
        summary: {
          total_cash: 1200000,
          company_overhead: 180000,
          company_income: 50000,
          company_net_operating: -130000,
          owner_capital: 500000,
          owner_drawings: 100000,
          net_liquidity: 1200000,
        },
        breakdown: [
          { code: "6010", name: "Studio Office Rent", net_expense: 120000 },
        ],
      });

      renderWithFinance(<CompanyFinancesView />, "admin");

      await waitFor(() => {
        expect(screen.getByTestId("company-finances-view")).toBeInTheDocument();
      });
      expect(screen.getByText("Commercial Bank")).toBeInTheDocument();
      expect(screen.getByText("Studio Office Rent")).toBeInTheDocument();
    });
  });

  describe("5. PersonalFinancesView", () => {
    test("renders stakeholder cards and by-project breakdown", async () => {
      financeService.getPersonalFinances.mockResolvedValue({
        people: [
          { user_id: 1, full_name: "Sashen Jayasinghe", username: "sashen", role: "director", capital_contributed: 500000, drawings_taken: 100000 },
          { user_id: 4, full_name: "Umaria Singha", username: "umaria", role: "producer", fees_incurred: 150000, payables_unpaid: 30000 },
        ],
        by_project: [
          { user_id: 4, full_name: "Umaria Singha", project_code: "THE FINAL WALK", project_name: "Prologue IV", fees_incurred: 150000, payables_unpaid: 30000 },
        ],
      });

      renderWithFinance(<PersonalFinancesView />, "admin");

      await waitFor(() => {
        expect(screen.getByTestId("personal-finances-view")).toBeInTheDocument();
      });
      expect(screen.getByText("Sashen Jayasinghe")).toBeInTheDocument();
      expect(screen.getByText("Umaria Singha")).toBeInTheDocument();

      // Toggle by-project section
      const toggleBtn = screen.getByRole("button", { name: /show project breakdown/i });
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        expect(screen.getByTestId("personal-by-project-section")).toBeInTheDocument();
      });
    });
  });

  describe("6. TransactionsLedgerView & VoucherDetailModal", () => {
    test("lists vouchers and opens detail modal with inspect button", async () => {
      financeService.getTransactions.mockResolvedValue({
        items: [
          {
            id: 101,
            voucher_no: "VCH-202611-0101",
            doc_type: "expense",
            scope: "project",
            tx_date: "2026-11-13",
            total_amount: 45000,
            balance: 0,
            status: "posted",
            project_name: "Prologue IV",
            project_code: "THE FINAL WALK",
          },
        ],
        pagination: { page: 1, per_page: 20, total: 1 },
      });

      financeService.getTransactionDetail.mockResolvedValue({
        transaction: {
          id: 101,
          voucher_no: "VCH-202611-0101",
          doc_type: "expense",
          scope: "project",
          tx_date: "2026-11-13",
          total_amount: 45000,
          balance: 0,
          status: "posted",
          description: "Camera equipment lease",
        },
        lines: [
          { id: 1, line_no: 1, account_code: "5010", account_name: "Equipment Direct Cost", debit: 45000, credit: 0 },
        ],
        ledger_entries: [],
        attachments: [],
        audit_logs: [],
      });

      renderWithFinance(<TransactionsLedgerView />);

      expect(await screen.findByText("VCH-202611-0101")).toBeInTheDocument();

      // Click inspect button
      const inspectBtn = screen.getByRole("button", { name: /inspect/i });
      fireEvent.click(inspectBtn);

      expect(await screen.findByText("Camera equipment lease")).toBeInTheDocument();
    });
  });

  describe("7. DebtorsCreditorsView & SettlementModal", () => {
    test("displays open AR items and opens settlement modal", async () => {
      financeService.getDebtorsCreditors.mockResolvedValue({
        debtors: [
          {
            id: 202,
            voucher_no: "INV-202611-001",
            doc_type: "invoice_ar",
            counterparty_name: "Sony Pictures",
            total_amount: 500000,
            settled_amount: 200000,
            balance: 300000,
            due_date: "2026-11-20",
            days_past_due: 0,
          },
        ],
        creditors: [],
        project_contract_receivables: [
          { project_id: 16, project_name: "Prologue IV", code_name: "THE FINAL WALK", client_name: "Sony", quoted_client_total: 2000000, total_paid: 1500000, contract_balance: 500000 },
        ],
        aging: {
          debtors: { current: 300000, days_1_30: 0, days_31_60: 0, days_60_plus: 0, total: 300000 },
          creditors: { current: 0, days_1_30: 0, days_31_60: 0, days_60_plus: 0, total: 0 },
        },
      });

      financeService.createSettlement.mockResolvedValue({ id: 501, status: "posted" });

      renderWithFinance(<DebtorsCreditorsView />);

      expect(await screen.findByText("Sony Pictures")).toBeInTheDocument();
      expect(screen.getByTestId("contracts-receivables-section")).toBeInTheDocument();

      // Open settlement modal
      const settleBtn = screen.getByRole("button", { name: /settle/i });
      fireEvent.click(settleBtn);

      await waitFor(() => {
        expect(screen.getByTestId("settlement-modal-form")).toBeInTheDocument();
      });

      // Post settlement
      const submitBtn = screen.getByRole("button", { name: /post settlement/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(financeService.createSettlement).toHaveBeenCalledWith(
          expect.objectContaining({
            target_tx_id: 202,
            amount: 300000,
          })
        );
      });
    });
  });
});
