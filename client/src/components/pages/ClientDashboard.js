import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../contexts/AuthContext";
import "./ClientDashboard.css";
import "./BudgetEntryForm.css"; // Reuse the admin sheet styles
import SuiTimeline from "./SuiTimeline";
import ModalPortal from "../common/ModalPortal";
import html2pdf from "html2pdf.js";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const TimelinePreview = ({ startDate, endDate, projectStatus }) => {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  const totalDuration = end.getTime() - start.getTime();
  const elapsed = today.getTime() - start.getTime();
  const progress =
    totalDuration > 0
      ? Math.max(0, Math.min((elapsed / totalDuration) * 100, 100))
      : 100;

  const formatDt = (d) =>
    d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="cd-timeline-preview">
      <div className="cd-timeline-labels">
        <span>{formatDt(start)}</span>
        <span className="cd-timeline-status">
          {projectStatus === "completed"
            ? "Completed"
            : progress === 0
              ? "Upcoming"
              : progress === 100
                ? "In Progress (Late)"
                : "In Progress"}
        </span>
        <span>{formatDt(end)}</span>
      </div>
      <div className="cd-progress-container cd-timeline-track">
        <div
          className="cd-progress-bar cd-timeline-fill"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

const ClientDashboard = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      const res = await axios.get(`${API}/api/client/dashboard`, {
        withCredentials: true,
      });
      setProjects(res.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data.");
      setLoading(false);
    }
  };

  const toggleProjectStatus = async (project) => {
    const newStatus =
      project.status === "completed" ? "in_progress" : "completed";
    try {
      await axios.put(
        `${API}/api/projects/${project.id}/status`,
        { status: newStatus },
        { withCredentials: true },
      );
      // Optimistically update UI
      setProjects(
        projects.map((p) =>
          p.id === project.id ? { ...p, status: newStatus } : p,
        ),
      );
    } catch (err) {
      alert("Failed to update project status.");
    }
  };

  const openBudgetModal = async (project) => {
    setSelectedProject(project);
    setBudgetLoading(true);
    try {
      // 1. Fetch all versions for this project
      const vRes = await axios.get(
        `${API}/api/projects/${project.id}/budget-versions`,
        { withCredentials: true },
      );
      const vData = Array.isArray(vRes.data) ? vRes.data : [];
      setVersions(vData);

      // 2. Default to the latest version
      let versionToFetch = null;
      if (vData.length > 0) {
        const latest = vData[vData.length - 1];
        versionToFetch = latest.id;
        setCurrentVersionId(latest.id);
      }

      // 3. Fetch budget data for that version
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
        ? `${API}/api/budget-values/project/${projectId}?version_id=${versionId}`
        : `${API}/api/budget-values/project/${projectId}`;

      const [hierRes, valRes] = await Promise.all([
        axios.get(`${API}/api/hierarchy`, { withCredentials: true }),
        axios.get(url, { withCredentials: true }),
      ]);

      const hierarchy = hierRes.data;
      const values = valRes.data;

      const filledPhases = [];
      let grandTotal = 0;

      if (Array.isArray(hierarchy)) {
        hierarchy.forEach((phase) => {
          const newPhase = { ...phase, departments: [] };
          let phaseTotal = 0;

          if (Array.isArray(phase.departments)) {
            phase.departments.forEach((dept) => {
              const newDept = { ...dept, categories: [] };
              let deptTotal = 0;

              if (Array.isArray(dept.categories)) {
                dept.categories.forEach((cat) => {
                  const newCat = { ...cat, items: [] };
                  let catTotal = 0;

                  if (Array.isArray(cat.items)) {
                    cat.items.forEach((item) => {
                      const val = values[item.id];
                      if (val) {
                        const q = parseFloat(val.quantity) || 0;
                        const r = parseFloat(val.rate) || 0;
                        const a1 = parseFloat(val.additional1) || 0;
                        const t = parseFloat(val.total) || 0;

                        if (q > 0 || r > 0 || t > 0 || a1 > 0) {
                          newCat.items.push({
                            ...item,
                            val: {
                              qty: q,
                              rate: r,
                              rate_type: val.rate_type || "day",
                              add1: a1,
                              total: t,
                              c1: val.comment1,
                            },
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
                newPhase.departments.push(newDept);
                phaseTotal += deptTotal;
              }
            });
          }

          if (newPhase.departments.length > 0) {
            newPhase.phaseTotal = phaseTotal;
            filledPhases.push(newPhase);
            grandTotal += phaseTotal;
          }
        });
      }
      setBudgetData({ phases: filledPhases, grandTotal });
    } catch (err) {
      console.error("Error fetching budget data:", err);
      setBudgetData({ phases: [], grandTotal: 0 });
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
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById("client-budget-pdf-content");
    if (!element) return;
    const dateStr = new Date().toISOString().split("T")[0];
    const pName = selectedProject?.project_name
      ? selectedProject.project_name.replace(/\s+/g, "_")
      : "Project";

    const vNumber =
      currentVersionId && versions.find((v) => v.id == currentVersionId)
        ? versions.find((v) => v.id == currentVersionId).version_number
        : "Draft";

    const filename = `${pName}_Version_${vNumber}_${dateStr}.pdf`;

    const opt = {
      margin: 10,
      filename: filename,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true, 
        backgroundColor: "#0d0e15",
        windowWidth: 1200 // Specify the width of the canvas to include all columns
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };
    html2pdf().set(opt).from(element).save();
  };

  if (loading) return <div className="cd-loading">Loading Dashboard...</div>;
  if (error) return <div className="cd-error">{error}</div>;

  return (
    <div className="cd-root">
      <div className="cd-header">
        <h2>Welcome, {user.username}</h2>
        <p>Your Production Dashboard</p>
      </div>

      {projects.length === 0 ? (
        <div className="cd-empty">No projects assigned to you yet.</div>
      ) : (
        <div className="cd-projects-grid">
          {projects.map((project) => {
            const totalBudget = parseFloat(project.total_budget);
            const totalPaid = parseFloat(project.total_paid);
            const balance = totalBudget - totalPaid;
            const progress =
              totalBudget > 0
                ? Math.min((totalPaid / totalBudget) * 100, 100)
                : 0;

            const isCompleted = project.status === "completed";

            return (
              <div
                key={project.id}
                className={`cd-project-card ${isCompleted ? "cd-project-completed" : ""}`}
              >
                <div className="cd-card-header">
                  <div className="cd-card-header-inner">
                    <h3>{project.project_name}</h3>
                    <div className="cd-status-toggle">
                      <span
                        className={`cd-status-label ${isCompleted ? "completed" : ""}`}
                      >
                        {isCompleted ? "Completed" : "In Progress"}
                      </span>
                      <label
                        className="cd-switch"
                        onClick={(e) => {
                          e.preventDefault();
                          toggleProjectStatus(project);
                        }}
                      >
                        <input type="checkbox" checked={isCompleted} readOnly />
                        <span
                          className={`cd-slider circular ${isCompleted ? "completed" : ""}`}
                        >
                          <span
                            className={`cd-knob ${isCompleted ? "completed" : ""}`}
                          ></span>
                        </span>
                      </label>
                    </div>
                  </div>
                  {(!project.start_date || !project.end_date) && (
                    <span className="cd-date">
                      Started:{" "}
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {!isCompleted && (
                  <div className="cd-mini-timeline-preview">
                    <div
                      className="cd-mini-timeline-preview-inner"
                      onClick={() => setSelectedTimelineProject(project)}
                      style={{ cursor: "pointer" }}
                    >
                      <SuiTimeline
                        projectId={project.id}
                        userRole={user.role}
                        preview={true}
                        updateTrigger={milestoneUpdateTrigger}
                        onClick={() => setSelectedTimelineProject(project)}
                      />
                    </div>
                  </div>
                )}

                {isCompleted ? (
                  <div className="cd-project-completed-msg">
                    Project Completed
                  </div>
                ) : (
                  <TimelinePreview
                    startDate={project.start_date}
                    endDate={project.end_date}
                    projectStatus={project.status}
                  />
                )}

                <div className="cd-financials">
                  <div className="cd-fin-item">
                    <span>Total Budget</span>
                    <strong>{formatCurrency(totalBudget)}</strong>
                  </div>
                  <div className="cd-fin-item highlight-paid">
                    <span>Amount Paid</span>
                    <strong>{formatCurrency(totalPaid)}</strong>
                  </div>
                  <div className="cd-fin-item highlight-balance">
                    <span>Balance Due</span>
                    <strong>{formatCurrency(balance)}</strong>
                  </div>
                </div>

                <div className="cd-progress-section">
                  <div className="cd-progress-info">
                    <span>Financial Clearance</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="cd-progress-container">
                    <div
                      className="cd-progress-bar"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>

                {!isCompleted &&
                  project.payments &&
                  project.payments.length > 0 && (
                    <div className="cd-payments-section">
                      <h4>Recent Payments</h4>
                      <table className="cd-payments-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {project.payments.slice(0, 5).map((payment) => (
                            <tr key={payment.id}>
                              <td>
                                {new Date(
                                  payment.payment_date,
                                ).toLocaleDateString()}
                              </td>
                              <td className="payment-amount">
                                {formatCurrency(payment.amount)}
                              </td>
                              <td className="payment-notes">
                                {payment.notes || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                <div className="cd-card-actions">
                  <button
                    className="cd-view-budget-btn"
                    onClick={() => openBudgetModal(project)}
                    style={{ width: "100%" }}
                  >
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
        <ModalPortal>
          <div className="cd-modal-overlay" onClick={closeBudgetModal}>
            <div
              className="cd-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="cd-modal-close" onClick={closeBudgetModal}>
                &times;
              </button>

              <div className="cd-modal-header-row">
                <h3>
                  Budget Sheet - {selectedProject.project_name}
                  {currentVersionId &&
                    versions.find((v) => v.id == currentVersionId) &&
                    ` (Version ${versions.find((v) => v.id == currentVersionId).version_number})`}
                </h3>

                <div className="cd-modal-header-actions">
                  {budgetData && budgetData.phases.length > 0 && (
                    <button className="cd-view-budget-btn" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={handleDownloadPDF}>
                      Download PDF
                    </button>
                  )}

                  {versions.length > 0 && (
                    <div className="cd-version-selector">
                      <label>Version:</label>
                      <select
                        value={currentVersionId || ""}
                        onChange={(e) => handleVersionChange(e.target.value)}
                      >
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            Version {v.version_number}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {budgetLoading ? (
                <div className="cd-loading cd-modal-loading">
                  Loading budget...
                </div>
              ) : budgetData && budgetData.phases.length > 0 ? (
                <div className="client-table-container" id="client-budget-pdf-content" style={{ backgroundColor: "#0d0e15", padding: "15px", borderRadius: "12px" }}>
                  <div
                    className="bef-sheet"
                    style={{
                      margin: 0,
                      overflowY: "auto",
                      maxHeight: "none", // Avoid scrolling for PDF output
                      borderRadius: "12px",
                    }}
                  >
                    <table className="bef-table">
                      <thead>
                        <tr>
                          <th className="col-item-name">Item Name</th>
                          <th className="col-num">Qty</th>
                          <th
                            className="col-rate-type"
                            style={{ width: "80px", textAlign: "center" }}
                          >
                            Type
                          </th>
                          <th className="col-num">Rate</th>
                          <th className="col-num">Total</th>
                        </tr>
                      </thead>
                                            {budgetData.phases.map((phase) => (
                                                <React.Fragment key={phase.phase_id}>
                                                    <tbody className="bef-phase-group-header">
                                                        <tr className="phase-header-row" style={{ background: 'rgba(99, 179, 237, 0.1)' }}>
                                                            <td colSpan="4" style={{ padding: '12px 20px', fontWeight: '700', color: '#63b3ed', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' }}>
                                                                {phase.phase_name}
                                                            </td>
                                                            <td className="col-num phase-subtotal" style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '700', color: '#63b3ed' }}>
                                                                {formatCurrency(phase.phaseTotal)}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                    {phase.departments.map((dept, deptIdx) => (
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
                                                </React.Fragment>
                                            ))}
                    </table>
                  </div>
                  <div
                    className="bef-footer"
                    style={{
                      marginTop: "20px",
                      padding: "15px 20px",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "12px",
                      border: "1px solid rgba(255,255,255,0.05)",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div className="bef-grand-total">
                      Grand Total:{" "}
                      <strong>{formatCurrency(budgetData.grandTotal)}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cd-empty cd-modal-empty">
                  Budget not yet assigned to this project.
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}

      {/* TIMELINE MODAL WITH ADD PERSONAL MILESTONE */}
      {selectedTimelineProject && (
        <ModalPortal>
          <div className="sui-modal-overlay">
            <div className="milestone-modal-content-wide">
              <button
                className="cd-modal-close"
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "15px",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "#fff",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  zIndex: 99999,
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "0.2s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "rgba(255, 60, 60, 0.8)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)")
                }
                onClick={() => setSelectedTimelineProject(null)}
              >
                ✕
              </button>

              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <h3
                  style={{ marginBottom: "10px", color: "#fff", flexShrink: 0 }}
                >
                  Project Timeline: {selectedTimelineProject.project_name}
                </h3>
                <div
                  style={{
                    background: "rgba(0,0,0,0.2)",
                    padding: "0",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.05)",
                    flex: 1,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <SuiTimeline
                    projectId={selectedTimelineProject.id}
                    key={selectedTimelineProject._t || "1"}
                    userRole={user.role}
                    updateTrigger={milestoneUpdateTrigger}
                    onMilestonesChange={() =>
                      setMilestoneUpdateTrigger((prev) => prev + 1)
                    }
                  />
                </div>
              </div>
              {/* Client role is restricted to viewing and noting milestones only. */}
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default ClientDashboard;
