import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ModalPortal from "../../../components/common/ModalPortal";
import Dock from "../../../components/common/Dock";
import Icon from "../../../components/common/Icon";
import HoverTooltip from "../../../components/common/HoverTooltip";
import GlassDatePicker from "../../../components/common/GlassDatePicker";
import GlassDropdown from "../../../components/common/GlassDropdown";
import FloatingInput from "../../../components/common/FloatingInput";
import NeoButton from "../../../components/common/NeoButton";
import PublishModal from "../../../components/common/PublishModal";
import { downloadReceiptVectorPDF } from "../utils/generateReceiptPDF";
import { formatCurrency, getCurrencySymbol } from "../../../utils/currencyUtils";
import { validatePaymentForm } from "../../../utils/validators";
import { useProjects } from "../context/ProjectContext";
import { projectService } from "../../../services/projectService";
import {
  VDV_LOGO_BASE64 as vdvLogo,
  VDV_LOGO_WHITE_BASE64 as vdvLogoWhite,
} from "../../../assets/svg images/vdv_logo_base64";
import "./PaymentReceiptModal.css";

const PAYMENT_METHODS = [
  "Bank Transfer",
  "Wire Transfer",
  "Cheque",
  "Online Payment",
  "Cash",
];

const PaymentReceiptModal = ({
  payment,
  project = {},
  onClose,
  onUpdate,
  canEdit = false,
}) => {
  const { updatePayment, detailsCache, getProjectDetails } = useProjects();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const [autoHide, setAutoHide] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishToClient, setPublishToClient] = useState(Boolean(payment?.published_to_client));
  const [transmittalNote, setTransmittalNote] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    setPublishToClient(Boolean(payment?.published_to_client));
  }, [payment?.published_to_client]);

  // Signatories list
  const [signatories, setSignatories] = useState([]);
  const hasFetchedSignatories = useRef(false);

  useEffect(() => {
    if (hasFetchedSignatories.current) return;
    hasFetchedSignatories.current = true;
    let isMounted = true;
    projectService
      .getFinanceSignatories()
      .then((data) => {
        if (isMounted && Array.isArray(data)) setSignatories(data);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const signatoryOptions = useMemo(
    () =>
      signatories.map((s) => ({
        value: s.id,
        label: `${s.full_name || s.username} — ${s.role_name || "Signatory"}`,
      })),
    [signatories]
  );

  // Editable Form State
  const [form, setForm] = useState({
    amount: payment?.amount || "",
    payment_date: payment?.payment_date
      ? new Date(payment.payment_date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    description: payment?.description || payment?.notes || "Project Payment",
    bank_ref: payment?.bank_ref || "",
    payment_method: payment?.payment_method || "Bank Transfer",
    notes: payment?.notes || "",
    signatory_id: payment?.signatory_id || "",
    signatory_name: payment?.signatory_name || "",
    signatory_role: payment?.signatory_role || "",
  });

  const [editTouched, setEditTouched] = useState({
    description: false,
    amount: false,
    bank_ref: false,
    payment_date: false,
  });

  const validationErrors = useMemo(() => validatePaymentForm(form), [form]);
  const isFormValid = useMemo(
    () =>
      !validationErrors.description &&
      !validationErrors.amount &&
      !validationErrors.payment_date &&
      !validationErrors.bank_ref,
    [validationErrors]
  );

  const editDisabledReason = useMemo(() => {
    if (!form.description.trim()) return "Payment description is required";
    if (!form.amount || parseFloat(form.amount) <= 0) return "Valid payment amount required";
    if (!form.payment_date) return "Select payment date";
    if (validationErrors.description) return validationErrors.description;
    if (validationErrors.amount) return validationErrors.amount;
    if (validationErrors.payment_date) return validationErrors.payment_date;
    if (validationErrors.bank_ref) return validationErrors.bank_ref;
    return "";
  }, [form, validationErrors]);

  const activeProjectId = project?.id || payment?.project_id;
  const projectData = (activeProjectId && detailsCache?.[activeProjectId])
    ? detailsCache[activeProjectId]
    : project;
  const fetchedProjectIdRef = useRef(null);

  useEffect(() => {
    if (
      activeProjectId &&
      getProjectDetails &&
      fetchedProjectIdRef.current !== activeProjectId &&
      (!projectData?.code_name || !projectData?.project_name)
    ) {
      fetchedProjectIdRef.current = activeProjectId;
      getProjectDetails(activeProjectId);
    }
  }, [activeProjectId, projectData, getProjectDetails]);


  const projectCode = projectData?.code_name || projectData?.project_code || "";
  const receiptNumber = `REC-${(projectCode || "PRJ").toUpperCase()}-${String(payment.id || 1).padStart(4, "0")}`;
  const totalBudget = parseFloat(projectData?.latest_budget_total) || 0;
  const totalPaid = parseFloat(projectData?.total_paid) || 0;
  const balance = totalBudget > totalPaid ? totalBudget - totalPaid : 0;
  const paidPct = totalBudget > 0 ? Math.min(Math.round((totalPaid / totalBudget) * 100), 100) : 0;

  const formattedPaymentDate = new Date(form.payment_date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // 1. Download as True Scalable Vector A5 PDF (Memoized)
  const handleDownloadPDF = useCallback(() => {
    downloadReceiptVectorPDF({
      payment,
      projectData,
      projectCode,
      receiptNumber,
      formattedAmount: formatCurrency(form.amount),
      formattedPaymentDate,
      description: form.description,
      bankRef: form.bank_ref,
      paymentMethod: form.payment_method,
      notes: form.notes,
      totalBudgetFormatted: formatCurrency(totalBudget),
      totalPaidFormatted: formatCurrency(totalPaid),
      balanceFormatted: formatCurrency(balance),
      paidPct,
      signatoryName: form.signatory_name || payment?.signatory_name,
      signatoryRole: form.signatory_role || payment?.signatory_role,
      isDarkMode,
    });
  }, [
    payment,
    projectData,
    projectCode,
    receiptNumber,
    form.amount,
    form.description,
    form.bank_ref,
    form.payment_method,
    form.notes,
    form.signatory_name,
    form.signatory_role,
    formattedPaymentDate,
    totalBudget,
    totalPaid,
    balance,
    paidPct,
    isDarkMode,
  ]);

  // 2. Browser Print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // 3. Copy Formal Summary Text
  const handleCopySummary = useCallback(async () => {
    const lines = [
      "==================================================================",
      "                 OFFICIAL PAYMENT RECEIPT & VOUCHER               ",
      "                 VISION DIVISION PRODUCTION HOUSE                 ",
      "==================================================================",
      `Receipt Number         : ${receiptNumber}`,
      `Issue Date             : ${formattedPaymentDate}`,
      `Transaction Status     : CONFIRMED & CLEARED`,
      "------------------------------------------------------------------",
      "CLIENT & PROJECT PARTICULARS",
      "------------------------------------------------------------------",
      `Project Name           : ${projectData?.project_name || "N/A"}`,
      `Project Code           : ${projectCode || "N/A"}`,
      `Client Account         : ${projectData?.client_usernames || "N/A"}`,
      "------------------------------------------------------------------",
      "PAYMENT DETAILS",
      "------------------------------------------------------------------",
      `Amount Received        : ${formatCurrency(form.amount)}`,
      `Payment Method         : ${form.payment_method}`,
      `Reference / Slip No    : ${form.bank_ref || "N/A"}`,
      `Description            : ${form.description || "Project Payment"}`,
    ];

    if (form.notes && form.notes !== form.description) {
      lines.push(`Remarks / Notes        : ${form.notes}`);
    }

    lines.push(
      "------------------------------------------------------------------",
      "PROJECT FINANCIAL LEDGER",
      "------------------------------------------------------------------",
      `Total Project Budget   : ${formatCurrency(totalBudget)}`,
      `Total Cleared to Date  : ${formatCurrency(totalPaid)}${totalBudget > 0 ? ` (${paidPct}%)` : ""}`,
      `Remaining Balance Due  : ${formatCurrency(balance)}`,
      "------------------------------------------------------------------",
      "AUTHORIZATION & VERIFICATION",
      "------------------------------------------------------------------",
      `Authorized Signatory   : ${form.signatory_name || payment?.signatory_name || "Authorized Executive"}`,
      `Designation / Role     : ${form.signatory_role || payment?.signatory_role || "Executive Signatory"}`,
      "==================================================================",
      "  This is a computer-generated confirmation receipt issued by     ",
      "  Vision Division. Please retain this voucher for your records.   ",
      "=================================================================="
    );

    const summaryText = lines.join("\n");

    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error("Failed to copy summary", e);
    }
  }, [
    receiptNumber,
    projectData,
    projectCode,
    form.amount,
    formattedPaymentDate,
    form.payment_method,
    form.bank_ref,
    form.description,
    form.notes,
    form.signatory_name,
    form.signatory_role,
    payment?.signatory_name,
    payment?.signatory_role,
    totalBudget,
    totalPaid,
    paidPct,
    balance,
  ]);

  // 4. Save Edited Receipt Details
  const handleSaveEdit = useCallback(async (e) => {
    e.preventDefault();
    if (!project?.id || !payment?.id) return;

    setEditTouched({
      description: true,
      amount: true,
      bank_ref: true,
      payment_date: true,
    });

    if (!isFormValid) {
      setErrorMsg("Please fix validation errors before saving.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const updatedPayload = {
      amount: parseFloat(form.amount),
      payment_date: form.payment_date,
      description: form.description.trim(),
      bank_ref: form.bank_ref.trim(),
      payment_method: form.payment_method,
      notes: form.notes.trim(),
      signatory_id: form.signatory_id ? Number(form.signatory_id) : null,
      signatory_name: form.signatory_name,
      signatory_role: form.signatory_role,
    };

    const result = await updatePayment(project.id, payment.id, updatedPayload);

    if (result.success) {
      if (onUpdate) {
        onUpdate({
          ...payment,
          ...updatedPayload,
        });
      }
      setIsEditing(false);
    } else {
      setErrorMsg(result.error || "Failed to save receipt updates");
    }

    setIsSaving(false);
  }, [project?.id, payment, form, isFormValid, updatePayment, onUpdate]);

  // 5. Publish to Client Handlers
  const handlePublishReceipt = useCallback(async () => {
    if (!project?.id || !payment?.id) return;
    setIsPublishing(true);
    try {
      const res = await updatePayment(project.id, payment.id, {
        published_to_client: publishToClient ? 1 : 0,
        transmittal_note: transmittalNote.trim() || undefined,
      });
      if (res.success) {
        if (onUpdate) {
          onUpdate({
            ...payment,
            published_to_client: publishToClient ? 1 : 0,
            published_at: publishToClient ? new Date().toISOString() : null,
          });
        }
        setShowPublishModal(false);
      }
    } catch (err) {
      console.error("Failed to publish receipt:", err);
    } finally {
      setIsPublishing(false);
    }
  }, [project?.id, payment, publishToClient, transmittalNote, updatePayment, onUpdate]);

  const handleUnpublishReceipt = useCallback(async () => {
    if (!project?.id || !payment?.id) return;
    setIsPublishing(true);
    try {
      const res = await updatePayment(project.id, payment.id, {
        published_to_client: 0,
      });
      if (res.success) {
        setPublishToClient(false);
        if (onUpdate) {
          onUpdate({
            ...payment,
            published_to_client: 0,
            published_at: null,
          });
        }
        setShowPublishModal(false);
      }
    } catch (err) {
      console.error("Failed to unpublish receipt:", err);
    } finally {
      setIsPublishing(false);
    }
  }, [project?.id, payment, updatePayment, onUpdate]);

  const receiptAudiences = useMemo(
    () => [
      {
        id: "client",
        title: "Publish to Client Portal",
        description:
          "Release official payment confirmation voucher to the client's financial vault and project ledger.",
        recipient: projectData?.client_usernames || "Designated Client",
        icon: "apartment",
        badge: "Client Entity",
        checked: publishToClient,
        onChange: setPublishToClient,
      },
    ],
    [projectData?.client_usernames, publishToClient]
  );

  // Memoized Dock Items to prevent unnecessary Dock re-renders and animation loops
  const dockItems = useMemo(
    () => [
      {
        icon: <Icon name="download" modifiers="sm" />,
        label: "Download PDF",
        onClick: handleDownloadPDF,
        menu: [
          {
            label: "Download A5 PDF Receipt",
            onClick: handleDownloadPDF,
          },
        ],
      },
      {
        icon: <Icon name="print" modifiers="sm" />,
        label: "Print Document",
        onClick: handlePrint,
        menu: [
          {
            label: "Print Receipt Document",
            onClick: handlePrint,
          },
        ],
      },
      {
        icon: <Icon name={copied ? "check" : "content_copy"} modifiers="sm" />,
        label: copied ? "Copied to Clipboard!" : "Copy Summary",
        active: copied,
        onClick: handleCopySummary,
        menu: [
          {
            label: "Copy Text Summary to Clipboard",
            onClick: handleCopySummary,
          },
        ],
      },
      ...(canEdit
        ? [
            {
              icon: (
                <Icon
                  name={payment?.published_to_client ? "verified" : "publish"}
                  modifiers="sm"
                />
              ),
              label: payment?.published_to_client
                ? "Published (Manage)"
                : "Publish to Client",
              active: Boolean(payment?.published_to_client),
              onClick: () => setShowPublishModal(true),
              menu: [
                {
                  label: payment?.published_to_client
                    ? "Manage Publication & Notification"
                    : "Publish Official Receipt to Client",
                  onClick: () => setShowPublishModal(true),
                },
              ],
            },
          ]
        : []),
      ...(canEdit
        ? [
            {
              icon: <Icon name="edit" modifiers="sm" />,
              label: isEditing ? "Exit Edit Mode" : "Edit Receipt",
              active: isEditing,
              onClick: () => setIsEditing((prev) => !prev),
              menu: [
                {
                  label: isEditing ? "Cancel / Exit Edit Mode" : "Modify Receipt Particulars",
                  onClick: () => setIsEditing((prev) => !prev),
                },
              ],
            },
          ]
        : []),
      {
        separator: true,
      },
      {
        icon: (
          <Icon
            name={autoHide ? "push_pin" : "keep"}
            modifiers={`sm ${!autoHide ? "filled" : ""}`}
          />
        ),
        label: autoHide
          ? "Auto-Hide: ON (Click to Pin)"
          : "Dock Pinned (Click to Auto-Hide)",
        active: !autoHide,
        className: `dock-toggle-item ${!autoHide ? "is-pinned" : ""}`,
        onClick: () => setAutoHide((prev) => !prev),
        menu: [
          {
            label: "Auto-Hide Dock",
            checked: autoHide,
            onClick: () => setAutoHide(true),
          },
          {
            label: "Pin Dock (Keep Visible)",
            checked: !autoHide,
            onClick: () => setAutoHide(false),
          },
        ],
      },
    ],
    [handleDownloadPDF, handlePrint, handleCopySummary, copied, canEdit, isEditing, autoHide, payment?.published_to_client]
  );

  if (!payment) return null;

  return (
    <ModalPortal
      onClose={onClose}
      showClose={true}
      size="large"
      className={`global-modal-glass receipt-modal-glass ${!autoHide ? "is-dock-pinned" : ""}`}
    >
      {/* macOS-style Spring Physics Dock Actions */}
      <Dock
        items={dockItems}
        position="left"
        autoHide={autoHide}
        baseItemSize={45}
        magnification={60}
        panelHeight={70}
        distance={190}
        gap={10}
        roundness={0.5}
        spring="smooth"
        bounce={false}
        tiles={true}
        showLabels={true}
        showIndicators={false}
        showBadges={false}
        accentColor="#00c6e6"
        className="receipt-dock"
      />

      {/* Navigation Edge Indicator (Visible when dock is auto-hidden) */}
      <button
        type="button"
        className="receipt-dock-indicator"
        onClick={() => setAutoHide(false)}
        title="Receipt Actions (Hover to reveal, Click to pin)"
        aria-label="Reveal Receipt Actions Dock"
      >
        <span className="indicator-handle">
          <span className="indicator-dot" />
          <Icon name="chevron_left" modifiers="xs" className="indicator-chevron" />
        </span>
      </button>
      {/* Top Action Bar */}
      <div className="receipt-modal-header-actions">
        <div className="receipt-header-title-group">
          <div className="receipt-header-icon">
            <Icon name="verified" modifiers="sm" />
          </div>
          <h3 className="receipt-header-title">
            {isEditing ? "Edit Receipt Details" : "Payment Confirmation"}
          </h3>
        </div>

        {!isEditing && (
          <HoverTooltip
            text={isDarkMode ? "Switch to Classic Light" : "Switch to Vision Dark"}
            wrapperClassName="receipt-theme-tooltip-wrapper"
          >
            <button
              type="button"
              className={`receipt-theme-toggle-btn ${isDarkMode ? "is-dark" : "is-light"}`}
              onClick={() => setIsDarkMode((prev) => !prev)}
              aria-label={isDarkMode ? "Switch to Classic Light Receipt" : "Switch to Vision Division Dark Receipt"}
            >
              <Icon name={isDarkMode ? "light_mode" : "dark_mode"} modifiers="md" />
            </button>
          </HoverTooltip>
        )}
      </div>

      {/* Main Body */}
      <div className="receipt-modal-scrollable">
        {isEditing ? (
          /* Director / Admin Edit Mode */
          <form onSubmit={handleSaveEdit} className="receipt-edit-pane">
            <div className="receipt-edit-header">
              <h4 className="receipt-edit-title">Modify Payment Record #{payment.id}</h4>
              <span className="count-badge">Authorized Management Only</span>
            </div>

            {errorMsg && (
              <div className="neo-status-messages">
                <div className="neo-status error show">
                  <Icon name="error" modifiers="sm" />
                  <span>{errorMsg}</span>
                </div>
              </div>
            )}

            <div className="receipt-edit-grid">
              <FloatingInput
                label="Payment Description / Milestone"
                placeholder="e.g. Initial Milestone Advance"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                onBlur={() => setEditTouched((prev) => ({ ...prev, description: true }))}
                error={editTouched.description ? validationErrors.description : ""}
              />

              <FloatingInput
                type="number"
                step="0.01"
                label={`Amount (${getCurrencySymbol()})`}
                prefix={getCurrencySymbol()}
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                onBlur={() => setEditTouched((prev) => ({ ...prev, amount: true }))}
                error={editTouched.amount ? validationErrors.amount : ""}
              />

              <FloatingInput
                label="Bank Reference / Slip No"
                placeholder="e.g. TXN-8823901"
                value={form.bank_ref}
                onChange={(e) => setForm({ ...form, bank_ref: e.target.value })}
                onBlur={() => setEditTouched((prev) => ({ ...prev, bank_ref: true }))}
                error={editTouched.bank_ref ? validationErrors.bank_ref : ""}
              />

              <FloatingInput
                as="select"
                label="Payment Method"
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </FloatingInput>

              <FloatingInput
                className="receipt-form-full"
                label="Payment Date"
                hasValue={Boolean(form.payment_date)}
                required
                error={editTouched.payment_date ? validationErrors.payment_date : ""}
              >
                <GlassDatePicker
                  value={form.payment_date}
                  onChange={(val) => {
                    setForm({ ...form, payment_date: val });
                    setEditTouched((prev) => ({ ...prev, payment_date: true }));
                  }}
                  required
                />
              </FloatingInput>

              <FloatingInput
                className="receipt-form-full"
                label="Authorizing Signatory"
                hasValue={Boolean(form.signatory_id)}
              >
                <GlassDropdown
                  options={signatoryOptions}
                  value={form.signatory_id}
                  onChange={(val) => {
                    const chosen = signatories.find((s) => s.id === Number(val));
                    setForm({
                      ...form,
                      signatory_id: val,
                      signatory_name: chosen
                        ? chosen.full_name || chosen.username
                        : form.signatory_name,
                      signatory_role: chosen ? chosen.role_name : form.signatory_role,
                    });
                  }}
                  placeholder="Select Authorizing Signatory..."
                  modifiers="fluid"
                />
              </FloatingInput>

              <FloatingInput
                className="receipt-form-full"
                as="textarea"
                label="Notes & Remarks"
                rows={3}
                placeholder="Additional notes for receipt and records"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="receipt-edit-actions">
              <NeoButton
                type="button"
                variant="cancel"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                Cancel
              </NeoButton>
              <NeoButton
                type="submit"
                variant="solid"
                loading={isSaving}
                disabled={!isFormValid}
                disabledReason={editDisabledReason}
              >
                Save Receipt Changes
              </NeoButton>
            </div>
          </form>
        ) : (
          /* The Printable Receipt Document Sheet */
          <div id="payment-receipt-sheet" className={`receipt-sheet ${isDarkMode ? "is-dark" : ""}`}>
            {/* Document Header */}
            <div className="receipt-doc-header">
              <div className="receipt-brand-stack">
                <div className="receipt-brand-logo-row">
                  <div className="receipt-brand-logo-wrap">
                    <img
                      src={isDarkMode ? vdvLogoWhite : vdvLogo}
                      alt="Vision Division Logo"
                      className="receipt-brand-logo-img"
                    />
                  </div>
                  <h2 className="receipt-brand-name">Vision Division</h2>
                </div>
                <span className="receipt-brand-sub">Film &amp; Commercial Production House</span>
              </div>

              <div className="receipt-meta-stack">
                <h3 className="receipt-doc-title">Payment Receipt</h3>
                <span className="receipt-num-tag">{receiptNumber}</span>
                <div className="receipt-meta-pills-row">
                  <div className="receipt-status-pill">
                    <span className="receipt-status-dot"></span>
                    <span>Confirmed &amp; Cleared</span>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      className={`receipt-publish-pill ${
                        payment?.published_to_client ? "is-published" : "is-draft"
                      }`}
                      onClick={() => setShowPublishModal(true)}
                      title={
                        payment?.published_to_client
                          ? "Published to Client (Click to manage)"
                          : "Internal Draft (Click to publish)"
                      }
                    >
                      <Icon
                        name={
                          payment?.published_to_client
                            ? "cloud_done"
                            : "cloud_off"
                        }
                        modifiers="xs"
                      />
                      <span>
                        {payment?.published_to_client
                          ? "Published to Client"
                          : "Internal Draft"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Entity Details Grid */}
            <div className="receipt-entity-grid">
              <div className="receipt-entity-col">
                <span className="receipt-entity-label">Received From (Client)</span>
                <span className="receipt-entity-name">
                  {projectData?.client_usernames || "Project Client Account"}
                </span>
                <span className="receipt-entity-detail">
                  Project Client Account
                </span>
              </div>

              <div className="receipt-entity-col">
                <span className="receipt-entity-label">Project Particulars</span>
                <span className="receipt-entity-name">
                  {projectData?.project_name || "Production Project"}
                </span>
                <span className="receipt-entity-detail">
                  Project Code: <strong>{projectCode || "N/A"}</strong>
                </span>
              </div>
            </div>

            {/* Highlighted Amount Callout */}
            <div className="receipt-amount-card">
              <div className="receipt-amount-label-wrap">
                <span className="receipt-amount-label">Amount Credited</span>
                <span className="receipt-amount-method">
                  via {form.payment_method}
                  {form.bank_ref ? ` (Ref: ${form.bank_ref})` : ""}
                </span>
              </div>
              <div className="receipt-amount-value">
                {formatCurrency(form.amount)}
              </div>
            </div>

            {/* Particulars Table */}
            <div className="receipt-table-section">
              <h4 className="receipt-section-heading">Transaction Particulars</h4>
              <table className="receipt-particulars-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Payment Method</th>
                    <th>Payment Date</th>
                    <th className="text-right">Credited Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="receipt-desc-main">{form.description}</div>
                      {form.bank_ref && (
                        <div className="receipt-desc-notes">
                          <span className="receipt-badge-tag">Bank Ref</span>
                          <span>{form.bank_ref}</span>
                        </div>
                      )}
                      {form.notes && form.notes !== form.description && (
                        <div className="receipt-desc-notes">{form.notes}</div>
                      )}
                    </td>
                    <td>{form.payment_method}</td>
                    <td>{formattedPaymentDate}</td>
                    <td className="text-right">
                      <strong>{formatCurrency(form.amount)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Cumulative Project Ledger Context */}
            <div className="receipt-ledger-box">
              <h4 className="receipt-section-heading">Project Ledger Context</h4>
              <div className="receipt-ledger-rows">
                <div className="receipt-ledger-item">
                  <span className="receipt-ledger-label">Agreed Budget</span>
                  <span className="receipt-ledger-val">{formatCurrency(totalBudget)}</span>
                </div>
                <div className="receipt-ledger-item">
                  <span className="receipt-ledger-label">Total Paid to Date</span>
                  <span className="receipt-ledger-val highlight-paid">
                    {formatCurrency(totalPaid)} ({paidPct}%)
                  </span>
                </div>
                <div className="receipt-ledger-item">
                  <span className="receipt-ledger-label">Remaining Balance</span>
                  <span className="receipt-ledger-val highlight-balance">
                    {formatCurrency(balance)}
                  </span>
                </div>
              </div>
              <div className="receipt-mini-progress-track">
                <div
                  className="receipt-mini-progress-fill"
                  style={{ width: `${paidPct}%` }}
                ></div>
              </div>
            </div>

            {/* Legal Verification & Footer */}
            <div className="receipt-doc-footer">
              <p className="receipt-legal-note">
                This computer-generated document confirms receipt of the stated funds credited
                to the project ledger. Stored digitally with tamper-evident record ID #{payment.id}.
              </p>
              <div className="receipt-sign-box">
                <div className="receipt-sign-name">
                  {form.signatory_name || payment.signatory_name || "Authorized Executive"}
                </div>
                <div className="receipt-sign-line"></div>
                <span className="receipt-sign-label">Authorized Signatory</span>
                <span className="receipt-sign-meta">
                  {(form.signatory_role || payment.signatory_role)
                    ? `${form.signatory_role || payment.signatory_role}, Vision Division`
                    : "Vision Division Management"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Common Publish Modal for Payment Receipt */}
      <PublishModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        entityType="receipt"
        documentData={{
          id: payment.id,
          code: receiptNumber,
          title: form.description || "Official Payment Receipt",
          subtitle: projectData?.project_name,
          amountFormatted: formatCurrency(form.amount),
          dateFormatted: formattedPaymentDate,
          signatory: form.signatory_name || payment?.signatory_name,
          signatoryRole: form.signatory_role || payment?.signatory_role,
          isPublished: Boolean(payment?.published_to_client),
          publishedAt: payment?.published_at,
        }}
        audiences={receiptAudiences}
        transmittalNote={transmittalNote}
        onTransmittalNoteChange={setTransmittalNote}
        onPublish={handlePublishReceipt}
        onUnpublish={
          payment?.published_to_client ? handleUnpublishReceipt : undefined
        }
        isSubmitting={isPublishing}
      />
    </ModalPortal>
  );
};

export default PaymentReceiptModal;

