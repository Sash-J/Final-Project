import React, { useState, useEffect } from "react";
import ModalPortal from "../../../components/common/ModalPortal";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import Icon from "../../../components/common/Icon";
import NeoButton from "../../../components/common/NeoButton";
import { formatCurrency } from "../../../utils/currencyUtils";
import { sanitizeRealtime } from "../../../utils/sanitizer";
import { financeService } from "../../../services/financeService";
import toast from "react-hot-toast";
import "./VoucherDetailModal.css";

const VoucherDetailModal = ({
  isOpen = false,
  txId = null,
  onClose,
  onVoucherUpdated,
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("lines"); // 'lines' | 'gl' | 'attachments' | 'audit'

  // Action states
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [actionInProgress, setActionInProgress] = useState(false);

  useEffect(() => {
    if (!isOpen || !txId) return;

    let mounted = true;
    setLoading(true);
    setError("");

    financeService
      .getTransactionDetail(txId)
      .then((res) => {
        if (mounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "Failed to load transaction detail.");
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, txId]);

  if (!isOpen || !txId) return null;

  const tx = data?.transaction || {};
  const lines = data?.lines || [];
  const ledgerEntries = data?.ledger_entries || [];
  const attachments = data?.attachments || [];
  const auditLogs = data?.audit_logs || [];

  const handleApprove = async () => {
    try {
      setActionInProgress(true);
      await financeService.approvePostVoucher(txId);
      toast.success(`Voucher ${tx.voucher_no || txId} approved and posted to General Ledger.`);
      setShowApproveConfirm(false);
      // Reload detail
      const updated = await financeService.getTransactionDetail(txId);
      setData(updated);
      if (onVoucherUpdated) onVoucherUpdated();
    } catch (err) {
      toast.error(err.message || "Failed to approve voucher.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      toast.error("Please provide a reason for voiding this voucher.");
      return;
    }
    try {
      setActionInProgress(true);
      await financeService.voidVoucher(txId, voidReason);
      toast.success(`Voucher ${tx.voucher_no || txId} voided and reversed.`);
      setShowVoidModal(false);
      setVoidReason("");
      // Reload detail
      const updated = await financeService.getTransactionDetail(txId);
      setData(updated);
      if (onVoucherUpdated) onVoucherUpdated();
    } catch (err) {
      toast.error(err.message || "Failed to void voucher.");
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <>
      <ModalPortal
        isOpen={isOpen}
        onClose={onClose}
        title={tx.voucher_no ? `Voucher: ${tx.voucher_no}` : "Transaction Detail"}
        className="fin-vch-modal"
      >
        <div className="fin-vch-modal-content" data-testid="voucher-detail-modal">
          {loading ? (
            <div className="fin-vch-loading">
              <Icon name="sync" modifiers="lg" />
              <span>Loading voucher telemetry...</span>
            </div>
          ) : error ? (
            <div className="fin-vch-error" role="alert">
              <Icon name="error" modifiers="md" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Header Details Strip */}
              <div className="fin-vch-top-meta">
                <div className="fin-vch-badges-row">
                  <span className={`fin-vch-status-pill status-${tx.status}`}>
                    {tx.status}
                  </span>
                  <span className="fin-vch-pill doc-type">
                    {(tx.doc_type || "").replace("_", " ").toUpperCase()}
                  </span>
                  <span className="fin-vch-pill scope">
                    {(tx.scope || "").toUpperCase()}
                  </span>
                </div>

                <div className="fin-vch-amount-box">
                  <span className="fin-vch-amount-label">Total Voucher Amount</span>
                  <span className="fin-vch-amount-val">
                    {formatCurrency(tx.total_amount || 0, tx.currency_code || "LKR")}
                  </span>
                  {Number(tx.balance || 0) > 0 && (
                    <span className="fin-vch-balance-sub">
                      Unsettled Balance: {formatCurrency(tx.balance, tx.currency_code || "LKR")}
                    </span>
                  )}
                </div>
              </div>

              {/* Information Grid */}
              <div className="fin-vch-info-grid">
                <div className="fin-vch-info-cell">
                  <span className="fin-vch-info-label">Transaction Date</span>
                  <span className="fin-vch-info-val">{tx.tx_date || "—"}</span>
                </div>
                <div className="fin-vch-info-cell">
                  <span className="fin-vch-info-label">Due Date</span>
                  <span className="fin-vch-info-val">{tx.due_date || "—"}</span>
                </div>
                <div className="fin-vch-info-cell">
                  <span className="fin-vch-info-label">Payment Method</span>
                  <span className="fin-vch-info-val">{tx.payment_method || "—"}</span>
                </div>
                <div className="fin-vch-info-cell">
                  <span className="fin-vch-info-label">Bank Reference</span>
                  <span className="fin-vch-info-val">{tx.bank_ref || "—"}</span>
                </div>
                <div className="fin-vch-info-cell">
                  <span className="fin-vch-info-label">Linked Project</span>
                  <span className="fin-vch-info-val">
                    {tx.project_name ? `${tx.project_code || ""} · ${tx.project_name}` : "—"}
                  </span>
                </div>
                <div className="fin-vch-info-cell">
                  <span className="fin-vch-info-label">Target / Counterparty</span>
                  <span className="fin-vch-info-val">
                    {tx.counterparty_name || tx.person_name || "—"}
                  </span>
                </div>
              </div>

              {/* Description */}
              {tx.description && (
                <div className="fin-vch-desc-box">
                  <span className="fin-vch-desc-label">Description / Purpose</span>
                  <p className="fin-vch-desc-text">{tx.description}</p>
                </div>
              )}

              {/* Tab Navigation */}
              <div className="fin-vch-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "lines"}
                  className={`fin-vch-tab ${activeTab === "lines" ? "active" : ""}`}
                  onClick={() => setActiveTab("lines")}
                >
                  Accounting Lines ({lines.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "gl"}
                  className={`fin-vch-tab ${activeTab === "gl" ? "active" : ""}`}
                  onClick={() => setActiveTab("gl")}
                >
                  GL Ledger ({ledgerEntries.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "attachments"}
                  className={`fin-vch-tab ${activeTab === "attachments" ? "active" : ""}`}
                  onClick={() => setActiveTab("attachments")}
                >
                  Attachments ({attachments.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "audit"}
                  className={`fin-vch-tab ${activeTab === "audit" ? "active" : ""}`}
                  onClick={() => setActiveTab("audit")}
                >
                  Audit Trail ({auditLogs.length})
                </button>
              </div>

              {/* Tab Content: Lines */}
              {activeTab === "lines" && (
                <div className="fin-vch-tab-pane">
                  {lines.length === 0 ? (
                    <div className="fin-vch-empty-tab">No line items recorded.</div>
                  ) : (
                    <table className="fin-vch-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Account</th>
                          <th>Department</th>
                          <th className="align-right">Debit</th>
                          <th className="align-right">Credit</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l, idx) => (
                          <tr key={l.id || idx}>
                            <td>{l.line_no || idx + 1}</td>
                            <td>
                              <span className="fin-vch-code-pill">{l.account_code}</span>{" "}
                              {l.account_name}
                            </td>
                            <td>{l.department_name || "—"}</td>
                            <td className="align-right">
                              {Number(l.debit || 0) > 0 ? formatCurrency(l.debit) : "—"}
                            </td>
                            <td className="align-right">
                              {Number(l.credit || 0) > 0 ? formatCurrency(l.credit) : "—"}
                            </td>
                            <td>{l.description || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Tab Content: GL Entries */}
              {activeTab === "gl" && (
                <div className="fin-vch-tab-pane">
                  {ledgerEntries.length === 0 ? (
                    <div className="fin-vch-empty-tab">
                      No posted General Ledger lines. Voucher may be in draft status.
                    </div>
                  ) : (
                    <table className="fin-vch-table">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>Class</th>
                          <th className="align-right">Debit</th>
                          <th className="align-right">Credit</th>
                          <th>Fiscal Period</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerEntries.map((gl, idx) => (
                          <tr key={gl.id || idx}>
                            <td>
                              <span className="fin-vch-code-pill">{gl.account_code}</span>{" "}
                              {gl.account_name}
                            </td>
                            <td>
                              <span className="fin-vch-sub-badge">{gl.account_class}</span>
                            </td>
                            <td className="align-right">
                              {Number(gl.debit || 0) > 0 ? formatCurrency(gl.debit) : "—"}
                            </td>
                            <td className="align-right">
                              {Number(gl.credit || 0) > 0 ? formatCurrency(gl.credit) : "—"}
                            </td>
                            <td>{gl.period_code || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Tab Content: Attachments */}
              {activeTab === "attachments" && (
                <div className="fin-vch-tab-pane">
                  {attachments.length === 0 ? (
                    <div className="fin-vch-empty-tab">No receipts or document attachments.</div>
                  ) : (
                    <div className="fin-vch-attachments-grid">
                      {attachments.map((att) => (
                        <div key={att.id} className="fin-vch-attachment-card">
                          {att.payload && att.mime_type?.startsWith("image/") ? (
                            <img
                              src={att.payload}
                              alt={att.file_name}
                              className="fin-vch-att-thumb"
                            />
                          ) : (
                            <div className="fin-vch-att-fallback">
                              <Icon name="description" modifiers="lg" />
                            </div>
                          )}
                          <div className="fin-vch-att-meta">
                            <span className="fin-vch-att-name">{att.file_name}</span>
                            <span className="fin-vch-att-size">
                              {att.byte_size ? `${Math.round(att.byte_size / 1024)} KB` : "File"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Audit */}
              {activeTab === "audit" && (
                <div className="fin-vch-tab-pane">
                  {auditLogs.length === 0 ? (
                    <div className="fin-vch-empty-tab">No audit entries recorded.</div>
                  ) : (
                    <div className="fin-vch-audit-list">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="fin-vch-audit-item">
                          <div className="fin-vch-audit-icon">
                            <Icon name="history" modifiers="sm" />
                          </div>
                          <div className="fin-vch-audit-info">
                            <span className="fin-vch-audit-action">{log.action}</span>
                            <span className="fin-vch-audit-meta">
                              By <strong>{log.actor_name}</strong> at {log.created_at || "—"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer Actions */}
              <div className="fin-vch-footer">
                <div className="fin-vch-footer-left">
                  {tx.status === "draft" && (
                    <NeoButton
                      variant="solid"
                      icon="check_circle"
                      loading={actionInProgress}
                      onClick={() => setShowApproveConfirm(true)}
                    >
                      Approve & Post to GL
                    </NeoButton>
                  )}

                  {tx.status === "posted" && (
                    <NeoButton
                      variant="danger"
                      icon="block"
                      loading={actionInProgress}
                      onClick={() => setShowVoidModal(true)}
                    >
                      Void & Reverse
                    </NeoButton>
                  )}
                </div>

                <NeoButton variant="secondary" onClick={onClose}>
                  Close
                </NeoButton>
              </div>
            </>
          )}
        </div>
      </ModalPortal>

      {/* Confirmation for Approve & Post */}
      <ConfirmationModal
        isOpen={showApproveConfirm}
        title="Approve & Post Voucher"
        message={`Are you sure you want to approve voucher ${tx.voucher_no || ""} for ${formatCurrency(tx.total_amount || 0)}? This will post debits and credits directly into the general ledger.`}
        confirmLabel="Approve & Post"
        confirmVariant="solid"
        onConfirm={handleApprove}
        onCancel={() => setShowApproveConfirm(false)}
      />

      {/* Void Voucher Modal with Reason Input */}
      {showVoidModal && (
        <ModalPortal
          isOpen={showVoidModal}
          onClose={() => setShowVoidModal(false)}
          title={`Void Voucher ${tx.voucher_no || ""}`}
          size="small"
        >
          <div className="fin-vch-void-content">
            <p className="fin-vch-void-warning">
              Voiding a posted voucher creates an exact reversal journal entry in the current open
              fiscal period to preserve full double-entry audit integrity.
            </p>

            <div className="fin-vch-void-field">
              <label htmlFor="fin-void-reason" className="fin-vch-void-label">
                Reason for Voiding <span className="req">*</span>
              </label>
              <textarea
                id="fin-void-reason"
                className="fin-vch-void-input"
                rows={3}
                placeholder="e.g. Duplicate voucher entry, wrong client amount..."
                value={voidReason}
                onChange={(e) => setVoidReason(sanitizeRealtime(e.target.value))}
              />
            </div>

            <div className="fin-vch-void-actions">
              <NeoButton
                variant="secondary"
                onClick={() => {
                  setShowVoidModal(false);
                  setVoidReason("");
                }}
              >
                Cancel
              </NeoButton>
              <NeoButton
                variant="danger"
                icon="block"
                loading={actionInProgress}
                onClick={handleVoid}
              >
                Confirm Void & Reverse
              </NeoButton>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};

export default VoucherDetailModal;

