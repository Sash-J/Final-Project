import React, { useState, useEffect, useMemo, useCallback } from "react";
import Icon from "../../../components/common/Icon";
import NeoButton from "../../../components/common/NeoButton";
import ModalPortal from "../../../components/common/ModalPortal";
import FloatingInput from "../../../components/common/FloatingInput";
import FinanceSkeleton from "./FinanceSkeleton";
import { useFinance } from "../context/FinanceContext";
import { financeService } from "../../../services/financeService";
import { formatCurrency } from "../../../utils/currencyUtils";
import { sanitizeRealtime, sanitizeOnBlur } from "../../../utils/sanitizer";
import toast from "react-hot-toast";
import "./AccountsTaxonomyView.css";

const TAXONOMY_TABS = [
  { id: "accounts", label: "Chart of Accounts (GL)", icon: "account_tree" },
  { id: "bank_accounts", label: "Bank Accounts", icon: "account_balance" },
  { id: "fiscal_periods", label: "Fiscal Periods", icon: "date_range" },
  { id: "counterparties", label: "Counterparties", icon: "badge" },
];

const ACCOUNT_CLASSES = [
  { id: "all", label: "All Classes" },
  { id: "asset", label: "Assets (1000s)" },
  { id: "liability", label: "Liabilities (2000s)" },
  { id: "equity", label: "Equity (3000s)" },
  { id: "drawings", label: "Drawings (3020)" },
  { id: "income", label: "Revenue (4000s)" },
  { id: "cogs", label: "Direct Costs (5000s)" },
  { id: "expense", label: "Operating Expenses (6000s)" },
];

