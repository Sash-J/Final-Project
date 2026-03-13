import React, { useState, useEffect } from 'react';
import './AdminPanel.css';

const API = 'http://localhost:5000';

// ── Reusable status message ───────────────────────────────────────────────────
const StatusMsg = ({ msg }) => {
    if (!msg) return null;
    const isError = msg.startsWith('Error') || msg.startsWith('❌');
    return (
        <p className={`status-msg ${isError ? 'error' : 'success'}`}>{msg}</p>
    );
};

// ── 1. Add Project ────────────────────────────────────────────────────────────
const AddProject = ({ onAdded }) => {
    const [name, setName] = useState('');
    const [msg, setMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMsg('');
        try {
            const res = await fetch(`${API}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ project_name: name }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            setMsg(`✅ Project "${name}" added (ID: ${data.id})`);
            setName('');
            onAdded && onAdded();
        } catch (err) {
            setMsg(`❌ ${err.message}`);
        }
    };

    return (
        <form className="db-form" onSubmit={handleSubmit}>
            <h3>Add Project</h3>
            <label>Project Name</label>
            <input
                type="text"
                placeholder="e.g. Brand Relaunch 2025"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
            />
            <button type="submit">Add Project</button>
            <StatusMsg msg={msg} />
        </form>
    );
};

// ── 2. Add Department ─────────────────────────────────────────────────────────
const AddDepartment = ({ onAdded }) => {
    const [name, setName] = useState('');
    const [msg, setMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMsg('');
        try {
            const res = await fetch(`${API}/departments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ department_name: name }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            setMsg(`✅ Department "${name}" added (ID: ${data.id})`);
            setName('');
            onAdded && onAdded();
        } catch (err) {
            setMsg(`❌ ${err.message}`);
        }
    };

    return (
        <form className="db-form" onSubmit={handleSubmit}>
            <h3>Add Department</h3>
            <label>Department Name</label>
            <input
                type="text"
                placeholder="e.g. Camera"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
            />
            <button type="submit">Add Department</button>
            <StatusMsg msg={msg} />
        </form>
    );
};

// ── 3. Add Category ───────────────────────────────────────────────────────────
const AddCategory = ({ departments, onAdded }) => {
    const [name, setName] = useState('');
    const [deptId, setDeptId] = useState('');
    const [msg, setMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMsg('');
        try {
            const res = await fetch(`${API}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ category_name: name, department_id: parseInt(deptId) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            setMsg(`✅ Category "${name}" added (ID: ${data.id})`);
            setName('');
            setDeptId('');
            onAdded && onAdded();
        } catch (err) {
            setMsg(`❌ ${err.message}`);
        }
    };

    return (
        <form className="db-form" onSubmit={handleSubmit}>
            <h3>Add Category</h3>
            <label>Category Name</label>
            <input
                type="text"
                placeholder="e.g. Lighting"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
            />
            <label>Department</label>
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)} required>
                <option value="">— Select Department —</option>
                {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.department_name}</option>
                ))}
            </select>
            <button type="submit">Add Category</button>
            <StatusMsg msg={msg} />
        </form>
    );
};

// ── 4. Add Budget Item ────────────────────────────────────────────────────────
const AddBudgetItem = ({ categories, onAdded }) => {
    const [name, setName] = useState('');
    const [catId, setCatId] = useState('');
    const [msg, setMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMsg('');
        try {
            const res = await fetch(`${API}/budget-items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ item_name: name, category_id: parseInt(catId) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            setMsg(`✅ Budget item "${name}" added (ID: ${data.id})`);
            setName('');
            setCatId('');
            onAdded && onAdded();
        } catch (err) {
            setMsg(`❌ ${err.message}`);
        }
    };

    return (
        <form className="db-form" onSubmit={handleSubmit}>
            <h3>Add Budget Item</h3>
            <label>Item Name</label>
            <input
                type="text"
                placeholder="e.g. LED Panel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
            />
            <label>Category</label>
            <select value={catId} onChange={(e) => setCatId(e.target.value)} required>
                <option value="">— Select Category —</option>
                {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.category_name} ({c.department_name})</option>
                ))}
            </select>
            <button type="submit">Add Budget Item</button>
            <StatusMsg msg={msg} />
        </form>
    );
};

