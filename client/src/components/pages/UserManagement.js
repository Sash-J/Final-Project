import React, { useState, useEffect } from 'react';
import './UserManagement.css';

const API = 'http://localhost:5000';

const StatusMsg = ({ msg }) => {
    if (!msg) return null;
    const isError = msg.startsWith('Error') || msg.startsWith('❌');
    return (
        <p className={`status-msg ${isError ? 'error' : 'success'}`}>{msg}</p>
    );
};

const UserManagement = () => {
    const [pendingUsers, setPendingUsers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const options = { credentials: 'include' };
            const [p, a] = await Promise.all([
                fetch(`${API}/api/admin/pending-users`, options).then(r => r.json()),
                fetch(`${API}/api/admin/users`, options).then(r => r.json()),
            ]);
            if (Array.isArray(p)) setPendingUsers(p);
            if (Array.isArray(a)) setAllUsers(a);
        } catch (err) {
            console.error('Failed to fetch users:', err);
            setMsg('❌ Error loading users.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const approveUser = async (userId, username) => {
        setMsg('');
        try {
            const res = await fetch(`${API}/api/admin/approve-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ user_id: userId }),
            });
            if (res.ok) {
                setMsg(`✅ Approved user: ${username}`);
                fetchData();
            } else {
                const data = await res.json();
                throw new Error(data.error || 'Failed to approve');
            }
        } catch (err) {
            setMsg(`❌ ${err.message}`);
        }
    };

    return (
        <div className="um-root">
            <div className="um-header">
                <h2>User Management</h2>
                <p>Manage pending approvals and view all registered users.</p>
            </div>

            <div className="um-content">
                {/* ── Pending Approvals ── */}
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
                                    {pendingUsers.map(u => (
                                        <tr key={u.id}>
                                            <td>{u.username}</td>
                                            <td>{u.role.toUpperCase()}</td>
                                            <td>
                                                <button className="approve-btn" onClick={() => approveUser(u.id, u.username)}>Approve</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── User Dashboard (All Users) ── */}
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
                                </tr>
                            </thead>
                            <tbody>
                                {allUsers.map(u => (
                                    <tr key={u.id}>
                                        <td>{u.id}</td>
                                        <td>{u.username}</td>
                                        <td className={`role-pill ${u.role}`}>{u.role.toUpperCase()}</td>
                                        <td>
                                            <span className={`status-indicator ${u.is_approved ? 'approved' : 'pending'}`}>
                                                {u.is_approved ? 'Active' : 'Pending'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
