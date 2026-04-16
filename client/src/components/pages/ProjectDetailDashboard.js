import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "../common/PageHeader";
import SuiTimeline from "./SuiTimeline";
import BudgetSummary from "./BudgetSummary";
import ClientPayments from "./ClientPayments";
import ProjectForm from "./ProjectForm";
import ModalPortal from "../common/ModalPortal";
import { useModal } from "../../contexts/ModalContext";
import GlassDropdown from "../common/GlassDropdown";
import Icon from "../common/Icon";
import { API } from "../../config";
import "./ProjectDetailDashboard.css";
import { useProjects } from "../../contexts/ProjectContext";
import { formatCurrency } from "../../utils/currencyUtils";

// ── Skeleton Loader Component ──────────────────────────────────────────────
const ProjectDetailSkeleton = () => (
  <div className="project-detail-skeleton">
    <div className="skeleton-header-wrap">
      <div
        className="skeleton-base"
        style={{ width: "100px", height: "36px" }}
      ></div>
      <div className="skeleton-hero-box">
        <div className="skeleton-title-stack">
          <div
            className="skeleton-base"
            style={{ width: "120px", height: "14px", opacity: 0.5 }}
          ></div>
          <div
            className="skeleton-base"
            style={{ width: "400px", height: "40px" }}
          ></div>
          <div
            className="skeleton-base"
            style={{ width: "200px", height: "18px" }}
          ></div>
        </div>
        <div className="skeleton-metrics-row">
          <div className="skeleton-base skeleton-metrics-item"></div>
          <div className="skeleton-base skeleton-metrics-item"></div>
        </div>
      </div>
    </div>

    <div className="dashboard-skeleton-grid">
      <div className="skeleton-sidebar glass-card" style={{ padding: "20px" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-base skeleton-nav-item"></div>
        ))}
      </div>
      <div className="skeleton-main-content">
        <div
          className="skeleton-base glass-card"
          style={{ gridColumn: "span 2", gridRow: "span 2" }}
        ></div>
        <div className="skeleton-base glass-card"></div>
        <div className="skeleton-base glass-card"></div>
      </div>
    </div>
  </div>
);

