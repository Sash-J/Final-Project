import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import './CrewDashboard.css';
import './BudgetEntryForm.css'; // Reuse the admin sheet styles
import SuiTimeline from './SuiTimeline';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const TimelinePreview = ({ startDate, endDate }) => {
    if (!startDate || !endDate) return null;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

    const totalDuration = end.getTime() - start.getTime();
    const elapsed = today.getTime() - start.getTime();
    const progress = totalDuration > 0 ? Math.max(0, Math.min((elapsed / totalDuration) * 100, 100)) : 100;

    const formatDt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <div className="crew-timeline-preview">
            <div className="crew-timeline-labels">
                <span>{formatDt(start)}</span>
                <span className="crew-timeline-status">
                    {progress === 0 ? 'Upcoming' : progress === 100 ? 'Completed' : 'In Progress'}
                </span>
                <span>{formatDt(end)}</span>
            </div>
            <div className="crew-progress-container crew-timeline-track">
                <div 
                    className="crew-progress-bar crew-timeline-fill" 
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    );
};

const CrewDashboard = () => {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Modal state for Budget Sheet
    const [selectedProject, setSelectedProject] = useState(null);
    const [budgetData, setBudgetData] = useState(null);
    const [budgetLoading, setBudgetLoading] = useState(false);
    const [versions, setVersions] = useState([]);
    const [currentVersionId, setCurrentVersionId] = useState(null);
    
    // Timeline state
    const [selectedTimelineProject, setSelectedTimelineProject] = useState(null);
    const [milestoneUpdateTrigger, setMilestoneUpdateTrigger] = useState(0);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const res = await axios.get(`${API}/api/client/dashboard`, { withCredentials: true });
            setProjects(res.data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching dashboard data:", err);
            setError("Failed to load dashboard data.");
            setLoading(false);
        }
    };

    const openBudgetModal = async (project) => {
        setSelectedProject(project);
        setBudgetLoading(true);
        try {
            const vRes = await axios.get(`${API}/api/projects/${project.id}/budget-versions`, { withCredentials: true });
            const vData = Array.isArray(vRes.data) ? vRes.data : [];
            setVersions(vData);

            let versionToFetch = null;
            if (vData.length > 0) {
                const latest = vData[vData.length - 1];
                versionToFetch = latest.id;
                setCurrentVersionId(latest.id);
            }

            await fetchBudgetData(project.id, versionToFetch);
        } catch (err) {
            console.error("Error opening budget modal:", err);
        } finally {
            setBudgetLoading(false);
        }
    };

    const fetchBudgetData = async (projectId, versionId) => {
        try {
            const url = versionId 
                ? `${API}/budget-values/project/${projectId}?version_id=${versionId}`
                : `${API}/budget-values/project/${projectId}`;

            const [hierRes, valRes] = await Promise.all([
                axios.get(`${API}/hierarchy`, { withCredentials: true }),
                axios.get(url, { withCredentials: true })
            ]);
            
            const hierarchy = hierRes.data;
            const values = valRes.data;

            const filledHierarchy = [];
            let grandTotal = 0;
            
            if (Array.isArray(hierarchy)) {
                hierarchy.forEach(dept => {
                    const newDept = { ...dept, categories: [] };
                    let deptTotal = 0;

                    if (Array.isArray(dept.categories)) {
                        dept.categories.forEach(cat => {
                            const newCat = { ...cat, items: [] };
                            let catTotal = 0;

                            if (Array.isArray(cat.items)) {
                                cat.items.forEach(item => {
                                    const val = values[item.id];
                                    if (val) {
                                        const q = parseFloat(val.quantity) || 0;
                                        const r = parseFloat(val.rate) || 0;
                                        const a1 = parseFloat(val.additional1) || 0;
                                        const a2 = parseFloat(val.additional2) || 0;
                                        const t = parseFloat(val.total) || 0;
                                        
                                        if (q > 0 || r > 0 || t > 0 || a1 > 0 || a2 > 0) {
                                            newCat.items.push({
                                                ...item,
                                                val: {
                                                    qty: q,
                                                    rate: r,
                                                    rate_type: val.rate_type || 'day',
                                                    add1: a1,
                                                    add2: a2,
                                                    total: t,
                                                    c1: val.comment1,
                                                    c2: val.comment2,
                                                }
                                            });
                                            catTotal += t;
                                        }
                                    }
                                });
                            }

                            if (newCat.items.length > 0) {
                                newCat.catTotal = catTotal;
                                newDept.categories.push(newCat);
                                deptTotal += catTotal;
                            }
                        });
                    }

                    if (newDept.categories.length > 0) {
                        newDept.deptTotal = deptTotal;
                        filledHierarchy.push(newDept);
                        grandTotal += deptTotal;
                    }
                });
            }
            setBudgetData({ hierarchy: filledHierarchy, grandTotal });
        } catch (err) {
            console.error("Error fetching budget data:", err);
            setBudgetData({ hierarchy: [], grandTotal: 0 });
        }
    };

    const handleVersionChange = async (verId) => {
        setCurrentVersionId(verId);
        setBudgetLoading(true);
        await fetchBudgetData(selectedProject.id, verId);
        setBudgetLoading(false);
    };

    const closeBudgetModal = () => {
        setSelectedProject(null);
        setBudgetData(null);
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };

    if (loading) return <div className="crew-loading">Loading Dashboard...</div>;
    if (error) return <div className="crew-error">{error}</div>;

    return (
        <div className="crew-root">
            <div className="crew-header">
                <h2>Welcome, {user.username}</h2>
                <p>Production Crew Dashboard</p>
            </div>

            {projects.length === 0 ? (
                <div className="crew-empty">No projects assigned to you yet.</div>
            ) : (
                <div className="crew-projects-grid">
                    {projects.map(project => {
                        const totalBudget = parseFloat(project.total_budget);
                        const totalPaid = parseFloat(project.total_paid);
                        const balance = totalBudget - totalPaid;
                        const progress = totalBudget > 0 ? Math.min((totalPaid / totalBudget) * 100, 100) : 0;

                        const isCompleted = project.status === 'completed';

                        return (
                            <div key={project.id} className={`crew-project-card ${isCompleted ? 'crew-project-completed' : ''}`}>
                                <div className="crew-card-header">
                                    <div className="crew-card-header-inner">
                                        <h3>{project.project_name}</h3>
                                        <div className="crew-status-static">
                                            <span className={`crew-status-label ${isCompleted ? 'completed' : ''}`}>
                                                {isCompleted ? 'Completed' : 'In Progress'}
                                            </span>
                                        </div>
                                    </div>
                                    {(!project.start_date || !project.end_date) && (
                                        <span className="crew-date">Started: {new Date(project.created_at).toLocaleDateString()}</span>
                                    )}
                                </div>
                                
                                {!isCompleted && (
                                    <div className="crew-mini-timeline-preview">
                                        <div className="crew-mini-timeline-preview-inner">
                                            <SuiTimeline projectId={project.id} userRole="production_crew" preview={true} updateTrigger={milestoneUpdateTrigger} />
                                        </div>
                                    </div>
                                )}

                                {isCompleted ? (
                                    <div className="crew-project-completed-msg">
                                        Project Completed
                                    </div>
                                ) : (
                                    <TimelinePreview startDate={project.start_date} endDate={project.end_date} />
                                )}

                                <div className="crew-financials">
                                    <div className="crew-fin-item">
                                        <span>Total Budget</span>
                                        <strong>{formatCurrency(totalBudget)}</strong>
                                    </div>
                                    <div className="crew-fin-item highlight-paid">
                                        <span>Amount Paid</span>
                                        <strong>{formatCurrency(totalPaid)}</strong>
                                    </div>
                                    <div className="crew-fin-item highlight-balance">
                                        <span>Balance Due</span>
                                        <strong>{formatCurrency(balance)}</strong>
                                    </div>
                                </div>

                                <div className="crew-progress-section">
                                    <div className="crew-progress-info">
                                        <span>Financial Clearance</span>
                                        <span>{progress.toFixed(0)}%</span>
                                    </div>
                                    <div className="crew-progress-container">
                                        <div 
                                            className="crew-progress-bar" 
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {!isCompleted && project.payments && project.payments.length > 0 && (
                                    <div className="crew-payments-section">
                                        <h4>Recent Payments</h4>
                                        <table className="crew-payments-table">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Amount</th>
                                                    <th>Notes</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {project.payments.slice(0, 5).map(payment => (
                                                    <tr key={payment.id}>
                                                        <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                                                        <td className="payment-amount">{formatCurrency(payment.amount)}</td>
                                                        <td className="payment-notes">{payment.notes || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="crew-card-actions">
                                    <button className="crew-action-btn timeline-btn" onClick={() => setSelectedTimelineProject(project)} style={{ marginRight: '10px' }}>
                                        View Full Timeline
                                    </button>
                                    <button className="crew-action-btn budget-btn" onClick={() => openBudgetModal(project)}>
                                        View Budget Sheet
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Budget Sheet Modal */}
            {selectedProject && (
                <div className="crew-modal-overlay" onClick={closeBudgetModal}>
                    <div className="crew-modal-content" onClick={e => e.stopPropagation()}>
                        <button className="crew-modal-close" onClick={closeBudgetModal}>&times;</button>
                        
                        <div className="crew-modal-header-row">
                            <h3>Budget Sheet - {selectedProject.project_name} 
                                {currentVersionId && versions.find(v => v.id === currentVersionId) && 
                                    ` (Version ${versions.find(v => v.id === currentVersionId).version_number})`}
                            </h3>
                            
                            {versions.length > 0 && (
                                <div className="crew-version-selector">
                                    <label>Version:</label>
                                    <select 
                                        value={currentVersionId || ""} 
                                        onChange={(e) => handleVersionChange(e.target.value)}
                                    >
                                        {versions.map(v => (
                                            <option key={v.id} value={v.id}>Version {v.version_number}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        
                        {budgetLoading ? (
                            <div className="crew-loading crew-modal-loading">Loading budget...</div>
                        ) : budgetData && budgetData.hierarchy.length > 0 ? (
                            <div className="crew-table-container">
                                <div className="bef-sheet" style={{ margin: 0, overflowY: 'auto', maxHeight: '60vh', borderRadius: '12px' }}>
                                    <table className="bef-table">
                                        <thead>
                                            <tr>
                                                <th className="col-item-name">Item Name</th>
                                                <th className="col-num">Qty</th>
                                                <th className="col-rate-type" style={{ width: '80px', textAlign: 'center' }}>Type</th>
                                                <th className="col-num">Rate</th>
                                                <th className="col-num">Total</th>
                                            </tr>
                                        </thead>
                                        {budgetData.hierarchy.map((dept, deptIdx) => (
                                            <React.Fragment key={dept.id}>
                                                <tbody className="bef-dept-body">
                                                    <tr className="bef-dept-row">
                                                        <td colSpan="5">
                                                            <div className="dept-header-content">
                                                                <span className="dept-id">{String(deptIdx + 1).padStart(2, "0")}</span>
                                                                <span className="dept-name">{dept.department_name}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                                {dept.categories.map((cat, catIdx) => (
                                                    <tbody className="bef-cat-body" key={cat.id}>
                                                        <tr className="bef-cat-row">
                                                            <td colSpan="4">
                                                                <span className="cat-id">{deptIdx + 1}.{catIdx + 1}</span>
                                                                <span className="cat-name">{cat.category_name}</span>
                                                            </td>
                                                            <td className="col-num cat-subtotal">
                                                                {formatCurrency(cat.catTotal)}
                                                            </td>
                                                        </tr>
                                                        {cat.items.map((item) => (
                                                            <tr key={item.id} className="bef-row filled">
                                                                <td className="col-item-name">{item.item_name}</td>
                                                                <td className="col-num" style={{ textAlign: 'center' }}>{item.val.qty}</td>
                                                                <td className="col-rate-type" style={{ fontSize: '0.8rem', color: '#a0aec0', width: '80px', textAlign: 'center' }}>{item.val.rate_type}</td>
                                                                <td className="col-num" style={{ textAlign: 'center' }}>{formatCurrency(item.val.rate)}</td>
                                                                <td className="col-num total-cell has-value">{formatCurrency(item.val.total)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </table>
                                </div>
                                <div className="bef-footer" style={{ marginTop: '20px', padding: '15px 20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', justifyContent: 'flex-end' }}>
                                    <div className="bef-grand-total">
                                        Grand Total: <strong>{formatCurrency(budgetData.grandTotal)}</strong>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="crew-empty crew-modal-empty">No filled budget rows found for this project.</div>
                        )}
                    </div>
                </div>
            )}

            {/* TIMELINE MODAL (Read Only) */}
            {selectedTimelineProject && (
                <div className="sui-modal-overlay">
                    <div 
                        className="sui-modal-content milestone-modal-content" 
                        style={{ 
                            maxWidth: '1800px', 
                            width: '98%', 
                            height: '92vh', 
                            display: 'flex', 
                            flexDirection: 'column',
                            gap: '20px', 
                            position: 'relative',
                            padding: '40px',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}
                    >
                        <button 
                            className="crew-modal-close-btn" 
                            style={{ 
                                position: 'absolute', 
                                top: '10px', 
                                right: '15px', 
                                background: 'rgba(255, 255, 255, 0.1)', 
                                border: '1px solid rgba(255, 255, 255, 0.2)', 
                                color: '#fff', 
                                fontSize: '1.2rem', 
                                cursor: 'pointer', 
                                zIndex: 99999,
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: '0.2s'
                            }} 
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 60, 60, 0.8)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                            onClick={() => setSelectedTimelineProject(null)}
                        >
                            ✕
                        </button>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ marginBottom: '10px', color: '#fff', flexShrink: 0 }}>Project Timeline: {selectedTimelineProject.project_name}</h3>
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', flex: 1, overflow: 'hidden', position: 'relative' }}>
                                <SuiTimeline projectId={selectedTimelineProject.id} key={selectedTimelineProject._t || '1'} userRole="production_crew" updateTrigger={milestoneUpdateTrigger} onMilestonesChange={() => setMilestoneUpdateTrigger(prev => prev + 1)} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CrewDashboard;
