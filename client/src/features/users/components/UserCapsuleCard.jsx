import React, { useState } from "react";
import GlassSurface from "../../../components/effects/GlassSurface";
import Icon from "../../../components/common/Icon";
import HoverTooltip from "../../../components/common/HoverTooltip";
import VerificationBadge from "../../../components/common/VerificationBadge";
import { getRoleCategoryClass, getPrimaryUserRole } from "../utils/roleUtils";
import "./UserCapsuleCard.css";

const UserCapsuleCard = ({
  user,
  onInspect,
  onApprove,
  onReject,
  canApprove = false,
  canReject = false,
  roleOptions = [],
}) => {
  const [imgError, setImgError] = useState(false);
  const isPending = !user.is_approved;
  const displayName = user.full_name || user.username;
  const primaryRole = getPrimaryUserRole(user);
  const subtext = user.skill || (isPending ? (user.telephone || "Awaiting review") : primaryRole);
  const roleCategoryClass = getRoleCategoryClass(primaryRole, isPending);

  const getInitial = () => {
    if (user.full_name) return user.full_name.charAt(0).toUpperCase();
    if (user.username) return user.username.charAt(0).toUpperCase();
    return "?";
  };

  return (
    <div
      className={`user-capsule-card global-glass-effect ${roleCategoryClass} ${isPending ? "is-pending" : ""}`}
      onClick={() => onInspect && onInspect(user)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInspect && onInspect(user);
        }
      }}
    >
      <div className="capsule-avatar-wrapper">
        <GlassSurface
          className="capsule-avatar-glass"
          width="36px"
          height="36px"
          borderRadius={18}
          blur={6}
          opacity={0.3}
          backgroundOpacity={0.15}
        >
          {user.profile_image && !imgError ? (
            <img
              src={user.profile_image}
              alt={displayName}
              className="capsule-avatar-img"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="capsule-avatar-fallback">
              <span>{getInitial()}</span>
            </div>
          )}
        </GlassSurface>
      </div>

      <div className="capsule-info-block">
        <div className="capsule-name-row">
          <h4 className="capsule-user-name" title={displayName}>
            {displayName}
          </h4>
          <VerificationBadge
            tier={user.verified_level || primaryRole}
            size="sm"
          />
        </div>
        <p className="capsule-subtext" title={subtext}>
          {subtext}
        </p>
      </div>

      <div className="capsule-action-block" onClick={(e) => e.stopPropagation()}>
        {isPending ? (
          <div className="capsule-pending-actions">
            {canApprove && (
              <HoverTooltip text="Quick Approve">
                <button
                  type="button"
                  className="capsule-quick-btn approve"
                  aria-label="Quick Approve"
                  onClick={() => onApprove && onApprove(user.id, user.username)}
                >
                  <Icon name="check" modifiers="xs" />
                </button>
              </HoverTooltip>
            )}
            {canReject && (
              <HoverTooltip text="Quick Reject">
                <button
                  type="button"
                  className="capsule-quick-btn reject"
                  aria-label="Quick Reject"
                  onClick={() => onReject && onReject(user.id, user.username)}
                >
                  <Icon name="close" modifiers="xs" />
                </button>
              </HoverTooltip>
            )}
            <HoverTooltip text="Pending approval">
              <span className="capsule-clock-icon" aria-label="Pending approval">
                <Icon name="schedule" modifiers="sm" />
              </span>
            </HoverTooltip>
          </div>
        ) : (
          <div className="capsule-standard-actions">
            <HoverTooltip text="Inspect user">
              <button
                type="button"
                className="capsule-options-btn"
                aria-label="Inspect user"
                onClick={() => onInspect && onInspect(user)}
              >
                <Icon name="more_horiz" modifiers="sm" />
              </button>
            </HoverTooltip>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserCapsuleCard;
