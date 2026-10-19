import React, { useState, useEffect } from "react";
import ModalPortal from "../../../components/common/ModalPortal";
import GlassDropdown from "../../../components/common/GlassDropdown";
import Icon from "../../../components/common/Icon";
import VerificationBadge from "../../../components/common/VerificationBadge";
import { getPrimaryUserRole } from "../utils/roleUtils";
import "./UserActionModal.css";

const UserActionModal = ({
  user,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onChangeRole,
  onDelete,
  canApprove = false,
  canReject = false,
  canEdit = false,
  canDelete = false,
  roleOptions = [],
}) => {
  const userCurrentRole = user?.roles && user.roles.length > 0 ? user.roles[0] : user?.role;
  const fallbackRole = roleOptions[0]?.value || "";
  const [selectedRole, setSelectedRole] = useState(userCurrentRole || fallbackRole);

  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (user) {
      const r = user.roles && user.roles.length > 0 ? user.roles[0] : user.role;
      setSelectedRole(r || roleOptions[0]?.value || "");
      setImgError(false);
    }
  }, [user, roleOptions]);

  if (!isOpen || !user) return null;

  const isPending = !user.is_approved;
  const displayName = user.full_name || user.username;
  const userRolesList = (user.roles && user.roles.length > 0) ? user.roles : (user.role ? [user.role] : ["Client"]);
  const isAdmin = userRolesList.some((r) => String(r).trim().toLowerCase() === "admin");

  const matchedOption = roleOptions.find(
    (opt) => opt.value.toLowerCase() === String(selectedRole).toLowerCase()
  );
  const currentRoleValue = matchedOption ? matchedOption.value : selectedRole;

  const handleRoleSelect = (newRole) => {
    setSelectedRole(newRole);
    if (!isPending && onChangeRole) {
      onChangeRole(user.id, newRole, user.username);
    }
  };

  const handleApproveClick = () => {
    onApprove && onApprove(user.id, user.username, selectedRole);
    onClose();
  };

  const handleRejectClick = () => {
    onReject && onReject(user.id, user.username);
    onClose();
  };

  const handleDeleteClick = () => {
    onDelete && onDelete(user.id, user.username);
    onClose();
  };

  return (
    <ModalPortal onClose={onClose} size="medium" className="global-modal-glass user-action-modal-glass">
      <div className="user-action-modal-content">
        {/* Modal Header Profile */}
        <div className="user-modal-header">
          <div className="user-modal-avatar-wrapper">
            <div className="user-modal-avatar-circle">
              {user.profile_image && !imgError ? (
                <img
                  src={user.profile_image}
                  alt={displayName}
                  className="user-modal-avatar-img"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="user-modal-avatar-fallback">
                  <span>{displayName.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="user-modal-title-group">
            <h3 className="user-modal-name">
              <span>{displayName}</span>
              <VerificationBadge
                tier={user.verified_level || getPrimaryUserRole(user)}
                size="md"
              />
            </h3>
            <span className="user-modal-username">@{user.username}</span>
            <div className="user-modal-badges-row">
              <span className={`status-badge ${user.is_approved ? "status-approved" : "status-pending"}`}>
                {user.is_approved ? "Active Profile" : "Pending Approval"}
              </span>
            </div>
          </div>
        </div>

        {/* User Details Form Grid */}
        <div className="user-modal-details-grid">
          <div className="user-modal-form-group">
            <label className="neo-label">Assigned Role</label>
            <div className="user-modal-field-control">
              {isAdmin ? (
                <div className="neo-input user-modal-display-input">
                  <span className="role-chip admin-chip">ADMIN (System Owner)</span>
                </div>
              ) : canEdit ? (
                <GlassDropdown
                  className="user-modal-role-dropdown"
                  modifiers="fluid"
                  options={
                    roleOptions.length > 0
                      ? roleOptions
                      : [{ value: "", label: "NO ROLES AVAILABLE" }]
                  }
                  value={currentRoleValue}
                  onChange={handleRoleSelect}
                  disabled={roleOptions.length === 0}
                />
              ) : (
                <div className="neo-input user-modal-display-input">
                  <span className="role-chip">{currentRoleValue}</span>
                </div>
              )}
            </div>
          </div>

          <div className="user-modal-form-group">
            <label className="neo-label">Primary Skill / Department</label>
            <div className="neo-input user-modal-display-input text-highlight">
              {user.skill || "Standard User"}
            </div>
          </div>

          <div className="user-modal-form-group">
            <label className="neo-label">Contact Telephone</label>
            <input
              type="text"
              className="neo-input user-modal-readonly-input"
              readOnly
              value={user.telephone || "Not Provided"}
            />
          </div>

          <div className="user-modal-form-group">
            <label className="neo-label">Gender</label>
            <input
              type="text"
              className="neo-input user-modal-readonly-input"
              readOnly
              value={user.gender || "Unspecified"}
            />
          </div>

          <div className="user-modal-form-group full-width">
            <label className="neo-label">Account Identification</label>
            <input
              type="text"
              className="neo-input user-modal-readonly-input code-font"
              readOnly
              value={`System ID #${user.id} • DB Account`}
            />
          </div>
        </div>

        {/* Modal Action Controls */}
        <div className="user-modal-actions-footer">
          {isPending ? (
            <div className="modal-pending-actions-group">
              {canApprove && (
                <button
                  type="button"
                  className="btn-neo btn-neo-solid modal-action-btn btn-approve"
                  onClick={handleApproveClick}
                >
                  <Icon name="check" modifiers="sm" />
                  <span>
                    Approve as{" "}
                    {(currentRoleValue || fallbackRole || "ROLE").toUpperCase()}
                  </span>
                </button>
              )}
              {canReject && (
                <button
                  type="button"
                  className="btn-neo btn-neo-cancel modal-action-btn btn-reject"
                  onClick={handleRejectClick}
                >
                  <Icon name="close" modifiers="sm" />
                  <span>Reject Application</span>
                </button>
              )}
            </div>
          ) : (
            <div className="modal-approved-actions-group">
              {!isAdmin && canDelete && (
                <button
                  type="button"
                  className="btn-neo btn-neo-cancel modal-action-btn btn-delete"
                  onClick={handleDeleteClick}
                >
                  <Icon name="delete" modifiers="sm" />
                  <span>Delete Account</span>
                </button>
              )}
              <button
                type="button"
                className="btn-neo btn-neo-solid modal-action-btn btn-close"
                onClick={onClose}
              >
                <span>Done</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};

export default UserActionModal;
