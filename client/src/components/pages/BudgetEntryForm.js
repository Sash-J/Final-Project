import React, { useState, useEffect, useCallback } from 'react';
import './BudgetEntryForm.css';

const API = 'http://localhost:5000';

/* ─────────────────────────────────────────────────────────────────────────────
   BudgetEntryForm
   Spreadsheet-style bulk entry for a selected project.
   All rows are held in local state; a single "Submit All" sends everything.
───────────────────────────────────────────────────────────────────────────── */
const BudgetEntryForm = ({ embedded = false }) => {
    const [projects,   setProjects]   = useState([]);
    const [hierarchy,  setHierarchy]  = useState([]);   // departments → categories → items
    const [projectId,  setProjectId]  = useState('');
    const [values,     setValues]     = useState({});  // { budget_item_id: { qty, rate, add1, add2, c1, c2 } }
    const [activeComment, setActiveComment] = useState(null); // { itemId, field }
    const [loading,    setLoading]    = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [status,     setStatus]     = useState(null); // { type: 'success'|'error', text }

    // ── Load projects & hierarchy once ────────────────────────────────────────
    useEffect(() => {
        const fetchOptions = { credentials: 'include' };
        Promise.all([
            fetch(`${API}/projects`, fetchOptions).then(r => r.json()),
            fetch(`${API}/hierarchy`, fetchOptions).then(r => r.json()),
        ]).then(([p, h]) => {
            if (Array.isArray(p)) setProjects(p);
            if (Array.isArray(h)) {
                setHierarchy(h);
            }
        }).catch(err => {
            console.error('Error loading initial data:', err);
            setStatus({ type: 'error', text: 'Error loading data. Are you logged in?' });
        });
    }, []);

    // ── Load existing values when project changes ─────────────────────────────
    const loadProject = useCallback(async (pid) => {
        setProjectId(pid);
        setStatus(null);
        if (!pid) { setValues({}); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API}/budget-values/project/${pid}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Unauthorized or Session Expired');
            const saved = await res.json();
            // saved is { budget_item_id: { quantity, rate, additional1, additional2, comment1, comment2, total } }
            const v = {};
            Object.entries(saved).forEach(([itemId, row]) => {
                v[itemId] = {
                    qty:  String(parseFloat(row.quantity)    || ''),
                    rate: String(parseFloat(row.rate)        || ''),
                    add1: String(parseFloat(row.additional1) || ''),
                    c1:   row.comment1 || '',
                };
            });
            setValues(v);
        } catch (err) {
            console.error('Error loading project values:', err);
            setStatus({ type: 'error', text: 'Failed to load project values. Try logging in again.' });
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Row value helpers ─────────────────────────────────────────────────────
    const getVal = (itemId, field) => (values[itemId] || {})[field] || '';

    const handleChange = (itemId, field, raw) => {
        setValues(prev => ({
            ...prev,
            [itemId]: { ...(prev[itemId] || {}), [field]: raw },
        }));
    };

    const total = (itemId) => {
        return totalRaw(itemId).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const totalRaw = (itemId) => {
        const q = parseFloat(getVal(itemId, 'qty'))  || 0;
        const r = parseFloat(getVal(itemId, 'rate')) || 0;
        const a1 = parseFloat(getVal(itemId, 'add1')) || 0;
        return +((q * r) + a1).toFixed(2);
    };

    // ── Grand total ───────────────────────────────────────────────────────────
    const grandTotal = Object.keys(values).reduce((sum, id) => sum + totalRaw(id), 0);

    // ── Submit all filled rows ────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!projectId) { setStatus({ type: 'error', text: 'Please select a project first.' }); return; }
        const payload = [];
        Object.entries(values).forEach(([itemId, v]) => {
            const q = parseFloat(v.qty)  || 0;
            const r = parseFloat(v.rate) || 0;
            const a1 = parseFloat(v.add1) || 0;
            const c1 = v.c1 || '';

            if (q > 0 || r > 0 || a1 > 0 || c1) {
                payload.push({
                    budget_item_id: parseInt(itemId),
                    quantity: q,
                    rate: r,
                    additional1: a1,
                    comment1: c1,
                    total: +((q * r) + a1).toFixed(2),
                });
            }
        });
        if (!payload.length) { setStatus({ type: 'error', text: 'No values entered. Fill in at least one row.' }); return; }
        setSubmitting(true);
        setStatus(null);
        try {
            const res = await fetch(`${API}/budget-values/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ project_id: parseInt(projectId), values: payload }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            setStatus({ type: 'success', text: `✅ ${data.message} for "${projects.find(p => p.id === parseInt(projectId))?.project_name}"` });
        } catch (err) {
            setStatus({ type: 'error', text: `❌ ${err.message}` });
        } finally {
            setSubmitting(false);
        }
    };

    // ── Clear all inputs ──────────────────────────────────────────────────────
    const handleClear = () => { setValues({}); setStatus(null); };

    // ── Count filled rows ──────────────────────────────────────────────────────
    const filledCount = Object.values(values).filter(v =>
        (parseFloat(v.qty) || 0) > 0 || (parseFloat(v.rate) || 0) > 0 || 
        (parseFloat(v.add1) || 0) > 0
    ).length;

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="bef-root" onClick={() => setActiveComment(null)}>
            {!embedded && (
                <div className="bef-header">
                    <h2>Budget Entry</h2>
                    <p>Select a project, fill in quantities, rates, and additional costs, then submit.</p>
                </div>
            )}

            {/* Project selector */}
            <div className="bef-project-bar">
                <label>Project</label>
                <select value={projectId} onChange={e => loadProject(e.target.value)}>
                    <option value="">— Select Project —</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.project_name}</option>
                    ))}
                </select>
                {filledCount > 0 && (
                    <span className="bef-pill">{filledCount} row{filledCount !== 1 ? 's' : ''} filled</span>
                )}
            </div>

            {loading && <div className="bef-loading">Loading saved values…</div>}

            {/* Spreadsheet */}
            {!loading && hierarchy.length > 0 && (
                <div className="bef-sheet">
                    <table className="bef-table">
                        <thead>
                            <tr>
                                <th className="col-item-name">Item Name</th>
                                <th className="col-num">Qty</th>
                                <th className="col-num">Rate</th>
                                <th className="col-num">Add. 1</th>
                                <th className="col-num">Total (Rs.)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hierarchy.map(dept => (
                                <React.Fragment key={dept.id}>
                                    <tr className="bef-dept-row">
                                        <td colSpan="5">
                                            <div className="dept-header-content">
                                                <span className="dept-id">{String(dept.id).padStart(2, '0')}</span>
                                                <span className="dept-name">{dept.department_name}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    {dept.categories.map(cat => (
                                        <React.Fragment key={cat.id}>
                                            <tr className="bef-cat-row">
                                                <td colSpan="4">
                                                    <span className="cat-id">{cat.id.toString().includes('.') ? cat.id : `${dept.id}.${cat.id}`}</span>
                                                    <span className="cat-name">{cat.category_name}</span>
                                                </td>
                                                <td className="col-num cat-subtotal">
                                                </td>
                                            </tr>
                                            {cat.items.map((item, idx) => {
                                                const v = values[item.id] || {};
                                                const isFilled = (parseFloat(v.qty) || 0) > 0 || (parseFloat(v.rate) || 0) > 0 || (parseFloat(v.add1) || 0) > 0;
                                                
                                                return (
                                                    <tr key={item.id} className={`bef-row ${idx % 2 === 0 ? 'even' : 'odd'} ${isFilled ? 'filled' : ''}`}>
                                                        <td className="col-item-name">{item.item_name}</td>
                                                        <td className="col-num">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="any"
                                                                placeholder="0"
                                                                value={getVal(item.id, 'qty')}
                                                                onChange={e => handleChange(item.id, 'qty', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="col-num">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="any"
                                                                placeholder="0.00"
                                                                value={getVal(item.id, 'rate')}
                                                                onChange={e => handleChange(item.id, 'rate', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="col-num bef-relative">
                                                            <div className="add-input-group">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="any"
                                                                    placeholder="0.00"
                                                                    value={getVal(item.id, 'add1')}
                                                                    onChange={e => handleChange(item.id, 'add1', e.target.value)}
                                                                />
                                                                <button 
                                                                    className={`bef-comment-btn ${getVal(item.id, 'c1') ? 'has-comment' : ''}`}
                                                                    onClick={(e) => { e.stopPropagation(); setActiveComment({itemId: item.id, field: 'c1'}); }}
                                                                >
                                                                    💬
                                                                </button>
                                                                {activeComment?.itemId === item.id && activeComment?.field === 'c1' && (
                                                                    <div className="bef-comment-popover" onClick={e => e.stopPropagation()}>
                                                                        <textarea 
                                                                            placeholder="Comment for Add. 1..."
                                                                            value={getVal(item.id, 'c1')}
                                                                            onChange={e => handleChange(item.id, 'c1', e.target.value)}
                                                                            autoFocus
                                                                        />
                                                                        <button onClick={() => setActiveComment(null)}>Close</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className={`col-num total-cell ${isFilled ? 'has-value' : ''}`}>
                                                            {total(item.id)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Footer bar */}
            {!loading && hierarchy.length > 0 && (
                <div className="bef-footer">
                    <div className="bef-grand-total">
                        Grand Total:&nbsp;
                        <strong>Rs.{grandTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="bef-actions">
                        <button className="bef-btn-clear" onClick={handleClear} disabled={submitting}>
                            Clear All
                        </button>
                        <button className="bef-btn-submit" onClick={handleSubmit} disabled={submitting || !projectId}>
                            {submitting ? 'Saving…' : `Submit All${filledCount ? ` (${filledCount})` : ''}`}
                        </button>
                    </div>
                </div>
            )}

            {/* Status message */}
            {status && (
                <div className={`bef-status ${status.type}`}>{status.text}</div>
            )}
        </div>
    );
};

export default BudgetEntryForm;
