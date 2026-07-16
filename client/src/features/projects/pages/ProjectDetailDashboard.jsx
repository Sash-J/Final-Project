import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { projectService } from "../../../services/projectService";
import { useModal } from "../../../context/ModalContext";
import { useProjects } from "../context/ProjectContext";
import { formatCurrency } from "../../../utils/currencyUtils";
import Icon from "../../../components/common/Icon";
import ModalPortal from "../../../components/common/ModalPortal";
import ProjectDashboardFinance from "../components/ProjectDashboardFinance";
import ProjectDashboardProduction from "../components/ProjectDashboardProduction";
import "./ProjectDetailDashboard.css";
import ScrambleText from "../../../components/common/ScrambleText";
import ProjectForm from "../components/ProjectForm";
import AddMilestonePanel from "../../timeline/components/AddMilestonePanel";
import SuiTimeline from "../../timeline/components/SuiTimeline";
import HoverTooltip from "../../../components/common/HoverTooltip";

const ProjectDetailSkeleton = ({ projectId }) => (
  <div className="project-detail-root">
    <div className="project-detail-header-wrap">
      <div className="pd-top-row">
        <div
          className="skeleton-base"
          style={{ width: "80px", height: "30px" }}
        ></div>
        <div
          className="skeleton-base"
          style={{ width: "40px", height: "40px", borderRadius: "12px" }}
        ></div>
      </div>
      <div className="project-main-info">
        <div
          className="project-hero-area"
          style={{ borderLeft: "8px solid rgba(255,255,255,0.1)" }}
        >
          <div className="project-title-stack" style={{ width: "100%" }}>
            <div
              className="skeleton-base"
              style={{
                width: "120px",
                height: "14px",
                opacity: 0.5,
                marginBottom: "5px",
              }}
            ></div>
            <div className="project-name-group">
              <div
                className="skeleton-base"
                style={{ width: "400px", height: "48px" }}
              ></div>
            </div>
            <div className="project-metadata-row" style={{ marginTop: "15px" }}>
              <div
                className="skeleton-base"
                style={{ width: "150px", height: "18px" }}
              ></div>
              <div
                className="skeleton-base"
                style={{ width: "180px", height: "18px" }}
              ></div>
              <div
                className="skeleton-base"
                style={{ width: "180px", height: "18px" }}
              ></div>
            </div>
          </div>
          <div className="project-hero-stats" style={{ gap: "40px" }}>
            <div
              className="skeleton-base"
              style={{ width: "100px", height: "55px", borderRadius: "8px" }}
            ></div>
            <div
              className="skeleton-base"
              style={{ width: "100px", height: "55px", borderRadius: "8px" }}
            ></div>
            <div
              className="skeleton-base"
              style={{ width: "120px", height: "55px", borderRadius: "8px" }}
            ></div>
            <div
              className="skeleton-base"
              style={{ width: "120px", height: "55px", borderRadius: "8px" }}
            ></div>
          </div>
        </div>
      </div>
    </div>

    <div className="dashboard-content-grid">
      <div className="bento-layout">
        <div className="bento-item lg-rect glass-card no-padding overflow-hidden">
          {projectId ? (
            <div className="project-timeline-preview">
              <SuiTimeline
                projectId={projectId}
                userRole="admin"
                preview={true}
              />
            </div>
          ) : (
            <div
              className="skeleton-base"
              style={{ width: "100%", height: "100%" }}
            ></div>
          )}
        </div>
        <div className="bento-item sm-square glass-card skeleton-base"></div>
        <div className="bento-item sm-square glass-card skeleton-base"></div>
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
    getProjectMilestones,
    milestonesCache,
  } = useProjects();

  const [activeTab, setActiveTab] = useState("overview");
  const [showEditModal, setShowEditModal] = useState(false);
  const { showConfirm } = useModal();

  // Local UI state for add milestone panel
  // coding help from Open AI
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [timelineTrigger, setTimelineTrigger] = useState(0);
  const [timelineViewMode, setTimelineViewMode] = useState("detailed");
  const [showTimelineSettings, setShowTimelineSettings] = useState(false);

  const project = detailsCache[projectId];

  const projectMilestones = milestonesCache[projectId] || [];
  const completedCount = projectMilestones.filter(
    (m) => m.status === "completed",
  ).length;
  const remainingCount = projectMilestones.length - completedCount;

  const formatDate = (dateStr) => {
    if (!dateStr) return "TBD";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  useEffect(() => {
    if (!projectId) return;
    getProjectMilestones(projectId);
  }, [projectId, getProjectMilestones, timelineTrigger]);

  useEffect(() => {
    if (!projectId) return;
    getProjectDetails(projectId);
  }, [projectId, getProjectDetails]);

  const handleDelete = async () => {
    const ok = await showConfirm(
      "Are you sure you want to delete this project? All associated data will be permanently removed.",
    );
    if (!ok) return;
    try {
      await projectService.deleteProject(projectId);
      invalidateCache();
      navigate("/admin");
    } catch (err) {
      alert(err.message || "Failed to delete");
    }
  };

  const handleProjectUpdated = () => {
    invalidateCache();
    getProjectDetails(projectId, true);
    setShowEditModal(false);
  };

  if (detailsLoading && !project)
    return <ProjectDetailSkeleton projectId={projectId} />;
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
            <Icon name="delete" modifiers="md" />
          </button>
        </div>

        <div className="project-main-info">
          <div
            className="project-hero-area"
            style={{ borderLeft: `8px solid ${project.color}` }}
          >
            {project.project_image && (
              <div className="project-hero-bg-image-wrap">
                <img
                  src={project.project_image}
                  alt=""
                  className="project-hero-bg-image"
                />
                <div className="project-hero-bg-overlay" />
              </div>
            )}
            <div className="project-title-stack">
              <span
                className="project-code-tag"
                style={{ color: project.color }}
              >
                {project.code_name}
              </span>
              <div className="project-name-group">
                <ScrambleText as="h1" text={project.project_name} />
                <button
                  className="project-hero-btn edit"
                  onClick={() => setShowEditModal(true)}
                >
                  <Icon name="edit" modifiers="md" />
                </button>
              </div>
              <div className="project-metadata-row">
                <p className="project-location-text">
                  <Icon name="location_on" modifiers="xs" />
                  {project.location || "Location not specified"}
                </p>
                <p className="project-location-text">
                  <Icon name="calendar_month" modifiers="xs" />
                  <span>Start: {formatDate(project.start_date)}</span>
                </p>
                <p className="project-location-text">
                  <Icon name="event_available" modifiers="xs" />
                  <span>Delivery: {formatDate(project.end_date)}</span>
                </p>
              </div>
            </div>

            <div className="project-hero-stats">
              <div className="hero-stat-box">
                <label>Milestones</label>
                <span className="success-text">{completedCount}</span>
              </div>
              <div className="hero-stat-box">
                <label>Remaining</label>
                <span className="warning-text">{remainingCount}</span>
              </div>
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
        <>
          {activeTab === "overview" && (
            <div className="bento-layout fade-in">
              <div className="bento-item lg-rect glass-card no-padding overflow-hidden">
                <div
                  className="project-timeline-preview"
                  onClick={() => setShowTimelineModal(true)}
                >
                  <SuiTimeline
                    projectId={projectId}
                    userRole="admin"
                    preview={true}
                  />
                </div>
              </div>

              <div
                className="bento-item sm-square glass-card"
                onClick={() => setShowProductionModal(true)}
                style={{ cursor: "pointer" }}
              >
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

              <div
                className="bento-item sm-square glass-card"
                onClick={() => setShowFinanceModal(true)}
                style={{ cursor: "pointer" }}
              >
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

          {showTimelineModal && (
            <ModalPortal
              onClose={() => setShowTimelineModal(false)}
              size="large"
              className="profile-modal-glass timeline-glass-override"
            >
              <div className="timeline-modal-container">
                <div className="modal-header-section">
                  <div className="timeline-header-top-row">
                    <div className="timeline-header-title-group">
                      <div>
                        <h2>Project Timeline</h2>
                        <p>Manage and track project milestones</p>
                      </div>
                      <button
                        className="btn-neo btn-neo-solid"
                        onClick={() => setShowAddMilestone(true)}
                      >
                        <Icon name="add" modifiers="sm" />
                        <span>Add Milestone</span>
                      </button>
                    </div>

                    <div className="sui-view-toggle">
                      <HoverTooltip text="Detailed View">
                        <button
                          className={`sui-view-toggle-btn ${timelineViewMode === "detailed" ? "active" : ""}`}
                          onClick={() => setTimelineViewMode("detailed")}
                        >
                          <Icon name="view_comfy" modifiers="sm" />
                        </button>
                      </HoverTooltip>
                      <HoverTooltip text="Simple View">
                        <button
                          className={`sui-view-toggle-btn ${timelineViewMode === "simple" ? "active" : ""}`}
                          onClick={() => setTimelineViewMode("simple")}
                        >
                          <Icon name="view_cozy" modifiers="sm" />
                        </button>
                      </HoverTooltip>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-8px" }}>
                    <div className="timeline-status-legend">
                      <div className="timeline-legend-item">
                        <div className="timeline-legend-dot pending" />
                        <span className="timeline-legend-label">
                          Pending
                        </span>
                      </div>
                      <div className="timeline-legend-item">
                        <div className="timeline-legend-dot in-progress" />
                        <span className="timeline-legend-label">
                          In Progress
                        </span>
                      </div>
                      <div className="timeline-legend-item">
                        <div className="timeline-legend-dot completed" />
                        <span className="timeline-legend-label">
                          Completed
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {showAddMilestone && (
                  <ModalPortal
                    onClose={() => setShowAddMilestone(false)}
                    size="medium"
                    className="profile-modal-glass"
                  >
                    <AddMilestonePanel
                      projectId={projectId}
                      onSuccess={() => {
                        setTimelineTrigger((prev) => prev + 1);
                        setShowAddMilestone(false);
                      }}
                      onClose={() => setShowAddMilestone(false)}
                    />
                  </ModalPortal>
                )}

                <div className="project-timeline-embedded-wrap">
                  <SuiTimeline
                    projectId={projectId}
                    userRole="admin"
                    updateTrigger={timelineTrigger}
                    viewMode={timelineViewMode}
                  />
                </div>
              </div>
            </ModalPortal>
          )}

          {showFinanceModal && (
            <ProjectDashboardFinance
              projectId={projectId}
              onClose={() => setShowFinanceModal(false)}
              projectTotalPaid={project.total_paid}
            />
          )}

          {showProductionModal && (
            <ProjectDashboardProduction
              project={project}
              onClose={() => setShowProductionModal(false)}
            />
          )}
        </>
      </div>

      {showEditModal && (
        <ModalPortal
          onClose={() => setShowEditModal(false)}
          className="profile-modal-glass"
        >
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