const ProjectDetailDashboard = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const {
    invalidateCache,
    getProjectDetails,
    detailsCache,
    detailsLoading,
    getBudgetData,
    budgetCache,
    budgetLoading,
  } = useProjects(); // Global project list and detail context

  const [activeTab, setActiveTab] = useState("overview"); // overview, timeline, budget, team
  const [showEditModal, setShowEditModal] = useState(false);
  const { showConfirm } = useModal();

  // Local UI state for add milestone panel
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [milestoneDesc, setMilestoneDesc] = useState("");
  const [milestoneAssignee, setMilestoneAssignee] = useState(1);
  const [milestoneStatus, setMilestoneStatus] = useState("pending");
  const [milestoneSaving, setMilestoneSaving] = useState(false);
  const [timelineTrigger, setTimelineTrigger] = useState(0);
  const [showPayments, setShowPayments] = useState(false);

  // Reference to the project data in the global cache
  const project = detailsCache[projectId];

  // Budget version selector state
  const [budgetVersions, setBudgetVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");

  // Triggering the global metadata fetch on mount or project switch
  useEffect(() => {
    if (!projectId) return;
    getProjectDetails(projectId);
  }, [projectId, getProjectDetails]);

  // Fetch budget versions whenever the Finance tab is activated
  useEffect(() => {
    if (activeTab !== "budget" || !projectId) return;
    fetch(`${API}/api/projects/${projectId}/budget-versions`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setBudgetVersions(data);
          // Default to latest version if not already selected
          setSelectedVersionId(
            (prev) => prev || String(data[data.length - 1].id),
          );
        }
      })
      .catch(console.error);
  }, [activeTab, projectId]);

  // Triggering the global budget fetch when version changes
  useEffect(() => {
    if (activeTab === "budget" && selectedVersionId && projectId) {
      getBudgetData(projectId, selectedVersionId);
    }
  }, [activeTab, selectedVersionId, projectId, getBudgetData]);

  const handleDelete = async () => {
    const ok = await showConfirm(
      "Are you sure you want to delete this project? All associated data will be permanently removed.",
    );
    if (!ok) return;
    try {
      const res = await fetch(`${API}/api/projects/${projectId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        // Invalidate the projects list cache before returning to /admin
        invalidateCache();
        navigate("/admin");
      } else {
        const data = await res.json();
        alert(`❌ ${data.error || "Failed to delete"}`);
      }
    } catch (err) {
      alert(`❌ ${err.message}`);
    }
  };

  const handleProjectUpdated = () => {
    // Invalidate the cache of the full project list since the profile was updated
    invalidateCache();
    // Force a re-fetch of the specific project details to update the UI
    getProjectDetails(projectId, true);
    setShowEditModal(false);
  };

  const handleAddMilestone = async () => {
    if (!milestoneTitle.trim() || !milestoneDate) {
      alert("Title and Target Date are required.");
      return;
    }
    try {
      setMilestoneSaving(true);
      await fetch(`${API}/api/projects/${projectId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: milestoneTitle,
          description: milestoneDesc,
          target_date: milestoneDate,
          is_visiondivision: milestoneAssignee,
          status: milestoneStatus,
        }),
      });
      // Reset form and refresh timeline
      setMilestoneTitle("");
      setMilestoneDate("");
      setMilestoneDesc("");
      setMilestoneAssignee(1);
      setMilestoneStatus("pending");
      setShowAddMilestone(false);
      setTimelineTrigger((prev) => prev + 1);
    } catch (err) {
      alert("Failed to add milestone.");
    } finally {
      setMilestoneSaving(false);
    }
  };

  // Use the global detailsLoading state for the skeleton loader
  if (detailsLoading && !project) return <ProjectDetailSkeleton />;
  if (!project) return null;

  return (
    <div className="project-detail-root">
      <div className="project-detail-header-wrap">
        <div className="pd-top-row">
          <button className="back-to-admin" onClick={() => navigate("/admin")}>
            <Icon name="arrow_back" modifiers="md" />
            <span>Back</span>
          </button>
          <button className="project-hero-btn delete" onClick={handleDelete}>
            <Icon name="delete" modifiers="sm" />
            <span>Delete Project</span>
          </button>
        </div>

        <div className="project-main-info">
          <div
            className="project-hero-area"
            style={{ borderLeft: `8px solid ${project.color}` }}
          >
            <div className="project-title-stack">
              <span
                className="project-code-tag"
                style={{ color: project.color }}
              >
                {project.code_name}
              </span>
              <div className="project-name-group">
                <h1>{project.project_name}</h1>
                <button
                  className="project-hero-btn edit"
                  onClick={() => setShowEditModal(true)}
                >
                  <Icon name="edit" modifiers="md" />
                </button>
              </div>
              <p className="project-location-text">
                <Icon name="location_on" modifiers="xs" />
                {project.location || "Location not specified"}
              </p>
            </div>

            <div className="project-hero-stats">
              <div className="hero-stat-box">
                <label>Budget</label>
                <span>{formatCurrency(project.latest_budget_total)}</span>
              </div>
              <div className="hero-stat-box">
                <label>Balance</label>
                <span
                  className={
                    project.balance > 0 ? "warning-text" : "success-text"
                  }
                >
                  {formatCurrency(project.balance)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-content-grid">
        {/* Navigation Sidebar */}
        <div className="dashboard-nav-card glass-card">
          <nav className="dashboard-sidebar-nav">
            <button
              className={activeTab === "overview" ? "active" : ""}
              onClick={() => setActiveTab("overview")}
            >
              <Icon name="dashboard" modifiers="md" />
              <span>Overview</span>
            </button>
            <button
              className={activeTab === "timeline" ? "active" : ""}
              onClick={() => setActiveTab("timeline")}
            >
              <Icon name="timeline" modifiers="md" />
              <span>Timeline</span>
            </button>
            <button
              className={activeTab === "budget" ? "active" : ""}
              onClick={() => setActiveTab("budget")}
            >
              <Icon name="finance" modifiers="md" />
              <span>Finance</span>
            </button>
            <button
              className={activeTab === "team" ? "active" : ""}
              onClick={() => setActiveTab("team")}
            >
              <Icon name="groups" modifiers="md" />
              <span>Production Team</span>
            </button>
          </nav>
        </div>

        {/* Main Dynamic Area */}
        <>
          {activeTab === "overview" && (
            <div className="bento-layout fade-in">
              <div className="bento-item lg-rect glass-card no-padding overflow-hidden">
                <div className="project-cover-preview">
                  {project.project_image ? (
                    <img src={project.project_image} alt="Cover" />
                  ) : (
                    <div
                      className="empty-cover"
                      style={{
                        background: `linear-gradient(45deg, #111, ${project.color}33)`,
                      }}
                    >
                      <Icon
                        name="movie"
                        modifiers="lg"
                        style={{ color: project.color }}
                      />
                    </div>
                  )}
                  <div className="cover-overlay" />
                </div>
              </div>

              <div className="bento-item sm-square glass-card">
                <h3>Production Status</h3>
                <div className="status-indicator">
                  <div
                    className="status-dot pulse"
                    style={{
                      backgroundColor:
                        project.status === "completed" ? "#10b981" : "#3b82f6",
                    }}
                  />
                  <span>
                    {project.status === "completed"
                      ? "Completed"
                      : "In Production"}
                  </span>
                </div>
                <div className="date-range-summary">
                  <p>
                    Started: {new Date(project.start_date).toLocaleDateString()}
                  </p>
                  <p>
                    Deadline: {new Date(project.end_date).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="bento-item sm-square glass-card">
                <h3>Financial Snapshot</h3>
                <div className="mini-chart">
                  <div className="chart-bar-wrap">
                    <div
                      className="chart-bar bg-received"
                      style={{
                        height: `${(project.total_paid / project.latest_budget_total) * 100 || 0}%`,
                      }}
                    />
                  </div>
                  <div className="chart-info">
                    <p>
                      Paid:{" "}
                      {Math.round(
                        (project.total_paid / project.latest_budget_total) *
                          100,
                      ) || 0}
                      %
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="integrated-timeline-card glass-card fade-in">
              <div className="timeline-section-header">
                <h3>Project Timeline</h3>
                <button
                  className="sui-btn sui-btn-save milestone-add-toggle-btn"
                  onClick={() => setShowAddMilestone((p) => !p)}
                >
                  <Icon
                    name={showAddMilestone ? "close" : "add"}
                    modifiers="sm"
                  />
                  <span>{showAddMilestone ? "Cancel" : "Add Milestone"}</span>
                </button>
              </div>

              {showAddMilestone && (
                <div className="add-milestone-panel">
                  <div className="sui-form-group">
                    <label>Title</label>
                    <input
                      type="text"
                      className="sui-form-control"
                      placeholder="e.g. Pre-Production Complete"
                      value={milestoneTitle}
                      onChange={(e) => setMilestoneTitle(e.target.value)}
                    />
                  </div>
                  <div className="add-milestone-panel-row">
                    <div className="sui-form-group">
                      <label>Target Date</label>
                      <input
                        type="date"
                        className="sui-form-control"
                        value={milestoneDate}
                        onChange={(e) => setMilestoneDate(e.target.value)}
                      />
                    </div>
                    <div className="sui-form-group">
                      <label>Assignee</label>
                      <GlassDropdown
                        options={[
                          { value: 1, label: "VisionDivision" },
                          { value: 0, label: "Client" },
                        ]}
                        value={milestoneAssignee}
                        onChange={(val) => setMilestoneAssignee(val)}
                        placeholder="Select..."
                      />
                    </div>
                    <div className="sui-form-group">
                      <label>Status</label>
                      <GlassDropdown
                        options={[
                          { value: "pending", label: "Pending" },
                          { value: "in_progress", label: "In Progress" },
                          { value: "completed", label: "Completed" },
                        ]}
                        value={milestoneStatus}
                        onChange={(val) => setMilestoneStatus(val)}
                        placeholder="Select Status..."
                      />
                    </div>
                  </div>
                  <div className="sui-form-group">
                    <label>Description (Optional)</label>
                    <textarea
                      className="sui-form-control"
                      rows="2"
                      placeholder="Enter milestone details..."
                      value={milestoneDesc}
                      onChange={(e) => setMilestoneDesc(e.target.value)}
                    />
                  </div>
                  <div className="add-milestone-panel-actions">
                    <button
                      className="sui-btn sui-btn-save"
                      onClick={handleAddMilestone}
                      disabled={milestoneSaving}
                    >
                      {milestoneSaving ? "Adding..." : "Add Milestone"}
                    </button>
                  </div>
                </div>
              )}

              <div className="project-timeline-embedded-wrap">
                <SuiTimeline
                  projectId={projectId}
                  userRole="admin"
                  updateTrigger={timelineTrigger}
                />
              </div>
            </div>
          )}

          {activeTab === "budget" && (
            <div className="integrated-budget-section fade-in">
              {/* Sub-tab navigation for Finance */}
              <div className="finance-sub-nav">
                <button
                  className={`sub-nav-btn ${!showPayments ? "active" : ""}`}
                  onClick={() => setShowPayments(false)}
                >
                  <Icon name="finance" modifiers="sm" />
                  <span>Budget Summary</span>
                </button>
                <button
                  className={`sub-nav-btn ${showPayments ? "active" : ""}`}
                  onClick={() => setShowPayments(true)}
                >
                  <Icon name="payments" modifiers="sm" />
                  <span>Payment Records</span>
                </button>
              </div>

              {!showPayments ? (
                <>
                  {/* Version selector bar */}
                  {budgetVersions.length > 0 && (
                    <div className="budget-version-bar">
                      <span className="bvb-label">
                        <Icon name="layers" modifiers="md" />
                      </span>
                      <div className="bvb-pills">
                        {budgetVersions.map((v) => (
                          <button
                            key={v.id}
                            className={`bvb-pill ${
                              String(v.id) === String(selectedVersionId)
                                ? "active"
                                : ""
                            }`}
                            onClick={() => setSelectedVersionId(String(v.id))}
                          >
                            v{v.version_number}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <BudgetSummary
                    projectId={projectId}
                    versionId={selectedVersionId}
                    hierarchy={
                      budgetCache[projectId]?.[selectedVersionId]?.hierarchy ||
                      []
                    }
                    values={
                      budgetCache[projectId]?.[selectedVersionId]?.values || {}
                    }
                    loading={
                      budgetLoading &&
                      !budgetCache[projectId]?.[selectedVersionId]
                    }
                    totalPaid={project.total_paid}
                  />
                </>
              ) : (
                <ClientPayments projectId={projectId} />
              )}
            </div>
          )}

          {activeTab === "team" && (
            <div className="team-management-layout fade-in">
              <div className="team-category glass-card">
                <h3>Clients</h3>
                <div className="user-tag-list">
                  {project.client_usernames ? (
                    project.client_usernames.split(",").map((name) => (
                      <div key={name} className="user-pill client">
                        {name.trim()}
                      </div>
                    ))
                  ) : (
                    <p className="empty-msg">No clients assigned</p>
                  )}
                </div>
              </div>

              <div className="team-category glass-card">
                <h3>Production Crew</h3>
                <div className="user-tag-list">
                  {project.crew_usernames ? (
                    project.crew_usernames.split(",").map((name) => (
                      <div key={name} className="user-pill crew">
                        {name.trim()}
                      </div>
                    ))
                  ) : (
                    <p className="empty-msg">No crew members assigned</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      </div>

      {showEditModal && (
        <ModalPortal onClose={() => setShowEditModal(false)}>
          <ProjectForm
            editingProject={project}
            onAdded={handleProjectUpdated}
            onCancelEdit={() => setShowEditModal(false)}
          />
        </ModalPortal>
      )}
    </div>
  );
};

export default ProjectDetailDashboard;
