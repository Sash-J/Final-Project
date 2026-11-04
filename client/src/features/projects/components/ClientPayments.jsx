import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useProjects } from "../context/ProjectContext";
import { useAuth } from "../../auth/context/AuthContext";
import Icon from "../../../components/common/Icon";
import GlassDatePicker from "../../../components/common/GlassDatePicker";
import GlassDropdown from "../../../components/common/GlassDropdown";
import GlassSurface from "../../../components/effects/GlassSurface";
import HoverTooltip from "../../../components/common/HoverTooltip";
import FloatingInput from "../../../components/common/FloatingInput";
import { projectService } from "../../../services/projectService";
import PaymentReceiptModal from "./PaymentReceiptModal";
import { formatCurrency, getCurrencySymbol } from "../../../utils/currencyUtils";
import "./ClientPayments.css";

const PAYMENT_METHODS = [
  "Bank Transfer",
  "Wire Transfer",
  "Cheque",
  "Online Payment",
  "Cash",
];

const getTodayDateString = () => new Date().toISOString().split("T")[0];

const INITIAL_FORM_STATE = {
  description: "",
  amount: "",
  bank_ref: "",
  payment_method: "Bank Transfer",
  payment_date: getTodayDateString(),
  notes: "",
};

const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
};

const ClientPayments = ({ projectId }) => {
  const { user, hasRole } = useAuth();
  const {
    getProjectPayments,
    paymentsCache,
    paymentsLoading,
    recordPayment,
    updatePayment,
    detailsCache,
    getProjectDetails,
  } = useProjects();

  // Consolidated form state to eliminate 6 individual state re-render cascades
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [recording, setRecording] = useState(false);
  const [msg, setMsg] = useState(null);

  // Signatory State
  const [signatories, setSignatories] = useState([]);
  const [selectedSignatoryId, setSelectedSignatoryId] = useState("");

  // Selected payment for viewing/editing receipt
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState(null);

  const isClient = useMemo(() => hasRole(["client"]), [hasRole]);

  // Memoized cache selections to guarantee stable references
  const payments = useMemo(() => {
    const raw = projectId ? paymentsCache[projectId] || [] : [];
    if (isClient) {
      return raw.filter((p) => Boolean(p.published_to_client));
    }
    return raw;
  }, [paymentsCache, projectId, isClient]);

  const project = useMemo(
    () => (projectId ? detailsCache[projectId] || {} : {}),
    [detailsCache, projectId]
  );
  const isAdmin = useMemo(
    () => hasRole(["admin", "manager", "director", "accountant"]),
    [hasRole]
  );
  const currencySymbol = useMemo(() => getCurrencySymbol(), []);

  // Fetch payments and project details on mount or projectId change
  useEffect(() => {
    if (projectId) {
      getProjectPayments(projectId);
      if (getProjectDetails) {
        getProjectDetails(projectId);
      }
    }
  }, [projectId, getProjectPayments, getProjectDetails]);

  // Load eligible signatories once with clean unmount guard
  useEffect(() => {
    let isMounted = true;
    const loadSignatories = async () => {
      try {
        const list = await projectService.getFinanceSignatories();
        if (isMounted && Array.isArray(list)) {
          setSignatories(list);
        }
      } catch (err) {
        console.error("Failed to load signatories:", err);
      }
    };
    loadSignatories();
    return () => {
      isMounted = false;
    };
  }, []);

  // Default select current user if eligible, or first signatory
  useEffect(() => {
    if (signatories.length > 0 && !selectedSignatoryId) {
      const me = signatories.find((s) => s.id === user?.id);
      setSelectedSignatoryId(me ? me.id : signatories[0].id);
    }
  }, [signatories, user, selectedSignatoryId]);

  // O(1) Fast Signatory Lookup Map
  const signatoriesById = useMemo(
    () => new Map(signatories.map((s) => [Number(s.id), s])),
    [signatories]
  );

  // Memoized dropdown options to prevent re-rendering every table row dropdown on keystroke
  const signatoryOptions = useMemo(
    () =>
      signatories.map((s) => ({
        value: s.id,
        label: `${s.full_name || s.username} - ${s.role_name || "Signatory"}`,
      })),
    [signatories]
  );

  // Total paid sum computation
  const totalPaid = useMemo(
    () => payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
    [payments]
  );

  // Consolidated form field change handler
  const handleFormFieldChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMsg(null);
  }, []);

  // Table row signatory change handler
  const handleTableSignatoryChange = useCallback(
    async (paymentItem, newSignatoryId) => {
      const chosen = signatoriesById.get(Number(newSignatoryId));
      if (!chosen) return;

      await updatePayment(projectId, paymentItem.id, {
        signatory_id: chosen.id,
        signatory_name: chosen.full_name || chosen.username,
        signatory_role: chosen.role_name,
      });
    },
    [signatoriesById, updatePayment, projectId]
  );

  // Stable receipt modal callbacks
  const handleSelectReceipt = useCallback((payment) => {
    setSelectedReceiptPayment(payment);
  }, []);

  const handleCloseReceipt = useCallback(() => {
    setSelectedReceiptPayment(null);
  }, []);

  const handleReceiptUpdate = useCallback(
    (updated) => {
      setSelectedReceiptPayment(updated);
      getProjectPayments(projectId, true);
    },
    [projectId, getProjectPayments]
  );

  // Form submit handler with validation and automatic receipt opening
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const parsedAmount = parseFloat(form.amount);
      if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0 || !form.payment_date) {
        setMsg({
          type: "error",
          text: "Please provide a valid payment amount and date.",
        });
        return;
      }

      setRecording(true);
      setMsg(null);

      const chosenSignatory = signatoriesById.get(Number(selectedSignatoryId));

      const payload = {
        amount: parsedAmount,
        payment_date: form.payment_date,
        description: form.description.trim() || "Client Payment",
        bank_ref: form.bank_ref.trim(),
        payment_method: form.payment_method,
        notes: form.notes.trim(),
        signatory_id: chosenSignatory ? chosenSignatory.id : null,
        signatory_name: chosenSignatory
          ? chosenSignatory.full_name || chosenSignatory.username
          : null,
        signatory_role: chosenSignatory ? chosenSignatory.role_name : null,
      };

      const result = await recordPayment(projectId, payload);

      if (result.success) {
        setMsg({ type: "success", text: "Payment recorded successfully!" });

        // Automatically construct and open receipt for internal review first
        setSelectedReceiptPayment({
          id: result.id,
          ...payload,
          published_to_client: 0,
          status: "Completed",
        });

        // Reset form
        setForm({
          ...INITIAL_FORM_STATE,
          payment_date: getTodayDateString(),
        });
      } else {
        setMsg({
          type: "error",
          text: result.error || "Failed to record payment",
        });
      }
      setRecording(false);
    },
    [form, selectedSignatoryId, signatoriesById, recordPayment, projectId]
  );

  return (
    <div className="client-payments-root">
      {/* Overview Stat Cards */}
      <div className="payments-overview-grid">
        <div className="payment-stat-card glass-card">
          <div className="stat-icon-wrap received">
            <Icon name="payments" modifiers="md" />
          </div>
          <div className="stat-content">
            <label>Total Received</label>
            <h3>{formatCurrency(totalPaid)}</h3>
          </div>
        </div>
        <div className="payment-stat-card glass-card">
          <div className="stat-icon-wrap pending">
            <Icon name="account_balance_wallet" modifiers="md" />
          </div>
          <div className="stat-content">
            <label>Outstanding Balance</label>
            <h3 className={project.balance > 0 ? "warning-text" : "success-text"}>
              {formatCurrency(project.balance || 0)}
            </h3>
          </div>
        </div>
      </div>

      <div className="payments-main-layout">
        {/* Payment History Panel */}
        <div className="payment-history-panel glass-card">
          <div className="panel-header">
            <h3>Payment History</h3>
            <span className="count-badge">{payments.length} Records</span>
          </div>

          {paymentsLoading && payments.length === 0 ? (
            <div className="payments-loading">
              <div className="spinner-simple" />
              <span>Loading records...</span>
            </div>
          ) : payments.length === 0 ? (
            <div className="empty-payments">
              <Icon name="history" modifiers="lg" />
              <p>No payments recorded yet.</p>
            </div>
          ) : (
            <div className="payment-list-table-wrap">
              <table className="payment-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description &amp; Reference</th>
                    <th>Publishing</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Authorizing User</th>
                    <th className="text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const hasExtraNotes = Boolean(
                      p.notes && p.description && p.notes !== p.description
                    );

                    return (
                      <tr key={p.id} className="payment-row">
                        <td className="date-cell">{formatDate(p.payment_date)}</td>
                        <td className="notes-cell">
                          <div className="payment-desc-title">
                            {p.description || p.notes || "Client Payment"}
                          </div>
                          <div className="payment-sub-meta">
                            {p.bank_ref && (
                              <span className="payment-ref-code">
                                Ref: {p.bank_ref}
                              </span>
                            )}
                            {hasExtraNotes && (
                              <span className="payment-extra-notes">{p.notes}</span>
                            )}
                          </div>
                        </td>
                        <td className="status-cell">
                          <HoverTooltip
                            content={
                              p.published_to_client
                                ? `Published to client portal${p.published_at
                                  ? ` on ${formatDate(p.published_at)}`
                                  : ""
                                }`
                                : "Internal draft — not yet released to client portal"
                            }
                            placement="top"
                          >
                            <span
                              className={`payment-pub-badge ${p.published_to_client
                                  ? "is-published"
                                  : "is-draft"
                                }`}
                            >
                              <Icon
                                name={
                                  p.published_to_client
                                    ? "cloud_done"
                                    : "cloud_off"
                                }
                                modifiers="xs"
                              />
                              <span>
                                {p.published_to_client ? "Published" : "Draft"}
                              </span>
                            </span>
                          </HoverTooltip>
                        </td>
                        <td className="method-cell">
                          <span className="payment-method-pill">
                            {p.payment_method || "Bank Transfer"}
                          </span>
                        </td>
                        <td className="amount-cell">{formatCurrency(p.amount)}</td>
                        <td className="signatory-cell">
                          {isAdmin ? (
                            <GlassDropdown
                              options={signatoryOptions}
                              value={p.signatory_id}
                              onChange={(val) => handleTableSignatoryChange(p, val)}
                              placeholder="Select Signatory..."
                              modifiers="sm fluid"
                              className="table-signatory-dropdown"
                            />
                          ) : (
                            <div className="signatory-badge-wrap">
                              <Icon name="verified" modifiers="xs" />
                              <span className="signatory-badge-name">
                                {p.signatory_name || "Authorized"}
                              </span>
                              {p.signatory_role && (
                                <span className="signatory-badge-role">
                                  ({p.signatory_role})
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="action-cell text-center">
                          <GlassSurface
                            className="btn-receipt-action"
                            width="max-content"
                            height="auto"
                            borderRadius={30}
                            blur={10}
                            opacity={0.4}
                            backgroundOpacity={0.2}
                            onClick={() => handleSelectReceipt(p)}
                          >
                            <HoverTooltip
                              text="View official payment confirmation receipt"
                              wrapperClassName="receipt-action-tooltip-wrapper"
                            >
                              <div className="receipt-action-content">
                                <div className="receipt-action-icon">
                                  <Icon name="receipt_long" modifiers="sm" />
                                </div>
                                <span className="receipt-action-text">Receipt</span>
                              </div>
                            </HoverTooltip>
                          </GlassSurface>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Record New Payment Panel (Admin / Director / Manager only) */}
        {isAdmin && (
          <div className="record-payment-panel glass-card">
            <h3>Record New Payment</h3>
            <p className="panel-subtext">Add a client payment to the ledger.</p>

            {msg && (
              <div className="neo-status-messages payment-status-wrap">
                <div className={`neo-status ${msg.type} show`}>
                  <Icon
                    name={msg.type === "success" ? "check_circle" : "error"}
                    modifiers="sm"
                  />
                  <span>{msg.text}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="neo-form">
              <FloatingInput
                label="Payment Description / Milestone"
                placeholder="e.g. Initial Milestone Advance"
                required
                value={form.description}
                onChange={(e) => handleFormFieldChange("description", e.target.value)}
              />

              <FloatingInput
                type="number"
                step="0.01"
                label={`Amount (${currencySymbol})`}
                prefix={currencySymbol}
                placeholder="0.00"
                required
                value={form.amount}
                onChange={(e) => handleFormFieldChange("amount", e.target.value)}
              />

              <div className="payment-form-row">
                <FloatingInput
                  as="select"
                  label="Payment Method"
                  value={form.payment_method}
                  onChange={(e) => handleFormFieldChange("payment_method", e.target.value)}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </FloatingInput>

                <FloatingInput
                  label="Bank Ref / Slip #"
                  placeholder="e.g. TXN-8823901"
                  value={form.bank_ref}
                  onChange={(e) => handleFormFieldChange("bank_ref", e.target.value)}
                />
              </div>

              <FloatingInput
                label="Payment Date"
                hasValue={Boolean(form.payment_date)}
                required
              >
                <GlassDatePicker
                  value={form.payment_date}
                  onChange={(val) => handleFormFieldChange("payment_date", val)}
                  required
                />
              </FloatingInput>

              <FloatingInput
                label="Authorizing User / Signatory"
                hasValue={Boolean(selectedSignatoryId)}
              >
                <GlassDropdown
                  options={signatoryOptions}
                  value={selectedSignatoryId}
                  onChange={(val) => setSelectedSignatoryId(val)}
                  placeholder="Select Authorizing Signatory..."
                  modifiers="fluid"
                />
              </FloatingInput>

              <FloatingInput
                as="textarea"
                label="Reference / Notes"
                placeholder="e.g. Direct transfer to studio corporate account"
                rows={2}
                value={form.notes}
                onChange={(e) => handleFormFieldChange("notes", e.target.value)}
              />

              <button
                type="submit"
                className="btn-neo btn-neo-solid btn-capture-submit"
                disabled={recording}
              >
                <Icon name="verified" modifiers="sm" />
                <span>{recording ? "Recording..." : "Capture Payment"}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Payment Confirmation & Receipt Modal */}
      {selectedReceiptPayment && (
        <PaymentReceiptModal
          payment={selectedReceiptPayment}
          project={project}
          canEdit={isAdmin}
          onClose={handleCloseReceipt}
          onUpdate={handleReceiptUpdate}
        />
      )}
    </div>
  );
};

export default ClientPayments;
