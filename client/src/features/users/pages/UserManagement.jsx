import React, { useState, useEffect } from "react";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import GlassDropdown from "../../../components/common/GlassDropdown";
import PageHeader from "../../../components/common/PageHeader";
import "./UserManagement.css";


import { userService } from "../../../services/userService";

const StatusMsg = ({ msg }) => {
  if (!msg) return null;
  const isError = msg.startsWith("Error") || msg.startsWith("Error");
  return <p className={`status-msg ${isError ? "error" : "success"}`}>{msg}</p>;
};

const UserManagement = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingRoles, setPendingRoles] = useState({});

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
      const p = Array.isArray(pendingData) ? pendingData : (pendingData.users || []);
      const a = Array.isArray(usersData) ? usersData : (usersData.users || []);
      const r = Array.isArray(rolesData) ? rolesData : [];

      setPendingUsers(p);
      setAllUsers(a);
      setAvailableRoles(r);

      const roles = {};
      p.forEach((u) => {
        const defaultRole = (u.roles && u.roles.length > 0 ? u.roles[0] : u.role) || "Client";
        roles[u.id] = defaultRole;
      });
      setPendingRoles((prev) => ({ ...roles, ...prev }));
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setMsg("Error loading users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const roleOptions = (
    availableRoles.length > 0
      ? availableRoles
          .filter((r) => r.name.toLowerCase() !== "admin")
          .map((r) => ({
            value: r.name,
            label: r.name.toUpperCase(),
          }))
      : [
          { value: "Client", label: "CLIENT" },
          { value: "Manager", label: "MANAGER" },
          { value: "Production Crew", label: "PRODUCTION CREW" },
          { value: "Director", label: "DIRECTOR" },
          { value: "Accountant", label: "ACCOUNTANT" },
          { value: "Coordinator", label: "COORDINATOR" },
          { value: "Viewer", label: "VIEWER" },
        ]
  );

  const handlePendingRoleChange = (userId, role) => {
    setPendingRoles((prev) => ({ ...prev, [userId]: role }));
  };

  const approveUser = async (userId, username) => {
    setMsg("");
    const selectedRole = pendingRoles[userId] || "Client";
    try {
      await userService.approveUser(userId, selectedRole);
      setMsg(`Approved user: ${username} as ${selectedRole.toUpperCase()}`);
      fetchData();
    } catch (err) {
      setMsg(`${err.message}`);
    }
  };
  const rejectUser = (userId, username) => {
    setConfirmModal({
      isOpen: true,
      message: `Are you sure you want to reject and delete user: ${username}?`,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, message: "", onConfirm: null });
        setMsg("");
        try {
          await userService.rejectUser(userId);
          setMsg(`Rejected and removed user: ${username}`);
          fetchData();
        } catch (err) {
          setMsg(`${err.message}`);
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
          setMsg(`Updated role for ${username} to ${newRole.toUpperCase()}`);
          fetchData();
        } catch (err) {
          setMsg(`${err.message}`);
        }
      },
    });
  };

  const deleteUser = (userId, username) => {
    setConfirmModal({
      isOpen: true,
      message: `PERMANENTLY DELETE user account: ${username}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, message: "", onConfirm: null });
        setMsg("");
        try {
          await userService.deleteUser(userId);
          setMsg(`Permanently deleted user: ${username}`);
          fetchData();
        } catch (err) {
          setMsg(`${err.message}`);
        }
      },
    });
  };

  return (
    <section id="admin-dashboard">
      <PageHeader
        title="User Management"
        description="Manage pending approvals and view all registered users in the system."
      />
      <div className="admin-content-animated">
        <div className="grid-window um-pending-section">
          <h3>Pending Approvals</h3>
          <StatusMsg msg={msg} />
          {loading ? (
            <p className="um-loading">Loading...</p>
          ) : pendingUsers.length === 0 ? (
            <p className="no-pending">No pending approvals.</p>
          ) : (
            <div className="approval-list">
              <table className="um-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map((u) => {
                    const currentPendingRole = pendingRoles[u.id] || (u.roles && u.roles.length > 0 ? u.roles[0] : u.role) || "Client";
                    // Find matching option or match case-insensitively
                    const matchedOption = roleOptions.find(
                      (opt) => opt.value.toLowerCase() === String(currentPendingRole).toLowerCase()
                    );
                    const selectedVal = matchedOption ? matchedOption.value : currentPendingRole;

                    return (
                      <tr key={u.id}>
                        <td>{u.username}</td>
                        <td>
                          <GlassDropdown
                            className="um-role-dropdown"
                            modifiers="sm fluid"
                            options={roleOptions}
                            value={selectedVal}
                            onChange={(val) => handlePendingRoleChange(u.id, val)}
                          />
                        </td>
                        <td>
                          <div className="um-action-btns">
                            <button
                              className="approve-btn"
                              onClick={() => approveUser(u.id, u.username)}
                            >
                              Approve
                            </button>
                            <button
                              className="reject-btn"
                              onClick={() => rejectUser(u.id, u.username)}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid-window um-dashboard-section">
          <h3>User Dashboard</h3>
          <div className="um-table-container">
            <table className="um-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="um-no-users-cell">
                      No users found. Please contact support.
                    </td>
                  </tr>
                ) : (
                  allUsers.map((u) => {
                    const userRoleList = (u.roles && u.roles.length > 0)
                      ? u.roles
                      : (u.role ? [u.role] : ["Client"]);
                    const primaryRole = userRoleList[0] || "Client";
                    const isAdmin = userRoleList.some(
                      (r) => String(r).trim().toLowerCase() === "admin"
                    );

                    const matchedOption = roleOptions.find(
                      (opt) => opt.value.toLowerCase() === String(primaryRole).toLowerCase()
                    );
                    const selectedVal = matchedOption ? matchedOption.value : primaryRole;

                    return (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>{u.username}</td>
                        <td>
                          {isAdmin ? (
                            <span className="role-badge admin">ADMIN</span>
                          ) : (
                            <GlassDropdown
                              className="um-role-dropdown"
                              modifiers="sm fluid"
                              options={roleOptions}
                              value={selectedVal}
                              onChange={(val) =>
                                handleRoleChange(u.id, val, u.username)
                              }
                            />
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-indicator ${u.is_approved ? "approved" : "pending"}`}
                          >
                            {u.is_approved ? "Active" : "Pending"}
                          </span>
                        </td>
                        <td>
                          {!isAdmin && (
                            <button
                              className="reject-btn delete-acc-btn"
                              onClick={() => deleteUser(u.id, u.username)}
                            >
                              <span className="material-symbols-outlined">
                                delete
                              </span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => {
          setConfirmModal({ isOpen: false, message: "", onConfirm: null });
          fetchData();
        }}
      />
    </section>
  );
};

export default UserManagement;
