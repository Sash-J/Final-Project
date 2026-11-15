import React, { useState, useEffect, useMemo, useRef } from "react";
import ModalPortal from "../../../components/common/ModalPortal";
import FloatingInput from "../../../components/common/FloatingInput";
import GlassDatePicker from "../../../components/common/GlassDatePicker";
import NeoButton from "../../../components/common/NeoButton";
import Icon from "../../../components/common/Icon";
import { useFinance } from "../context/FinanceContext";
import { financeService } from "../../../services/financeService";
import { validateVoucherForm } from "../../../utils/validators";
import { sanitizeRealtime, sanitizeOnBlur } from "../../../utils/sanitizer";
import { compressImageFile } from "../../../utils/imageCompression";
import toast from "react-hot-toast";
import "./TransactionModal.css";

const DOC_TYPES = [
  { id: "expense", label: "Expense", icon: "receipt_long" },
  { id: "income", label: "Income", icon: "trending_up" },
  { id: "drawing", label: "Drawing", icon: "account_balance_wallet", requiresPersonal: true },
  { id: "capital", label: "Capital", icon: "savings", requiresPersonal: true },
  { id: "invoice_ar", label: "Invoice (AR)", icon: "description" },
  { id: "bill_ap", label: "Bill (AP)", icon: "receipt" },
  { id: "transfer", label: "Transfer", icon: "swap_horiz" },
];

const SCOPES = [
  { id: "project", label: "Project", icon: "movie_edit" },
  { id: "company", label: "Company", icon: "apartment", requiresPersonal: true },
  { id: "personal", label: "Personal", icon: "person_book", requiresPersonal: true },
];

