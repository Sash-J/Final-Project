import React from "react";
import ModalPortal from "./ModalPortal";
import "./SessionTimeoutModal.css";
import Icon from "../common/Icon";

const SessionTimeoutModal = ({ onLogin }) => {
  return (
    <ModalPortal size="small" showClose={false}>
      <div className="modal-header-section">
        <div className="modal-icon-container warning session-timeout-modal-icon">
          <span>
            <Icon name="person_alert" modifiers="lg" />
            Session Expired!
          </span>
        </div>
      </div>

      <div className="modal-body">
        <p className="session-timeout-modal-text">
          Your session has timed out due to inactivity. Please log in again to
          continue working.
        </p>
      </div>

      <div className="modal-footer">
        <button
          className="sui-btn sui-btn-save session-timeout-modal-btn"
          onClick={onLogin}
        >
          Return to Login
        </button>
      </div>
    </ModalPortal>
  );
};

export default SessionTimeoutModal;
