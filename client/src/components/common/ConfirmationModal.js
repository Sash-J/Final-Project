import React from "react";
import "./ConfirmationModal.css";
import ModalPortal from "./ModalPortal";

const ConfirmationModal = ({
  isOpen = true,
  title = "Confirmation",
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Yes, Proceed",
  cancelLabel = "Cancel",
}) => {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="modal-backdrop" onClick={onCancel}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{title}</h3>
          </div>
          <div className="modal-body">
            <p>{message}</p>
          </div>
          <div className="modal-footer">
            <button className="btn-modal-cancel" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button className="btn-modal-confirm" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ConfirmationModal;
