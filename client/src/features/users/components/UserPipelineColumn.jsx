import React from "react";
import UserCapsuleCard from "./UserCapsuleCard";
import Icon from "../../../components/common/Icon";
import "./UserPipelineColumn.css";

const UserPipelineColumn = ({
  title,
  count,
  users = [],
  columnKey,
  onInspectUser,
  onApproveUser,
  onRejectUser,
  canApprove,
  canReject,
  roleOptions,
}) => {
  return (
    <div className={`pipeline-column pipeline-col-${columnKey}`}>
      {/* Column Pill Header */}
      <div className="pipeline-column-header global-glass-effect">
        <span className="pipeline-header-title">{title}</span>
        <span className="pipeline-header-badge">{count}</span>
      </div>

      {/* Cards Stack with Connected Node Links */}
      <div className="pipeline-cards-stack">
        {users.length === 0 ? (
          <div className="pipeline-empty-card">
            <Icon name="person_off" modifiers="sm" className="pipeline-empty-icon" />
            <span className="pipeline-empty-text">No users in this stage</span>
          </div>
        ) : (
          users.map((user) => (
            <UserCapsuleCard
              key={user.id}
              user={user}
              onInspect={onInspectUser}
              onApprove={onApproveUser}
              onReject={onRejectUser}
              canApprove={canApprove}
              canReject={canReject}
              roleOptions={roleOptions}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default UserPipelineColumn;