const AccountsTaxonomyView = () => {
  const { permissions, taxonomy, refreshWorkspace } = useFinance();

  const [activeTab, setActiveTab] = useState("accounts");
  const [classFilter, setClassFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [localTaxonomy, setLocalTaxonomy] = useState(taxonomy || null);
  const [loading, setLoading] = useState(false);

  // Account Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formClass, setFormClass] = useState("expense");
  const [formSubType, setFormSubType] = useState("");
  const [formNormalBalance, setFormNormalBalance] = useState("debit");
  const [formDescription, setFormDescription] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const loadFreshTaxonomy = useCallback(async () => {
    setLoading(true);
    try {
      const data = await financeService.getTaxonomy();
      if (data) {
        setLocalTaxonomy(data);
      }
    } catch (err) {
      toast.error("Failed to refresh Chart of Accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (taxonomy) {
      setLocalTaxonomy(taxonomy);
    }
  }, [taxonomy]);

  const allAccounts = useMemo(
    () => localTaxonomy?.accounts || [],
    [localTaxonomy]
  );
  const bankAccounts = useMemo(
    () => localTaxonomy?.bank_accounts || [],
    [localTaxonomy]
  );
  const fiscalPeriods = useMemo(
    () => localTaxonomy?.fiscal_periods || [],
    [localTaxonomy]
  );
  const counterparties = useMemo(
    () => localTaxonomy?.counterparties || [],
    [localTaxonomy]
  );

  const filteredAccounts = useMemo(() => {
    let list = allAccounts;
    if (classFilter !== "all") {
      list = list.filter((a) => a.account_class === classFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          String(a.code).toLowerCase().includes(q) ||
          String(a.name).toLowerCase().includes(q) ||
          String(a.sub_type || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [allAccounts, classFilter, searchQuery]);

  const openAddModal = () => {
    setEditingAccount(null);
    setFormCode("");
    setFormName("");
    setFormClass("expense");
    setFormSubType("");
    setFormNormalBalance("debit");
    setFormDescription("");
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (acc) => {
    setEditingAccount(acc);
    setFormCode(acc.code || "");
    setFormName(acc.name || "");
    setFormClass(acc.account_class || "expense");
    setFormSubType(acc.sub_type || "");
    setFormNormalBalance(acc.normal_balance || "debit");
    setFormDescription(acc.description || "");
    setFormErrors({});
    setModalOpen(true);
  };

  const handlePeriodStatusToggle = async (period) => {
    if (!permissions.canManageAccounts) {
      toast.error("Permission denied: cannot manage fiscal periods.");
      return;
    }
    const nextStatus =
      period.status === "open"
        ? "locked"
        : period.status === "locked"
        ? "closed"
        : "open";

    try {
      await financeService.updateFiscalPeriodStatus(period.id, nextStatus);
      toast.success(`Period ${period.period_code} marked as ${nextStatus}.`);
      await loadFreshTaxonomy();
      refreshWorkspace();
    } catch (err) {
      toast.error(err?.message || "Failed to update fiscal period status.");
    }
  };

  const handleSubmitAccount = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!formCode.trim()) errs.code = "Account code is required.";
    if (!formName.trim()) errs.name = "Account name is required.";
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: sanitizeOnBlur(formCode),
        name: sanitizeOnBlur(formName),
        account_class: formClass,
        sub_type: formSubType ? sanitizeOnBlur(formSubType) : undefined,
        normal_balance: formNormalBalance,
        description: formDescription ? sanitizeOnBlur(formDescription) : undefined,
      };

      if (editingAccount) {
        await financeService.updateAccount(editingAccount.id, payload);
        toast.success("Account updated successfully.");
      } else {
        await financeService.createAccount(payload);
        toast.success("Account created successfully.");
      }

      setModalOpen(false);
      await loadFreshTaxonomy();
      refreshWorkspace();
    } catch (err) {
      toast.error(err?.message || "Failed to save account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fin-accounts-view" data-testid="accounts-taxonomy-view">
      {/* Header */}
      <div className="fin-accounts-header">
        <div className="fin-accounts-title-wrap">
          <h2 className="fin-accounts-title">
            <Icon name="account_tree" size={24} />
            Chart of Accounts & Studio Taxonomy
          </h2>
          <p className="fin-accounts-subtitle">
            Statutory general ledger hierarchy, bank accounts, fiscal periods, and party directory.
          </p>
        </div>

        {permissions.canManageAccounts && activeTab === "accounts" && (
          <NeoButton
            variant="primary"
            size="small"
            onClick={openAddModal}
            data-testid="add-account-btn"
          >
            <Icon name="add" size={16} />
            Add Account
          </NeoButton>
        )}
      </div>

      {/* Tabs */}
      <div className="fin-accounts-tabs">
        {TAXONOMY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`fin-accounts-tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`taxonomy-tab-${tab.id}`}
          >
            <Icon name={tab.icon} size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content depending on activeTab */}
      {loading ? (
        <FinanceSkeleton rows={6} />
      ) : activeTab === "accounts" ? (
        <>
          {/* Toolbar */}
          <div className="fin-accounts-toolbar">
            <input
              type="text"
              className="fin-accounts-search-input"
              placeholder="Search code or account name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="accounts-search-input"
            />
            <select
              className="fin-accounts-filter-select"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              data-testid="accounts-class-select"
            >
              {ACCOUNT_CLASSES.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.label}
                </option>
              ))}
            </select>
          </div>

          {/* Table Card */}
          <div className="fin-accounts-table-card">
            <div className="fin-accounts-table-wrap">
              <table className="fin-accounts-table" data-testid="accounts-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account Name</th>
                    <th>Class</th>
                    <th>Sub-Type</th>
                    <th>Normal Balance</th>
                    <th>Status</th>
                    {permissions.canManageAccounts && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={permissions.canManageAccounts ? 7 : 6} className="text-center">
                        No accounts match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc) => (
                      <tr key={acc.id} data-testid={`account-row-${acc.code}`}>
                        <td className="fin-accounts-code">{acc.code}</td>
                        <td className="font-semibold">{acc.name}</td>
                        <td>
                          <span className={`fin-accounts-badge ${acc.account_class}`}>
                            {acc.account_class}
                          </span>
                        </td>
                        <td>{acc.sub_type || "-"}</td>
                        <td>{acc.normal_balance?.toUpperCase()}</td>
                        <td>
                          {acc.is_system ? (
                            <span className="fin-accounts-badge closed">System</span>
                          ) : (
                            <span className="fin-accounts-badge open">Active</span>
                          )}
                        </td>
                        {permissions.canManageAccounts && (
                          <td>
                            <NeoButton
                              variant="secondary"
                              size="small"
                              onClick={() => openEditModal(acc)}
                              data-testid={`edit-account-btn-${acc.code}`}
                            >
                              <Icon name="edit" size={14} />
                              Edit
                            </NeoButton>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : activeTab === "bank_accounts" ? (
        <div className="fin-accounts-table-card">
          <div className="fin-accounts-table-wrap">
            <table className="fin-accounts-table" data-testid="bank-accounts-table">
              <thead>
                <tr>
                  <th>Bank Name</th>
                  <th>Account Name</th>
                  <th>Account Number</th>
                  <th>Currency</th>
                  <th className="text-right">Opening Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bankAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center">
                      No bank accounts registered.
                    </td>
                  </tr>
                ) : (
                  bankAccounts.map((b) => (
                    <tr key={b.id}>
                      <td className="font-semibold">{b.bank_name}</td>
                      <td>{b.account_name}</td>
                      <td className="fin-accounts-code">{b.account_number}</td>
                      <td>{b.currency || "LKR"}</td>
                      <td className="text-right">
                        {formatCurrency(b.opening_balance || 0)}
                      </td>
                      <td>
                        <span className="fin-accounts-badge open">Active</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "fiscal_periods" ? (
        <div className="fin-accounts-table-card">
          <div className="fin-accounts-table-wrap">
            <table className="fin-accounts-table" data-testid="fiscal-periods-table">
              <thead>
                <tr>
                  <th>Period Code</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  {permissions.canManageAccounts && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {fiscalPeriods.length === 0 ? (
                  <tr>
                    <td colSpan={permissions.canManageAccounts ? 5 : 4} className="text-center">
                      No fiscal periods configured.
                    </td>
                  </tr>
                ) : (
                  fiscalPeriods.map((p) => (
                    <tr key={p.id}>
                      <td className="fin-accounts-code">{p.period_code}</td>
                      <td>{p.start_date}</td>
                      <td>{p.end_date}</td>
                      <td>
                        <span className={`fin-accounts-badge ${p.status}`}>
                          {p.status}
                        </span>
                      </td>
                      {permissions.canManageAccounts && (
                        <td>
                          <NeoButton
                            variant="secondary"
                            size="small"
                            onClick={() => handlePeriodStatusToggle(p)}
                            data-testid={`toggle-period-btn-${p.period_code}`}
                          >
                            <Icon
                              name={
                                p.status === "open"
                                  ? "lock"
                                  : p.status === "locked"
                                  ? "lock_clock"
                                  : "lock_open"
                              }
                              size={14}
                            />
                            {p.status === "open"
                              ? "Lock Period"
                              : p.status === "locked"
                              ? "Close Period"
                              : "Reopen"}
                          </NeoButton>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="fin-accounts-table-card">
          <div className="fin-accounts-table-wrap">
            <table className="fin-accounts-table" data-testid="counterparties-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Tax Number</th>
                  <th>Phone</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {counterparties.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center">
                      No counterparties registered.
                    </td>
                  </tr>
                ) : (
                  counterparties.map((c) => (
                    <tr key={c.id}>
                      <td className="font-semibold">{c.name}</td>
                      <td>
                        <span className="fin-accounts-badge income">
                          {c.party_type || "Vendor"}
                        </span>
                      </td>
                      <td>{c.tax_number || "-"}</td>
                      <td>{c.phone || "-"}</td>
                      <td>{c.email || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Account Add/Edit Modal */}
      {modalOpen && (
        <ModalPortal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
          <div className="fin-account-modal" data-testid="account-modal">
            <div className="fin-account-modal-header">
              <h3 className="fin-account-modal-title">
                <Icon name={editingAccount ? "edit" : "add_circle"} size={20} />
                {editingAccount ? `Edit Account: ${editingAccount.code}` : "Add Chart of Accounts Node"}
              </h3>
              <button
                type="button"
                className="fin-account-modal-close"
                onClick={() => setModalOpen(false)}
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitAccount} className="fin-account-form">
              <div className="fin-account-form-row">
                <FloatingInput
                  id="account-code-input"
                  data-testid="account-code-input"
                  label="Account Code (e.g. 5040)"
                  value={formCode}
                  onChange={(e) => setFormCode(sanitizeRealtime(e.target.value))}
                  error={formErrors.code}
                  required
                />
                <FloatingInput
                  id="account-name-input"
                  data-testid="account-name-input"
                  label="Account Name"
                  value={formName}
                  onChange={(e) => setFormName(sanitizeRealtime(e.target.value))}
                  error={formErrors.name}
                  required
                />
              </div>

              <div className="fin-account-form-row">
                <div className="fin-account-form-group">
                  <label className="fin-account-label">Account Class</label>
                  <select
                    className="fin-account-select"
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                    data-testid="account-class-select"
                  >
                    <option value="asset">Asset (1000s)</option>
                    <option value="liability">Liability (2000s)</option>
                    <option value="equity">Equity (3000s)</option>
                    <option value="drawings">Drawings (3020)</option>
                    <option value="income">Revenue (4000s)</option>
                    <option value="cogs">Direct Cost (5000s)</option>
                    <option value="expense">Operating Expense (6000s)</option>
                  </select>
                </div>

                <div className="fin-account-form-group">
                  <label className="fin-account-label">Normal Balance</label>
                  <select
                    className="fin-account-select"
                    value={formNormalBalance}
                    onChange={(e) => setFormNormalBalance(e.target.value)}
                    data-testid="account-normal-balance-select"
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
              </div>

              <FloatingInput
                id="account-subtype-input"
                data-testid="account-subtype-input"
                label="Sub-Type (optional, e.g. wardrobe, equipment, travel)"
                value={formSubType}
                onChange={(e) => setFormSubType(sanitizeRealtime(e.target.value))}
              />

              <FloatingInput
                id="account-description-input"
                data-testid="account-description-input"
                label="Description (optional)"
                value={formDescription}
                onChange={(e) => setFormDescription(sanitizeRealtime(e.target.value))}
              />

              <div className="fin-account-modal-footer">
                <NeoButton
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </NeoButton>
                <NeoButton
                  type="submit"
                  variant="primary"
                  size="small"
                  disabled={saving}
                  data-testid="save-account-btn"
                >
                  <Icon name="check" size={16} />
                  {saving ? "Saving..." : editingAccount ? "Update Account" : "Create Account"}
                </NeoButton>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default AccountsTaxonomyView;

