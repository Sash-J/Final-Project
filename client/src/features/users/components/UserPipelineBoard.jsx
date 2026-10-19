import React, { useState, useMemo } from "react";
import UserPipelineColumn from "./UserPipelineColumn";
import Icon from "../../../components/common/Icon";
import HoverTooltip from "../../../components/common/HoverTooltip";
import { categorizeRole, compareUsersByPermission } from "../utils/roleUtils";
import "./UserPipelineBoard.css";

const UserPipelineBoard = ({
  pendingUsers = [],
  allUsers = [],
  onInspectUser,
  onApproveUser,
  onRejectUser,
  canApprove,
  canReject,
  roleOptions,
  onRefresh,
  loading = false,
}) => {
  const [activeSegment, setActiveSegment] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Categorize approved users into the 3 groups
  const categorized = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matchesQuery = (u) => {
      if (!q) return true;
      const un = String(u.username || "").toLowerCase();
      const fn = String(u.full_name || "").toLowerCase();
      const sk = String(u.skill || "").toLowerCase();
      const tp = String(u.telephone || "").toLowerCase();
      const rl = (u.roles || []).join(" ").toLowerCase();
      return un.includes(q) || fn.includes(q) || sk.includes(q) || tp.includes(q) || rl.includes(q);
    };

    const filteredPending = pendingUsers.filter(matchesQuery);

    const approvedList = allUsers.filter((u) => u.is_approved);

    const internalStaff = [];
    const productionCrew = [];
    const clientAccounts = [];

    approvedList.forEach((u) => {
      if (!matchesQuery(u)) return;

      const userRoles = [...(u.roles || []), u.role, u.verified_level].filter(Boolean);
      const category = categorizeRole(userRoles);

      if (category === "internal") {
        internalStaff.push(u);
      } else if (category === "crew") {
        productionCrew.push(u);
      } else {
        clientAccounts.push(u);
      }
    });

    return {
      pending: [...filteredPending].sort(compareUsersByPermission),
      internal: [...internalStaff].sort(compareUsersByPermission),
      crew: [...productionCrew].sort(compareUsersByPermission),
      clients: [...clientAccounts].sort(compareUsersByPermission),
    };
  }, [pendingUsers, allUsers, searchQuery]);

  const segments = [
    { key: "all", label: "All", count: pendingUsers.length + allUsers.length },
    { key: "pending", label: "Pending Approvals", count: categorized.pending.length },
    { key: "internal", label: "Internal Crew", count: categorized.internal.length },
    { key: "crew", label: "Production Crew", count: categorized.crew.length },
    { key: "clients", label: "Clients", count: categorized.clients.length },
  ];

  return (
    <div className="pipeline-board-container">
      {/* Top Header & Segmented Pill Switcher */}
      <div className="pipeline-top-bar">
        {/* Segmented Pill Selector (matches reference board top pill) */}
        <div className="pipeline-segmented-pill">
          {segments.map((seg) => (
            <button
              key={seg.key}
              type="button"
              className={`segmented-pill-btn ${activeSegment === seg.key ? "active" : ""}`}
              onClick={() => setActiveSegment(seg.key)}
            >
              <span>{seg.label}</span>
              {seg.key === "pending" && seg.count > 0 && (
                <span className="segmented-badge-alert">{seg.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search & Utility Action Icons */}
        <div className="pipeline-tools-group">
          <div className="pipeline-search-wrap">
            <Icon name="search" modifiers="xs" className="pipeline-search-icon" />
            <input
              type="text"
              placeholder="Search user, skill, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pipeline-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="pipeline-search-clear"
                onClick={() => setSearchQuery("")}
              >
                <Icon name="close" modifiers="xs" />
              </button>
            )}
          </div>

          <HoverTooltip text="Refresh Users">
            <button
              type="button"
              className={`btn-neo pipeline-refresh-btn ${loading ? "is-spinning" : ""}`}
              aria-label="Refresh Users"
              onClick={onRefresh}
            >
              <Icon name="refresh" modifiers="sm" />
              <span>Refresh</span>
            </button>
          </HoverTooltip>
        </div>
      </div>

      {/* Main Kanban Columns Area */}
      <div className="pipeline-columns-grid">
        {(activeSegment === "all" || activeSegment === "pending") && (
          <UserPipelineColumn
            title="Pending Approvals"
            count={categorized.pending.length}
            users={categorized.pending}
            columnKey="pending"
            onInspectUser={onInspectUser}
            onApproveUser={onApproveUser}
            onRejectUser={onRejectUser}
            canApprove={canApprove}
            canReject={canReject}
            roleOptions={roleOptions}
          />
        )}

        {(activeSegment === "all" || activeSegment === "internal") && (
          <UserPipelineColumn
            title="Internal Crew"
            count={categorized.internal.length}
            users={categorized.internal}
            columnKey="internal"
            onInspectUser={onInspectUser}
            onApproveUser={onApproveUser}
            onRejectUser={onRejectUser}
            canApprove={canApprove}
            canReject={canReject}
            roleOptions={roleOptions}
          />
        )}

        {(activeSegment === "all" || activeSegment === "crew") && (
          <UserPipelineColumn
            title="Production Crew"
            count={categorized.crew.length}
            users={categorized.crew}
            columnKey="crew"
            onInspectUser={onInspectUser}
            onApproveUser={onApproveUser}
            onRejectUser={onRejectUser}
            canApprove={canApprove}
            canReject={canReject}
            roleOptions={roleOptions}
          />
        )}

        {(activeSegment === "all" || activeSegment === "clients") && (
          <UserPipelineColumn
            title="Clients"
            count={categorized.clients.length}
            users={categorized.clients}
            columnKey="client"
            onInspectUser={onInspectUser}
            onApproveUser={onApproveUser}
            onRejectUser={onRejectUser}
            canApprove={canApprove}
            canReject={canReject}
            roleOptions={roleOptions}
          />
        )}
      </div>
    </div>
  );
};

export default UserPipelineBoard;
