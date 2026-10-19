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
  confirmVariant = "danger",
  cancelVariant = "glass",
}) => {
  if (!isOpen) return null;

  return (
    <ModalPortal
      onClose={onCancel}
      size="small"
      showClose={false}
      className="global-modal-glass confirmation-modal-glass"
    >
      <div className="modal-header">
        <h3>{title}</h3>
      </div>
      <div className="modal-body">
        <p>{message}</p>
      </div>
      <div className="modal-footer">
        <button
          className={`btn-neo btn-neo-cancel btn-modal-cancel variant-${cancelVariant}`}
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          className={`btn-neo ${confirmVariant === "danger" ? "btn-neo-cancel variant-danger" : "btn-neo-solid"} btn-modal-confirm`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalPortal>
  );
};

export default ConfirmationModal;
