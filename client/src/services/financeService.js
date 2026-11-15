import api, { handleApiError } from "./api";
import { API } from "../config";

const cleanParams = (params = {}) => {
  const cleaned = {};
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      cleaned[key] = val;
    }
  });
  return cleaned;
};

/**
 * Unified API service for the Vision Division double-entry Finance Workspace.
 * All payloads pass through `api` (automatic defense-in-depth sanitization + session cookies).
 */
export const financeService = {
  getWorkspaceInit: async (scope = "all", timeframe = "6M") => {
    try {
      const response = await api.get("/api/finance/workspace-init", {
        params: cleanParams({ scope, timeframe }),
      });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getTaxonomy: async () => {
    try {
      const response = await api.get("/api/finance/taxonomy");
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  createAccount: async (payload) => {
    try {
      const response = await api.post("/api/finance/accounts", payload);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  updateAccount: async (accountId, payload) => {
    try {
      const response = await api.put(`/api/finance/accounts/${accountId}`, payload);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  createCounterparty: async (payload) => {
    try {
      const response = await api.post("/api/finance/counterparties", payload);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  updateFiscalPeriodStatus: async (periodId, status) => {
    try {
      const response = await api.put(`/api/finance/fiscal-periods/${periodId}`, {
        status,
      });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getTransactions: async (filters = {}) => {
    try {
      const response = await api.get("/api/finance/transactions", {
        params: cleanParams(filters),
      });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getTransactionDetail: async (txId) => {
    try {
      const response = await api.get(`/api/finance/transactions/${txId}`);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  postVoucher: async (payload) => {
    try {
      const response = await api.post("/api/finance/transactions", payload);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  approvePostVoucher: async (txId) => {
    try {
      const response = await api.post(`/api/finance/transactions/${txId}/post`);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  voidVoucher: async (txId, voidReason) => {
    try {
      const response = await api.post(`/api/finance/transactions/${txId}/void`, {
        void_reason: voidReason,
      });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  createSettlement: async (payload) => {
    try {
      const response = await api.post("/api/finance/settlements", payload);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getGeneralLedger: async (filters = {}) => {
    try {
      const response = await api.get("/api/finance/ledger", {
        params: cleanParams(filters),
      });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getProjectFinances: async () => {
    try {
      const response = await api.get("/api/finance/projects");
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getProjectFinanceDetail: async (projectId) => {
    try {
      const response = await api.get(`/api/finance/projects/${projectId}`);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getCompanyFinances: async (filters = {}) => {
    try {
      const response = await api.get("/api/finance/company", {
        params: cleanParams(filters),
      });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getPersonalFinances: async (filters = {}) => {
    try {
      const response = await api.get("/api/finance/personal", {
        params: cleanParams(filters),
      });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getDebtorsCreditors: async (type = "all") => {
    try {
      const response = await api.get("/api/finance/debtors-creditors", {
        params: cleanParams({ type }),
      });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getFinancialReport: async (filters = {}) => {
    try {
      const response = await api.get("/api/finance/reports", {
        params: cleanParams(filters),
      });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getPrintViewUrl: (filters = {}) => {
    const query = new URLSearchParams(cleanParams(filters)).toString();
    const base = API || "";
    return `${base}/api/finance/reports/print-view${query ? `?${query}` : ""}`;
  },

  getFinanceTelemetry: async () => {
    try {
      const response = await api.get("/api/finance/telemetry");
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },
};

export default financeService;

