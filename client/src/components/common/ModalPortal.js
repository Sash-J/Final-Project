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

  const content = (
    <div className="modal-portal-overlay" onClick={onClose}>
      <div
        className={`modal-glass-container ${size === "small" ? "modal-small" : ""} ${className}`}
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
