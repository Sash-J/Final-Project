import React, { useState, useEffect, useMemo } from "react";
import PageHeader from "../../../components/common/PageHeader";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import CompositeBentoCard from "../../../components/common/CompositeBentoCard";
import GlassSurface from "../../../components/effects/GlassSurface";
import UserPipelineBoard from "../components/UserPipelineBoard";
import UserRoleDonutWidget from "../components/UserRoleDonutWidget";
import UserMetricsGaugeWidget from "../components/UserMetricsGaugeWidget";
import UserActionModal from "../components/UserActionModal";
import { userService } from "../../../services/userService";
import { useAuth } from "../../auth/context/AuthContext";
import toast from "react-hot-toast";
import Icon from "../../../components/common/Icon";
import { formatRoleOptions, getDefaultRole, categorizeRole } from "../utils/roleUtils";
import { PageContainer, PageContentCard } from "../../../components/common/PageContainer";
import "./UserManagement.css";

const UserManagement = () => {
  const { hasPermission } = useAuth();
  const canApprove = hasPermission("user.approve");
  const canReject = hasPermission("user.reject");
  const canEdit = hasPermission("user.edit");
  const canDelete = hasPermission("employee.delete");

  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inspectedUser, setInspectedUser] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    message: "",
    onConfirm: null,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pendingData, usersData, rolesData] = await Promise.all([
        userService.getPendingUsers(),
        userService.getUsers(),
        userService.getRoles().catch(() => []),
      ]);
      const p = Array.isArray(pendingData) ? pendingData : pendingData.users || [];
      const a = Array.isArray(usersData) ? usersData : usersData.users || [];
      const r = Array.isArray(rolesData) ? rolesData : [];

      setPendingUsers(p);
      setAllUsers(a);
      setAvailableRoles(r);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      toast.error("Error loading users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const roleOptions = useMemo(() => {
    if (availableRoles.length > 0) {
      return formatRoleOptions(availableRoles);
    }
    // Dynamic fallback: extract distinct roles present among current users in DB
    const distinctRoles = Array.from(
      new Set(
        allUsers
          .flatMap((u) => (u.roles && u.roles.length ? u.roles : [u.role]))
          .filter(Boolean)
      )
    ).map((name) => ({ name }));

    return formatRoleOptions(distinctRoles);
  }, [availableRoles, allUsers]);

  const workforceMetrics = useMemo(() => {
    let internal = 0;
    let crew = 0;
    let client = 0;
    let admin = 0;
    let director = 0;
    let manager = 0;
    let permissioned = 0;
    let directorUser = null;
    let fallbackLead = null;

    allUsers.forEach((u) => {
      const userRoles = [...(u.roles || []), u.role]
        .filter(Boolean)
        .map((r) => String(r).trim().toLowerCase());

      const isAdmin = userRoles.some(
        (r) => r === "admin" || r.includes("admin")
      );
      const isDirector = userRoles.some(
        (r) => r === "director" || r.includes("director")
      );
      const isManager = userRoles.some(
        (r) => r === "manager" || r.includes("manager")
      );

      if (isAdmin) admin++;
      if (isDirector) {
        director++;
        if (!directorUser) {
          directorUser = u;
        }
      }
      if (isManager) manager++;
      // Permissioned counter excludes Admin, only counts Director and Manager
      if (isDirector || isManager) permissioned++;

      const category = categorizeRole(userRoles);

      if (category === "internal") {
        internal++;
        const isLeadCandidate = userRoles.some((r) => {
          return (
            r === "director" ||
            r === "manager" ||
            r.includes("lead")
          );
        });
        if (!fallbackLead && isLeadCandidate) {
          fallbackLead = u;
        }
      } else if (category === "crew") {
        crew++;
      } else {
        client++;
      }
    });

    const approvedCount = allUsers.filter((u) => u.is_approved).length;
    const total = allUsers.length || 1;
    const activeRatio = Math.round((approvedCount / total) * 100);

    const leadUser = directorUser || fallbackLead || allUsers[0] || null;
    const displayName = directorUser
      ? directorUser.full_name || directorUser.username || "Director"
      : "Director";
    const displayRole = directorUser
      ? directorUser.roles?.find((r) =>
        String(r).toLowerCase().includes("director")
      ) ||
      directorUser.role ||
      "Director"
      : "Director";
    const initial = displayName.charAt(0).toUpperCase();

    return {
      leadUser,
      displayName,
      displayRole,
      initial,
      internalCount: internal,
      crewCount: crew,
      clientCount: client,
      adminCount: admin,
      directorCount: director,
      managerCount: manager,
      permissionedCount: permissioned,
      activePct: activeRatio,
    };
  }, [allUsers]);

  const handleApprove = async (userId, username, roleToAssign) => {
    const defaultRole = getDefaultRole(roleOptions);
    const role = roleToAssign || defaultRole;
    if (!role) {
      toast.error("No valid role found for assignment. Please configure roles.");
      return;
    }
    try {
      await userService.approveUser(userId, role);
      toast.success(`Approved ${username} as ${role.toUpperCase()}`);
      fetchData();
      if (inspectedUser && inspectedUser.id === userId) {
        setInspectedUser(null);
      }
    } catch (err) {
      toast.error(err.message || "Failed to approve user");
    }
  };

  const handleReject = (userId, username) => {
    setConfirmModal({
      isOpen: true,
      message: `Are you sure you want to reject and delete user: ${username}?`,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, message: "", onConfirm: null });
        try {
          await userService.rejectUser(userId);
          toast.success(`Rejected user: ${username}`);
          fetchData();
          if (inspectedUser && inspectedUser.id === userId) {
            setInspectedUser(null);
          }
        } catch (err) {
          toast.error(err.message || "Failed to reject user");
        }
      },
    });
  };

  const handleRoleChange = (userId, newRole, username) => {
    setConfirmModal({
      isOpen: true,
      message: `Change role of "${username}" to ${newRole.toUpperCase()}?`,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, message: "", onConfirm: null });
        try {
          await userService.updateUserRole(userId, newRole);
          toast.success(`Updated role for ${username} to ${newRole.toUpperCase()}`);
          fetchData();
          if (inspectedUser && inspectedUser.id === userId) {
            setInspectedUser((prev) => ({
              ...prev,
              roles: [newRole],
              role: newRole,
            }));
          }
        } catch (err) {
          toast.error(err.message || "Failed to update role");
        }
      },
    });
  };

  const handleDelete = (userId, username) => {
    setConfirmModal({
      isOpen: true,
      message: `PERMANENTLY DELETE user account: ${username}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, message: "", onConfirm: null });
        try {
          await userService.deleteUser(userId);
          toast.success(`Permanently deleted user: ${username}`);
          fetchData();
          if (inspectedUser && inspectedUser.id === userId) {
            setInspectedUser(null);
          }
        } catch (err) {
          toast.error(err.message || "Failed to delete user");
        }
      },
    });
  };

  return (
    <PageContainer id="user-management">
      <PageHeader
        category="User Management"
        title="Overview"
        description="Operational workforce pipelines, role assignments, and member analytics."
      />

      <PageContentCard>
        {/* Main Connected Kanban Board */}
        <UserPipelineBoard
          pendingUsers={pendingUsers}
          allUsers={allUsers}
          onInspectUser={(u) => setInspectedUser(u)}
          onApproveUser={handleApprove}
          onRejectUser={handleReject}
          canApprove={canApprove}
          canReject={canReject}
          roleOptions={roleOptions}
          onRefresh={fetchData}
          loading={loading}
        />

        {/* Workforce Demographics & Velocity Section */}
        <div className="um-analytics-section">
          <div className="um-analytics-header">
            <Icon name="analytics" modifiers="md" />
            <h3>Workforce Demographics &amp; Velocity</h3>
            <span className="um-analytics-count">
              {allUsers.length} active profiles
            </span>
          </div>
          <div className="um-bottom-bento-grid">
            <div className="um-composite-bento-wrapper">
              <CompositeBentoCard
                className="user-workforce-bento"
                onClick={() =>
                  workforceMetrics.leadUser &&
                  setInspectedUser(workforceMetrics.leadUser)
                }
                pillContent={
                  <div className="summary-lead-container">
                    <GlassSurface
                      className="summary-avatar"
                      width="44px"
                      height="44px"
                      borderRadius={22}
                      blur={6}
                      opacity={0}
                      backgroundOpacity={0}
                    >
                      <span className="summary-avatar-initial">
                        {workforceMetrics.initial}
                      </span>
                    </GlassSurface>
                    <div className="summary-lead-text">
                      <span className="summary-lead-name">
                        {workforceMetrics.displayName}
                      </span>
                      <span className="summary-lead-role">
                        {workforceMetrics.displayRole}
                      </span>
                    </div>
                  </div>
                }
                bottomContent={
                  <div className="summary-bento-middle">
                    <h3 className="summary-bento-title">User Permissions</h3>
                    <span className="summary-bento-subtitle">
                      Director: <strong>{workforceMetrics.directorCount}</strong>
                      <span className="bento-stat-spacer"></span>
                      Manager: <strong>{workforceMetrics.managerCount}</strong>
                    </span>
                    <div className="summary-progress-container">
                      <div className="summary-progress-bar">
                        <div
                          className="summary-progress-fill"
                          style={{ width: `${workforceMetrics.activePct}%` }}
                        />
                      </div>
                      <div className="summary-progress-labels">
                        <span>Active Workforce Capacity</span>
                        <span className="summary-progress-value">
                          {workforceMetrics.activePct}%
                        </span>
                      </div>
                    </div>
                  </div>
                }
                rightContent={
                  <div className="summary-bento-top-right">
                    <GlassSurface
                      className="summary-selector"
                      width="max-content"
                      height="auto"
                      borderRadius={30}
                      blur={10}
                      opacity={0.4}
                      backgroundOpacity={0.2}
                    >
                      <div className="summary-selector-icon">
                        <Icon name="groups" modifiers="sm" />
                      </div>
                      <span>{workforceMetrics.permissionedCount} Permissioned</span>
                      <Icon
                        name="expand_more"
                        modifiers="sm"
                        className="summary-selector-caret"
                      />
                    </GlassSurface>
                  </div>
                }
              />
            </div>
            <UserRoleDonutWidget allUsers={allUsers} />
            <UserMetricsGaugeWidget allUsers={allUsers} pendingUsers={pendingUsers} />
          </div>
        </div>
      </PageContentCard>

      {/* User Inspection & Actions Modal */}
      <UserActionModal
        user={inspectedUser}
        isOpen={Boolean(inspectedUser)}
        onClose={() => setInspectedUser(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        onChangeRole={handleRoleChange}
        onDelete={handleDelete}
        canApprove={canApprove}
        canReject={canReject}
        canEdit={canEdit}
        canDelete={canDelete}
        roleOptions={roleOptions}
      />

      {/* Confirmation Dialog Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => {
          setConfirmModal({ isOpen: false, message: "", onConfirm: null });
        }}
      />
    </PageContainer>
  );
};

export default UserManagement;
