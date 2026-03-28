import React from 'react';
import ModalPortal from './ModalPortal';
import './ConfirmationModal.css'; // Reuse confirmation styles for consistency

const SessionTimeoutModal = ({ onLogin }) => {
    return (
        <ModalPortal>
            <div className="sui-modal-overlay">
                <div className="sui-modal-content sui-modal-small modal-animate-in">
                    <div className="modal-icon-container warning">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                    <h3>Session Expired</h3>
                    <p>Your session has timed out due to inactivity. Please log in again to continue working.</p>
                    
                    <div className="sui-modal-actions">
                        <button 
                            className="sui-btn sui-btn-save" 
                            style={{ width: '100%', marginTop: '10px' }}
                            onClick={onLogin}
                        >
                            Return to Login
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
};

export default SessionTimeoutModal;
