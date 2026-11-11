import React, { useCallback } from "react";
import PropTypes from "prop-types";
import ModalPortal from "../ModalPortal";
import Icon from "../Icon";
import FloatingInput from "../FloatingInput";
import NeoButton from "../NeoButton";
import "./PublishModal.css";

/**
 * Common Publish Modal component for both Budget Revisions and Payment Receipt Confirmations.
 * Features an expansive, breathable dual-column executive layout inspired by the Project Finances modal.
 * Adheres strictly to CSS separation rules (no inline styles) and 8-level typography scale.
 */
const PublishModal = ({
  isOpen,
  onClose,
  entityType = "document",
  documentData = {},
  versionOptions = [],
  selectedVersionId = "",
  onVersionChange,
  audiences = [],
  transmittalNote = "",
  onTransmittalNoteChange,
  onPublish,
  onUnpublish,
  isSubmitting = false,
}) => {
  const handleAudienceClick = useCallback((aud) => {
    if (aud && aud.onChange) {
      aud.onChange(!aud.checked);
    }
  }, []);

  const handleAudienceKeyDown = useCallback((e, aud) => {
    if ((e.key === "Enter" || e.key === " ") && aud && aud.onChange) {
      e.preventDefault();
      aud.onChange(!aud.checked);
    }
  }, []);

  if (!isOpen) return null;

  const isPublished = Boolean(documentData?.isPublished);
  const formattedPublishedDate = documentData?.publishedAt
    ? new Date(documentData.publishedAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    : null;

  const entityLabel = entityType === "budget" ? "Budget Revision" : "Payment Confirmation";

  return (
    <ModalPortal
      onClose={onClose}
      showClose={true}
      size="large"
      className="global-modal-glass receipt-modal-glass publish-modal-glass"
    >
      <div className="publish-modal-container">
        {/* Top Header Bar matching PaymentReceiptModal */}
        <div className="publish-modal-header-actions">
          <div className="publish-header-title-group">
            <div className="publish-header-icon">
              <Icon name="publish" modifiers="sm" />
            </div>
            <h3 className="publish-header-title">
              Publish {entityLabel}
            </h3>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="publish-modal-body">
          {/* Expansive 2-Column Grid */}
          <div className="publish-main-grid">
            {/* LEFT COLUMN: Document Dossier & Context */}
            <div className="publish-column-dossier">
              <label className="publish-section-label">
                Document Specifications &amp; Context
              </label>

              <div className="publish-doc-card">
                <div className="publish-doc-top">
                  {documentData?.code && (
                    <span className="publish-doc-code">{documentData.code}</span>
                  )}
                  <span
                    className={`publish-status-tag ${isPublished ? "is-published" : "is-draft"
                      }`}
                  >
                    <Icon
                      name={isPublished ? "verified" : "edit_document"}
                      modifiers="xs"
                    />
                    <span>
                      {isPublished
                        ? `Published${formattedPublishedDate ? ` (${formattedPublishedDate})` : ""}`
                        : "Internal Draft / Unreleased"}
                    </span>
                  </span>
                </div>

                <div className="publish-doc-main">
                  <h4 className="publish-doc-title">
                    {documentData?.title || "Document Particulars"}
                  </h4>
                </div>

                {/* Prominent Amount / Metric Highlight (Matching Finance Modal stat card) */}
                {documentData?.amountFormatted && (
                  <div className="publish-amount-stat">
                    <div className="publish-stat-icon-wrap">
                      <Icon
                        name={entityType === "receipt" ? "payments" : "account_balance_wallet"}
                        modifiers="sm"
                      />
                    </div>
                    <div className="publish-stat-text">
                      <span className="publish-stat-label">
                        {entityType === "receipt"
                          ? "Confirmed Receipt Amount"
                          : "Budget Allocation"}
                      </span>
                      <span className="publish-stat-value">
                        {documentData.amountFormatted}
                      </span>
                    </div>
                  </div>
                )}

                {/* Structured Metadata Tiles */}
                <div className="publish-doc-meta-grid">
                  {documentData?.subtitle && (
                    <div className="publish-meta-tile">
                      <span className="publish-meta-label">Project</span>
                      <span className="publish-meta-value">
                        {documentData.subtitle}
                      </span>
                    </div>
                  )}

                  {documentData?.dateFormatted && (
                    <div className="publish-meta-tile">
                      <span className="publish-meta-label">Document Date</span>
                      <span className="publish-meta-value">
                        {documentData.dateFormatted}
                      </span>
                    </div>
                  )}

                  {documentData?.signatory && (
                    <div className="publish-meta-tile">
                      <span className="publish-meta-label">Authorizing Signatory</span>
                      <span className="publish-meta-value">
                        {documentData.signatory}
                        {documentData?.signatoryRole ? ` (${documentData.signatoryRole})` : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Version Switcher (Budget Workflow) */}
              {versionOptions.length > 0 && onVersionChange && (
                <div className="publish-version-bar">
                  <FloatingInput
                    as="select"
                    label="Select Version to Publish"
                    value={selectedVersionId}
                    onChange={(e) => onVersionChange(e.target.value)}
                    disabled={isSubmitting}
                  >
                    {versionOptions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </FloatingInput>
                </div>
              )}

              {/* Delivery Protocol & Gatekeeping strip */}
              <div className="publish-channel-wrapper">
                <label className="publish-section-label">
                  Delivery Channels &amp; Audit
                </label>
                <div className="publish-channel-strip">
                  <span className="publish-channel-item is-enabled">
                    <Icon name="check_circle" modifiers="xs" />
                    <span>In-App Portal Access &amp; Notification</span>
                  </span>
                  <span className="publish-channel-item is-future">
                    <Icon name="mail" modifiers="xs" />
                    <span>Email Dispatch (Internal Review First)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Target Audience & Transmittal */}
            <div className="publish-column-governance">
              {/* Target Audience & Visibility Matrix */}
              <div className="publish-audience-section">
                <label className="publish-section-label">
                  Target Audience &amp; Visibility Matrix
                </label>
                <div className="publish-audience-grid">
                  {audiences.map((aud) => (
                    <div
                      key={aud.id}
                      className={`publish-audience-card ${aud.checked ? "is-checked" : ""
                        }`}
                      onClick={() => handleAudienceClick(aud)}
                      onKeyDown={(e) => handleAudienceKeyDown(e, aud)}
                      tabIndex={0}
                      role="checkbox"
                      aria-checked={Boolean(aud.checked)}
                    >
                      <div className="publish-audience-left">
                        <div className="publish-audience-icon">
                          <Icon name={aud.icon || "person"} modifiers="sm" />
                        </div>
                        <div className="publish-audience-info">
                          <div className="publish-audience-title-row">
                            <span className="publish-audience-name">{aud.title}</span>
                            {aud.badge && (
                              <span className="publish-audience-badge">
                                {aud.badge}
                              </span>
                            )}
                          </div>
                          <span className="publish-audience-desc">
                            {aud.description}
                          </span>
                          {aud.recipient && (
                            <span className="publish-audience-target">
                              Target: <strong>{aud.recipient}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className={`publish-toggle-switch ${aud.checked ? "is-active" : ""
                          }`}
                      >
                        <div className="publish-toggle-knob" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transmittal Note / Executive Message */}
              <div className="publish-note-section">
                <FloatingInput
                  as="textarea"
                  label="Transmittal Note / Executive Message"
                  rows={4}
                  placeholder="Add an optional executive dispatch note or instructions for the recipient..."
                  value={transmittalNote}
                  onChange={(e) =>
                    onTransmittalNoteChange && onTransmittalNoteChange(e.target.value)
                  }
                  disabled={isSubmitting}
                />
                <span className="publish-note-hint">
                  Optional memorandum attached directly to the released document dossier.
                </span>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="publish-modal-footer">
            {isPublished && onUnpublish && (
              <NeoButton
                type="button"
                variant="danger"
                icon="undo"
                onClick={onUnpublish}
                disabled={isSubmitting}
              >
                Unpublish / Revoke
              </NeoButton>
            )}

            <div className="publish-footer-right">
              <NeoButton
                type="button"
                variant="cancel"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </NeoButton>
              <NeoButton
                type="button"
                variant="solid"
                icon={isPublished ? "check" : "send"}
                loading={isSubmitting}
                onClick={onPublish}
              >
                {isPublished ? "Update Publication" : "Publish & Release"}
              </NeoButton>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

PublishModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  entityType: PropTypes.oneOf(["budget", "receipt", "document"]),
  documentData: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    code: PropTypes.string,
    title: PropTypes.string,
    subtitle: PropTypes.string,
    amountFormatted: PropTypes.string,
    dateFormatted: PropTypes.string,
    signatory: PropTypes.string,
    signatoryRole: PropTypes.string,
    isPublished: PropTypes.bool,
    publishedAt: PropTypes.string,
  }),
  versionOptions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  selectedVersionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onVersionChange: PropTypes.func,
  audiences: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      description: PropTypes.string,
      icon: PropTypes.string,
      badge: PropTypes.string,
      recipient: PropTypes.string,
      checked: PropTypes.bool,
      onChange: PropTypes.func,
    })
  ),
  transmittalNote: PropTypes.string,
  onTransmittalNoteChange: PropTypes.func,
  onPublish: PropTypes.func.isRequired,
  onUnpublish: PropTypes.func,
  isSubmitting: PropTypes.bool,
};

export default PublishModal;
