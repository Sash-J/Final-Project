import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import Icon from "./Icon";
import "./Modal.css";

/**
 * Standardized Modal component that provides a global backdrop, 
 * glass card container, and consistent close button.
 * 
 * @param {Object} props
 * @param {Function} props.onClose - Function to close the modal
 * @param {Boolean} props.showClose - Whether to show the top-right close button
 * @param {String} props.size - 'small' for confirmation-style boxes, defaults to 'large'
 * @param {String} props.className - Additional class for the glass container
 */
const ModalPortal = ({ children, onClose, showClose = true, size = "large", className = "" }) => {
  const modalRoot = document.getElementById("modal-root");
  
  // Prevent background scrolling when modal is open
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
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
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