const PAYMENT_METHODS = [
  { id: "Bank Transfer", label: "Bank Transfer" },
  { id: "Cash", label: "Cash / Petty Cash" },
  { id: "Credit / On Account", label: "Credit / On Account" },
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

const TransactionModal = ({
  isOpen = false,
  initialPreset = {},
  onClose,
  onSuccess,
}) => {
  const { permissions, taxonomy, refreshWorkspace } = useFinance();
  const fileInputRef = useRef(null);

  const [docType, setDocType] = useState("expense");
  const [scope, setScope] = useState("project");
  const [primaryProjectId, setPrimaryProjectId] = useState("");
  const [primaryUserId, setPrimaryUserId] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [txDate, setTxDate] = useState(getTodayIso());
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const projects = taxonomy?.projects || [];
  const users = taxonomy?.users || [];
  const bankAccounts = taxonomy?.bank_accounts || [];
  const defaultBankId = bankAccounts[0]?.id ? String(bankAccounts[0].id) : "";
  const initializedRef = useRef(false);

  // Initialize from preset only once when opened
  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;

    const presetDoc = initialPreset?.doc_type || "expense";
    const presetScope =
      initialPreset?.scope ||
      (presetDoc === "drawing" || presetDoc === "capital"
        ? "personal"
        : !permissions.canViewPersonal
        ? "project"
        : "project");

    setDocType(presetDoc);
    setScope(presetScope);
    setPrimaryProjectId(initialPreset?.project_id ? String(initialPreset.project_id) : "");
    setPrimaryUserId(initialPreset?.user_id ? String(initialPreset.user_id) : "");
    setCounterpartyName(initialPreset?.party_name || "");
    setTxDate(initialPreset?.tx_date || getTodayIso());
    setDueDate(initialPreset?.due_date || "");
    setAmount(initialPreset?.amount ? String(initialPreset.amount) : "");
    setDescription(initialPreset?.description || "");
    setNotes(initialPreset?.notes || "");
    setPaymentMethod(initialPreset?.payment_method || "Bank Transfer");
    setBankAccountId(defaultBankId);
    setBankRef(initialPreset?.bank_ref || "");
    setSaveAsDraft(false);
    setAttachment(null);
    setFormErrors({});
  }, [isOpen, initialPreset, defaultBankId, permissions.canViewPersonal]);

  useEffect(() => {
    if (defaultBankId && !bankAccountId) {
      setBankAccountId(defaultBankId);
    }
  }, [defaultBankId, bankAccountId]);

  const handleDocTypeChange = (newDocType) => {
    setDocType(newDocType);
    if (newDocType === "drawing" || newDocType === "capital") {
      setScope("personal");
    } else if (scope === "personal") {
      setScope("project");
    }
  };

  const availableDocTypes = useMemo(() => {
    return DOC_TYPES.filter(
      (dt) => !dt.requiresPersonal || permissions.canViewPersonal
    );
  }, [permissions.canViewPersonal]);

  const availableScopes = useMemo(() => {
    return SCOPES.filter(
      (sc) => !sc.requiresPersonal || permissions.canViewPersonal
    );
  }, [permissions.canViewPersonal]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Receipts must be an image (PNG, JPEG, or WebP).");
      return;
    }

    try {
      setCompressing(true);
      const compressedBlob = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.82,
        mimeType: "image/webp",
      });

      const reader = new FileReader();
      reader.onload = () => {
        setAttachment({
          file_name: file.name.replace(/\.[^/.]+$/, "") + ".webp",
          mime_type: "image/webp",
          payload: reader.result,
          byte_size: compressedBlob.size || file.size,
        });
        setCompressing(false);
      };
      reader.readAsDataURL(compressedBlob);
    } catch (err) {
      setCompressing(false);
      toast.error("Failed to process image attachment.");
    }
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const voucherForm = {
      doc_type: docType,
      scope,
      primary_project_id:
        scope === "project" && primaryProjectId ? parseInt(primaryProjectId, 10) : null,
      primary_user_id:
        primaryUserId ? parseInt(primaryUserId, 10) : null,
      tx_date: txDate,
      due_date: dueDate || null,
      amount: amount ? parseFloat(amount) : null,
      description: description.trim(),
      bank_ref: bankRef.trim() || null,
      lines: [],
    };

    const errors = validateVoucherForm(voucherForm);
    const hasErrors = Object.values(errors).some(Boolean);

    if (hasErrors) {
      setFormErrors(errors);
      const firstMsg = Object.values(errors).find(Boolean);
      toast.error(firstMsg || "Please fix validation errors.");
      return;
    }

    setSubmitting(true);
    setFormErrors({});

    try {
      const payload = {
        ...voucherForm,
        notes: notes.trim(),
        payment_method: paymentMethod,
        bank_account_id: bankAccountId ? parseInt(bankAccountId, 10) : null,
        status: saveAsDraft ? "draft" : "posted",
        currency_code: "LKR",
        exchange_rate: 1.0,
      };

      if (counterpartyName.trim()) {
        payload.notes = payload.notes
          ? `${payload.notes}\nCounterparty: ${counterpartyName.trim()}`
          : `Counterparty: ${counterpartyName.trim()}`;
      }

      if (attachment) {
        payload.attachments = [attachment];
      }

      const res = await financeService.postVoucher(payload);
      toast.success(
        res?.message ||
          (saveAsDraft ? "Voucher saved as draft." : "Voucher posted to General Ledger.")
      );

      await refreshWorkspace();
      onSuccess?.(res);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to record transaction.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal
      onClose={onClose}
      size="large"
      className="global-modal-glass fin-tx-modal"
    >
      <div className="fin-tx-modal-header">
        <div className="fin-tx-modal-title-group">
          <div className="fin-tx-modal-badge">
            <Icon name="receipt_long" modifiers="sm" />
            <span>Double-Entry Voucher</span>
          </div>
          <h2 className="fin-tx-modal-title">Record Financial Entry</h2>
          <p className="fin-tx-modal-subtitle">
            Post an audited transaction voucher directly to the General Ledger.
          </p>
        </div>
      </div>

      <form
        className="fin-tx-form"
        onSubmit={handleSubmit}
        data-testid="transaction-modal-form"
      >
        {/* Document Type Selector */}
        <div className="fin-tx-field-group">
          <label className="fin-tx-section-label">Accounting Category</label>
          <div className="fin-tx-type-chips" role="radiogroup" aria-label="Document Category">
            {availableDocTypes.map((dt) => (
              <button
                key={dt.id}
                type="button"
                role="radio"
                aria-checked={docType === dt.id}
                className={`fin-tx-type-chip ${docType === dt.id ? "is-active" : ""}`}
                onClick={() => handleDocTypeChange(dt.id)}
              >
                <Icon name={dt.icon} modifiers="sm" />
                <span>{dt.label}</span>
              </button>
            ))}
          </div>
          {formErrors.doc_type && (
            <span className="fin-tx-error-msg">{formErrors.doc_type}</span>
          )}
        </div>

        {/* Scope Selector */}
        {docType !== "drawing" && docType !== "capital" && (
          <div className="fin-tx-field-group">
            <label className="fin-tx-section-label">Accounting Scope</label>
            <div className="fin-tx-scope-pills" role="radiogroup" aria-label="Accounting Scope">
              {availableScopes.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  role="radio"
                  aria-checked={scope === sc.id}
                  className={`fin-tx-scope-pill ${scope === sc.id ? "is-active" : ""}`}
                  onClick={() => setScope(sc.id)}
                >
                  <Icon name={sc.icon} modifiers="sm" />
                  <span>{sc.label}</span>
                </button>
              ))}
            </div>
            {formErrors.scope && (
              <span className="fin-tx-error-msg">{formErrors.scope}</span>
            )}
          </div>
        )}

        {/* Dynamic Context Fields */}
        <div className="fin-tx-row fin-tx-row-context">
          {scope === "project" && (
            <div className="fin-tx-col">
              <label className="fin-tx-field-label">Target Project *</label>
              <select
                className={`fin-tx-select ${formErrors.primary_project_id ? "is-invalid" : ""}`}
                value={primaryProjectId}
                onChange={(e) => setPrimaryProjectId(e.target.value)}
                aria-label="Select Project"
              >
                <option value="">-- Select Project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name} ({p.code_name || p.status})
                  </option>
                ))}
              </select>
              {formErrors.primary_project_id && (
                <span className="fin-tx-error-msg">{formErrors.primary_project_id}</span>
              )}
            </div>
          )}

          {(scope === "personal" || docType === "drawing" || docType === "capital") && (
            <div className="fin-tx-col">
              <label className="fin-tx-field-label">Director / Owner / Stakeholder *</label>
              <select
                className={`fin-tx-select ${formErrors.primary_user_id ? "is-invalid" : ""}`}
                value={primaryUserId}
                onChange={(e) => setPrimaryUserId(e.target.value)}
                aria-label="Select Person"
              >
                <option value="">-- Select Person --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
              {formErrors.primary_user_id && (
                <span className="fin-tx-error-msg">{formErrors.primary_user_id}</span>
              )}
            </div>
          )}

          <div className="fin-tx-col">
            <FloatingInput
              label="Counterparty (Vendor / Client)"
              value={counterpartyName}
              onChange={(e) => setCounterpartyName(sanitizeRealtime(e.target.value, "text"))}
              placeholder="e.g. CineLight Rentals"
            />
          </div>
        </div>

        {/* Date, Amount & Due Date */}
        <div className="fin-tx-row fin-tx-row-figures">
          <div className="fin-tx-col">
            <label className="fin-tx-field-label">Transaction Date *</label>
            <GlassDatePicker
              value={txDate}
              onChange={setTxDate}
              placeholder="YYYY-MM-DD"
              className={formErrors.tx_date ? "is-invalid" : ""}
            />
            {formErrors.tx_date && (
              <span className="fin-tx-error-msg">{formErrors.tx_date}</span>
            )}
          </div>

          <div className="fin-tx-col">
            <FloatingInput
              id="tx-amount"
              data-testid="tx-amount-input"
              label="Total Amount (LKR) *"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              prefix="Rs"
              error={formErrors.amount}
              required
            />
          </div>

          {(docType === "invoice_ar" || docType === "bill_ap") && (
            <div className="fin-tx-col">
              <label className="fin-tx-field-label">Due Date (Optional)</label>
              <GlassDatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="YYYY-MM-DD"
                className={formErrors.due_date ? "is-invalid" : ""}
              />
              {formErrors.due_date && (
                <span className="fin-tx-error-msg">{formErrors.due_date}</span>
              )}
            </div>
          )}
        </div>

        {/* Description & Reference */}
        <div className="fin-tx-row">
          <div className="fin-tx-col-flex-2">
            <FloatingInput
              id="tx-description"
              data-testid="tx-description-input"
              label="Description / Purpose *"
              value={description}
              onChange={(e) => setDescription(sanitizeRealtime(e.target.value, "text"))}
              onBlur={(e) => setDescription(sanitizeOnBlur(e.target.value))}
              placeholder="e.g. Camera lenses rental for final shoot"
              error={formErrors.description}
              required
            />
          </div>
          <div className="fin-tx-col">
            <FloatingInput
              id="tx-bank-ref"
              label="Bank / Check Ref"
              value={bankRef}
              onChange={(e) => setBankRef(sanitizeRealtime(e.target.value, "text"))}
              placeholder="e.g. TXN-89472"
              error={formErrors.bank_ref}
            />
          </div>
        </div>

        {/* Payment / Settlement Details */}
        <div className="fin-tx-row">
          <div className="fin-tx-col">
            <label className="fin-tx-field-label">Payment Method</label>
            <select
              className="fin-tx-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.label}
                </option>
              ))}
            </select>
          </div>

          {paymentMethod === "Bank Transfer" && (
            <div className="fin-tx-col">
              <label className="fin-tx-field-label">Bank Account</label>
              <select
                className="fin-tx-select"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name} - {b.account_label || b.account_kind}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Receipt Attachment Upload with Compression */}
        <div className="fin-tx-field-group">
          <label className="fin-tx-section-label">Voucher Receipt / Evidence</label>
          <div className="fin-tx-attachment-box">
            {attachment ? (
              <div className="fin-tx-attachment-preview">
                <img
                  src={attachment.payload}
                  alt="Receipt Preview"
                  className="fin-tx-thumb"
                />
                <div className="fin-tx-attachment-info">
                  <span className="fin-tx-attachment-name">{attachment.file_name}</span>
                  <span className="fin-tx-attachment-size">
                    Compressed (WebP) · {(attachment.byte_size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <button
                  type="button"
                  className="fin-tx-remove-att-btn"
                  onClick={handleRemoveAttachment}
                  aria-label="Remove attachment"
                >
                  <Icon name="delete" modifiers="sm" />
                </button>
              </div>
            ) : (
              <label className="fin-tx-upload-label">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="fin-tx-file-input"
                  onChange={handleFileChange}
                  disabled={compressing}
                />
                <div className="fin-tx-upload-prompt">
                  <Icon name="cloud_upload" modifiers="md" />
                  <span>
                    {compressing
                      ? "Compressing image on client..."
                      : "Click or drag receipt photo to upload (Auto-compressed to WebP)"}
                  </span>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="fin-tx-footer">
          <label className="fin-tx-draft-toggle">
            <input
              type="checkbox"
              checked={saveAsDraft}
              onChange={(e) => setSaveAsDraft(e.target.checked)}
            />
            <span>Save as Draft (skip immediate GL posting)</span>
          </label>

          <div className="fin-tx-footer-buttons">
            <NeoButton variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </NeoButton>
            <NeoButton
              variant="solid"
              type="submit"
              icon={saveAsDraft ? "save" : "check_circle"}
              loading={submitting}
            >
              {saveAsDraft ? "Save Draft Voucher" : "Post Voucher"}
            </NeoButton>
          </div>
        </div>
      </form>
    </ModalPortal>
  );
};

export default TransactionModal;
