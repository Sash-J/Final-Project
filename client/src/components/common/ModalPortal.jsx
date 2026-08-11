import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import Icon from "./Icon";
import "./Modal.css";

/**
 * @param {Object} props
 * @param {Function} props.onClose
 * @param {Boolean} props.showClose
 * @param {String} props.size
 * @param {String} props.className
 */
const ModalPortal = ({
  children,
  onClose,
  showClose = true,
  size = "large",
  className = "",
}) => {
  const modalRoot = document.getElementById("modal-root");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const overlayMouseDown = React.useRef(false);

  const content = (
    <div
      className="modal-portal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          overlayMouseDown.current = true;
        }
      }}
      onMouseUp={(e) => {
        if (overlayMouseDown.current && e.target === e.currentTarget) {
          if (onClose) onClose();
        }
        overlayMouseDown.current = false;
      }}
    >
      <div
        className={`modal-glass-container ${size === "small" ? "modal-small" : ""} ${className}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {showClose && onClose && (
          <button className="modal-close-btn" onClick={onClose}>
            <Icon name="close" modifiers="md" />
          </button>
        )}
        {children}
      </div>
    </div>
  );

  if (!modalRoot) return content;
  return ReactDOM.createPortal(content, modalRoot);
};

export default ModalPortal;
