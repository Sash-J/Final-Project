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
  confirmVariant = "danger", // 'danger' | 'accent' | 'glass'
  cancelVariant = "glass",   // 'danger' | 'accent' | 'glass'
}) => {
  if (!isOpen) return null;

  return (
    <ModalPortal onClose={onCancel} size="small" showClose={false} className="confirmation-modal-glass">
      <div className="modal-header">
        <h3>{title}</h3>
      </div>
      <div className="modal-body">
        <p>{message}</p>
      </div>
      <div className="modal-footer">
        <button 
          className={`btn-modal-cancel variant-${cancelVariant}`} 
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button 
          className={`btn-modal-confirm variant-${confirmVariant}`} 
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalPortal>
  );
};

export default ConfirmationModal;
