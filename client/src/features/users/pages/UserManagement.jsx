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
      const [pendingData, usersData] = await Promise.all([
        userService.getPendingUsers(),
        userService.getUsers(),
      ]);
      const p = Array.isArray(pendingData) ? pendingData : (pendingData.users || []);
      const a = Array.isArray(usersData) ? usersData : (usersData.users || []);
      setPendingUsers(p);
      const roles = {};
      p.forEach((u) => {
        roles[u.id] = u.role || "client";
      });
      setPendingRoles((prev) => ({ ...roles, ...prev }));
      setAllUsers(a);
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

  const handlePendingRoleChange = (userId, role) => {
    setPendingRoles((prev) => ({ ...prev, [userId]: role }));
  };

  const approveUser = async (userId, username) => {
    setMsg("");
    const selectedRole = pendingRoles[userId] || "client";
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
                  {pendingUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>
                        <GlassDropdown
                          className="um-role-dropdown"
                          modifiers="sm fluid"
                          options={[
                            { value: "client", label: "CLIENT" },
                            { value: "manager", label: "MANAGER" },
                            {
                              value: "production_crew",
                              label: "PRODUCTION CREW",
                            },
                          ]}
                          value={pendingRoles[u.id] || u.role}
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
                  ))}
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
                    <td colSpan="5" style={{ textAlign: "center", padding: "20px" }}>
                      No users found. Please contact support.
                    </td>
                  </tr>
                ) : (
                  allUsers.map((u) => {
                  const role =
                    u.role &&
                    ["admin", "manager", "client", "production_crew"].includes(
                      u.role,
                    )
                      ? u.role
                      : "client";
                  return (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.username}</td>
                      <td>
                        {u.role === "admin" ? (
                          <span className="role-badge admin">ADMIN</span>
                        ) : (
                          <GlassDropdown
                            className="um-role-dropdown"
                            modifiers="sm fluid"
                            options={[
                              { value: "client", label: "CLIENT" },
                              { value: "manager", label: "MANAGER" },
                              {
                                value: "production_crew",
                                label: "PRODUCTION CREW"
                              },
                              { value: "director", label: "DIRECTOR" },
                            ]}
                            value={role}
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
                        {u.role !== "admin" && (
                          <button
                            className="reject-btn delete-acc-btn"
                            onClick={() => deleteUser(u.id, u.username)}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: "1rem" }}
                            >
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
