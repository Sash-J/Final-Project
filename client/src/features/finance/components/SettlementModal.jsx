import React, { useState, useEffect, useMemo } from "react";
import ModalPortal from "../../../components/common/ModalPortal";
import FloatingInput from "../../../components/common/FloatingInput";
import GlassDatePicker from "../../../components/common/GlassDatePicker";
import NeoButton from "../../../components/common/NeoButton";
import { formatCurrency } from "../../../utils/currencyUtils";
import { validateSettlementForm } from "../../../utils/validators";
import { sanitizeRealtime, sanitizeOnBlur } from "../../../utils/sanitizer";
import { financeService } from "../../../services/financeService";
import { useFinance } from "../context/FinanceContext";
import toast from "react-hot-toast";
import "./SettlementModal.css";

const PAYMENT_METHODS = [
  { id: "Bank Transfer", label: "Bank Transfer" },
  { id: "Cash", label: "Cash / Petty Cash" },
  { id: "Cheque", label: "Cheque" },
  { id: "Debit / Credit Card", label: "Card" },
];

const getTodayIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const SettlementModal = ({
  isOpen = false,
  targetTx = null,
  onClose,
  onSuccess,
}) => {
  const { taxonomy, refreshWorkspace } = useFinance();
  const bankAccounts = useMemo(() => taxonomy?.bank_accounts || [], [taxonomy?.bank_accounts]);

  const [amount, setAmount] = useState("");
  const [settlementDate, setSettlementDate] = useState(getTodayIso());
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (targetTx) {
      setAmount(targetTx.balance ? String(targetTx.balance) : "");
      setSettlementDate(getTodayIso());
      setPaymentMethod(targetTx.payment_method || "Bank Transfer");
      setBankAccountId(bankAccounts[0]?.id ? String(bankAccounts[0].id) : "");
      setBankRef("");
      setNotes("");
      setErrors({});
    }
  }, [targetTx, bankAccounts]);

  if (!isOpen || !targetTx) return null;

  const isAR = targetTx.doc_type === "invoice_ar";
  const partyName = targetTx.counterparty_name || targetTx.person_name || "Counterparty";
  const balance = Number(targetTx.balance || 0);

  const handleSubmit = async (e) => {
    e?.preventDefault();

    const form = {
      target_tx_id: targetTx.id,
      amount,
      settlement_date: settlementDate,
      bank_ref: bankRef,
    };

    const validation = validateSettlementForm(form, balance);
    const hasErr = Object.values(validation).some((msg) => Boolean(msg));
    if (hasErr) {
      setErrors(validation);
      return;
    }

    setSubmitting(true);
    try {
      await financeService.createSettlement({
        target_tx_id: targetTx.id,
        amount: parseFloat(amount),
        settlement_date: settlementDate,
        payment_method: paymentMethod,
        bank_account_id: bankAccountId ? parseInt(bankAccountId, 10) : null,
        bank_ref: bankRef.trim(),
        notes: notes.trim(),
      });

      toast.success(
        `Allocated ${formatCurrency(amount)} against ${targetTx.voucher_no || "item"}.`
      );

      if (refreshWorkspace) refreshWorkspace();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to post settlement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal
      isOpen={isOpen}
      onClose={onClose}
      title={isAR ? "Receive Client Payment (AR Settlement)" : "Disburse Vendor Payment (AP Settlement)"}
      size="medium"
      className="fin-stl-modal"
    >
      <form onSubmit={handleSubmit} className="fin-stl-form" data-testid="settlement-modal-form">
        {/* Target Document Summary Box */}
        <div className="fin-stl-summary-card">
          <div className="fin-stl-summary-header">
            <span className="fin-stl-badge">
              {isAR ? "Client Receivable" : "Vendor Payable"}
            </span>
            <span className="fin-stl-vch-code">{targetTx.voucher_no}</span>
          </div>

          <div className="fin-stl-party-row">
            <span className="fin-stl-party-label">Counterparty:</span>
            <strong className="fin-stl-party-val">{partyName}</strong>
          </div>

          <div className="fin-stl-amounts-grid">
            <div className="fin-stl-amount-cell">
              <span className="fin-stl-label">Original Total</span>
              <span className="fin-stl-val">
                {formatCurrency(targetTx.total_amount, targetTx.currency_code || "LKR")}
              </span>
            </div>
            <div className="fin-stl-amount-cell">
              <span className="fin-stl-label">Already Settled</span>
              <span className="fin-stl-val">
                {formatCurrency(targetTx.settled_amount || 0, targetTx.currency_code || "LKR")}
              </span>
            </div>
            <div className="fin-stl-amount-cell highlight">
              <span className="fin-stl-label">Remaining Balance</span>
              <span className="fin-stl-val bold">
                {formatCurrency(balance, targetTx.currency_code || "LKR")}
              </span>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="fin-stl-fields">
          <div className="fin-stl-amount-field-wrapper">
            <FloatingInput
              id="stl-amount"
              label="Settlement Amount *"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(sanitizeRealtime(e.target.value));
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: "" }));
              }}
              onBlur={(e) => setAmount(sanitizeOnBlur(e.target.value))}
              error={errors.amount}
            />
            <span className="fin-stl-helper">Max remaining balance: {formatCurrency(balance)}</span>
          </div>

          <GlassDatePicker
            id="stl-date"
            label="Settlement Date *"
            value={settlementDate}
            onChange={(val) => {
              setSettlementDate(val);
              if (errors.settlement_date) {
                setErrors((prev) => ({ ...prev, settlement_date: "" }));
              }
            }}
            error={errors.settlement_date}
          />

          <div className="fin-stl-row-2">
            <div className="fin-stl-select-group">
              <label htmlFor="stl-method" className="fin-stl-select-label">
                Payment Method
              </label>
              <select
                id="stl-method"
                className="fin-stl-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="fin-stl-select-group">
              <label htmlFor="stl-bank" className="fin-stl-select-label">
                Treasury / Bank Account
              </label>
              <select
                id="stl-bank"
                className="fin-stl-select"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name || "Treasury"} - {b.account_name} ({formatCurrency(b.current_balance || 0)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <FloatingInput
            id="stl-ref"
            label="Bank Reference / Cheque #"
            value={bankRef}
            onChange={(e) => {
              setBankRef(sanitizeRealtime(e.target.value));
              if (errors.bank_ref) setErrors((prev) => ({ ...prev, bank_ref: "" }));
            }}
            onBlur={(e) => setBankRef(sanitizeOnBlur(e.target.value))}
            error={errors.bank_ref}
            placeholder="e.g. FT-202611-0987"
          />

          <FloatingInput
            id="stl-notes"
            label="Allocation Notes"
            value={notes}
            onChange={(e) => setNotes(sanitizeRealtime(e.target.value))}
            onBlur={(e) => setNotes(sanitizeOnBlur(e.target.value))}
            placeholder="e.g. Partial remittance for Phase 1 milestone"
          />
        </div>

        {/* Modal Actions */}
        <div className="fin-stl-footer">
          <NeoButton variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </NeoButton>
          <NeoButton
            variant="solid"
            icon="check_circle"
            loading={submitting}
            type="submit"
          >
            Post Settlement
          </NeoButton>
        </div>
      </form>
    </ModalPortal>
  );
};

export default SettlementModal;