// ── 5. Super Entry Table ──────────────────────────────────────────────────────
const SuperEntryTable = ({ onSaved }) => {
    const [rows, setRows] = useState([
        { id: Date.now(), project_name: '', department_name: '', category_name: '', item_name: '', quantity: '', rate: '' }
    ]);
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState('');

    const addRow = () => {
        setRows([...rows, { id: Date.now(), project_name: '', department_name: '', category_name: '', item_name: '', quantity: '', rate: '' }]);
    };

    const removeRow = (id) => {
        if (rows.length > 1) setRows(rows.filter(r => r.id !== id));
    };

    const handleUpdate = (id, field, val) => {
        setRows(rows.map(r => r.id === id ? { ...r, [field]: val } : r));
    };

    const handleSubmit = async () => {
        const filtered = rows.filter(r => r.project_name.trim() && r.item_name.trim());
        if (filtered.length === 0) {
            setMsg('❌ Please fill at least one Project and Item.');
            return;
        }

        setSubmitting(true);
        setMsg('');
        try {
            const res = await fetch(`${API}/admin/super-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ rows: filtered }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            setMsg(`✅ ${data.message}`);
            setRows([{ id: Date.now(), project_name: '', department_name: '', category_name: '', item_name: '', quantity: '', rate: '' }]);
            onSaved && onSaved();
        } catch (err) {
            setMsg(`❌ ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="super-entry-container">
            <div className="super-entry-header">
                <h3>Super Entry Table</h3>
                <p>Add all entities simultaneously. New names will create new records automatically.</p>
            </div>
            <div className="super-table-wrapper">
                <table className="super-table">
                    <thead>
                        <tr>
                            <th>Project</th>
                            <th>Department</th>
                            <th>Category</th>
                            <th>Budget Item</th>
                            <th>Qty</th>
                            <th>Rate</th>
                            <th style={{ width: '40px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <tr key={row.id}>
                                <td><input placeholder="Project" value={row.project_name} onChange={e => handleUpdate(row.id, 'project_name', e.target.value)} /></td>
                                <td><input placeholder="Dept" value={row.department_name} onChange={e => handleUpdate(row.id, 'department_name', e.target.value)} /></td>
                                <td><input placeholder="Category" value={row.category_name} onChange={e => handleUpdate(row.id, 'category_name', e.target.value)} /></td>
                                <td><input placeholder="Item" value={row.item_name} onChange={e => handleUpdate(row.id, 'item_name', e.target.value)} /></td>
                                <td><input type="number" placeholder="0" value={row.quantity} onChange={e => handleUpdate(row.id, 'quantity', e.target.value)} /></td>
                                <td><input type="number" placeholder="0.00" value={row.rate} onChange={e => handleUpdate(row.id, 'rate', e.target.value)} /></td>
                                <td><button className="del-btn" onClick={() => removeRow(row.id)} title="Remove Row">×</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="super-entry-actions">
                <button className="add-row-btn" onClick={addRow}>+ Add Row</button>
                <button className="submit-all-btn" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Processing...' : 'Submit All Simultaneous Entry'}
                </button>
            </div>
            <StatusMsg msg={msg} />
        </div>
    );
};

// ── 6. User Approvals ────────────────────────────────────────────────────────
const UserApprovals = () => {
    const [pendingUsers, setPendingUsers] = useState([]);
    const [msg, setMsg] = useState('');

    const fetchPending = async () => {
        try {
            const res = await fetch(`${API}/api/admin/pending-users`, { credentials: 'include' });
            const data = await res.json();
            if (res.ok) setPendingUsers(data);
        } catch (err) {
            console.error('Failed to fetch pending users:', err);
        }
    };

    useEffect(() => { fetchPending(); }, []);

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
                fetchPending();
            } else {
                const data = await res.json();
                throw new Error(data.error || 'Failed to approve');
            }
        } catch (err) {
            setMsg(`❌ ${err.message}`);
        }
    };

    return (
        <div className="db-form">
            <h3>Pending User Approvals</h3>
            <StatusMsg msg={msg} />
            {pendingUsers.length === 0 ? (
                <p>No pending approvals.</p>
            ) : (
                <table className="approval-table">
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
                                {<td>{u.username}</td>}
                                <td>{u.role}</td>
                                <td>
                                    <button onClick={() => approveUser(u.id, u.username)}>Approve</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

// ── Main AdminPanel ───────────────────────────────────────────────────────────
const AdminPanel = () => {
    const [projects, setProjects] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [categories, setCategories] = useState([]);
    const [budgetItems, setBudgetItems] = useState([]);

    const fetchAll = async () => {
        try {
            const options = { credentials: 'include' };
            const [p, d, c, b] = await Promise.all([
                fetch(`${API}/projects`, options).then(r => r.json()),
                fetch(`${API}/departments`, options).then(r => r.json()),
                fetch(`${API}/categories`, options).then(r => r.json()),
                fetch(`${API}/budget-items`, options).then(r => r.json()),
            ]);
            setProjects(p);
            setDepartments(d);
            setCategories(c);
            setBudgetItems(b);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    return (
        <section id="admin-dashboard">
            <div className="admin-header">
                <h2>Admin Dashboard</h2>
                <p>Manage projects, hierarchies, and approvals in one consolidated view</p>
            </div>

            <div className="dashboard-grid">
                <div className="grid-window">
                    <AddProject onAdded={fetchAll} />
                </div>
                <div className="grid-window">
                    <AddDepartment onAdded={fetchAll} />
                </div>
                <div className="grid-window">
                    <AddCategory departments={departments} onAdded={fetchAll} />
                </div>
                <div className="grid-window">
                    <AddBudgetItem categories={categories} onAdded={fetchAll} />
                </div>
                <div className="grid-window full-width">
                    <SuperEntryTable onSaved={fetchAll} />
                </div>
                <div className="grid-window full-width">
                    <UserApprovals />
                </div>
            </div>
        </section>
    );
};

export default AdminPanel;
