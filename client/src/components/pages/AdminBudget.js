import React, { useState, useEffect } from 'react';
import './AdminBudget.css';
import BudgetEntryForm from './BudgetEntryForm';

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
            setMsg(`✅ Project "${name}" added`);
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
            setMsg(`✅ Department "${name}" added`);
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
            setMsg(`✅ Category "${name}" added`);
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
            setMsg(`✅ Budget item "${name}" added`);
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


// ── Main AdminBudget Component ────────────────────────────────────────────────
const AdminBudget = () => {
    const [departments, setDepartments] = useState([]);
    const [categories, setCategories] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);

    const fetchMetadata = async () => {
        try {
            const options = { credentials: 'include' };
            const [d, c] = await Promise.all([
                fetch(`${API}/departments`, options).then(r => r.json()),
                fetch(`${API}/categories`, options).then(r => r.json()),
            ]);
            setDepartments(d);
            setCategories(c);
        } catch (err) {
            console.error('Failed to fetch metadata:', err);
        }
    };

    useEffect(() => {
        fetchMetadata();
    }, [refreshKey]);

    const handleDataAdded = () => {
        setRefreshKey(prev => prev + 1);
    };

    return (
        <section id="admin-budget">
            <div className="admin-header">
                <h2>Admin Budget Dashboard</h2>
                <p>Consolidated view for managing hierarchy and entering project budgets</p>
            </div>

            <div className="admin-budget-content">
                {/* ── Left Sidebar: Management Forms ── */}
                <div className="admin-sidebar">
                    <div className="grid-window">
                        <AddProject onAdded={handleDataAdded} />
                    </div>
                    <div className="grid-window">
                        <AddDepartment onAdded={handleDataAdded} />
                    </div>
                    <div className="grid-window">
                        <AddCategory departments={departments} onAdded={handleDataAdded} />
                    </div>
                    <div className="grid-window">
                        <AddBudgetItem categories={categories} onAdded={handleDataAdded} />
                    </div>
                </div>

                {/* ── Right Main: Budget Entry Form ── */}
                <div className="admin-main">
                    <div className="grid-window full-height">
                        <BudgetEntryForm embedded={true} key={refreshKey} />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AdminBudget;
