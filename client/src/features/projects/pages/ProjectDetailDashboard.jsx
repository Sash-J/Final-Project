import { useEffect, useState, useMemo } from "react";
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
import CompositeBentoCard from "../../../components/common/CompositeBentoCard";

const ProjectDetailSkeleton = ({ projectId }) => (
  <div className="project-detail-root">
    <div className="project-detail-header-wrap">
      <div className="pd-top-row">
        <div className="skeleton-base skeleton-title-badge"></div>
        <div className="skeleton-base skeleton-avatar"></div>
      </div>
      <div className="project-main-info">
        <div className="project-hero-area skeleton-hero-area">
          <div className="project-title-stack skeleton-title-stack">
            <div className="skeleton-base skeleton-code-tag"></div>
            <div className="project-name-group">
              <div className="skeleton-base skeleton-project-name"></div>
            </div>
            <div className="project-metadata-row skeleton-metadata-row">
              <div className="skeleton-base skeleton-metadata-item-1"></div>
              <div className="skeleton-base skeleton-metadata-item-2"></div>
              <div className="skeleton-base skeleton-metadata-item-2"></div>
            </div>
          </div>
          <div className="project-hero-stats skeleton-hero-stats">
            <div className="skeleton-base skeleton-stat-box-sm"></div>
            <div className="skeleton-base skeleton-stat-box-sm"></div>
            <div className="skeleton-base skeleton-stat-box-lg"></div>
            <div className="skeleton-base skeleton-stat-box-lg"></div>
          </div>
        </div>
      </div>
    </div>

    <div className="dashboard-content-grid">
      <div className="bento-layout">
        <div className="bento-item lg-rect summary-bento-card no-padding overflow-hidden">
          {projectId ? (
            <div className="project-timeline-preview">
              <SuiTimeline
                projectId={projectId}
                userRole="admin"
                preview={true}
              />
            </div>
          ) : (
            <div className="skeleton-base skeleton-timeline-preview"></div>
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
  const [productionViewMode, setProductionViewMode] = useState("hierarchy");
  const [timelineTrigger, setTimelineTrigger] = useState(0);
  const [timelineViewMode, setTimelineViewMode] = useState("detailed");
  const [showTimelineSettings, setShowTimelineSettings] = useState(false);

  const project = detailsCache[projectId];

  const projectMilestones = milestonesCache[projectId] || [];
  const completedCount = projectMilestones.filter(
    (m) => m.status === "completed",
  ).length;
  const remainingCount = projectMilestones.length - completedCount;

  const crewStats = useMemo(() => {
    let deptCount = 0;
    let memberCount = 0;
    let memberNames = [];
    let leadName = null;
    let leadRole = null;
    let maxLevel = 0;

    if (project?.crew_hierarchy_data) {
      try {
        const parsed =
          typeof project.crew_hierarchy_data === "string"
            ? JSON.parse(project.crew_hierarchy_data)
            : project.crew_hierarchy_data;

        const traverse = (node, currentDepth) => {
          if (!node) return;
          if (currentDepth > maxLevel) maxLevel = currentDepth;
          if (node.department) deptCount++;
          if (node.members && Array.isArray(node.members)) {
            node.members.forEach((m) => {
              if (m.name?.trim() || m.role?.trim()) {
                memberCount++;
                if (m.name?.trim()) {
                  memberNames.push(m.name.trim());
                  // Extract the first prominent lead if not already found
                  if (
                    !leadName &&
                    m.role &&
                    (m.role.toLowerCase().includes("producer") ||
                      m.role.toLowerCase().includes("director"))
                  ) {
                    leadName = m.name.trim();
                    leadRole = m.role.trim();
                  }
                }
              }
            });
          }
          if (node.children && Array.isArray(node.children)) {
            node.children.forEach((child) => traverse(child, currentDepth + 1));
          }
        };

        traverse(parsed, 1);
      } catch (err) {
        console.error("Failed to parse crew hierarchy for summary", err);
      }
    }

    return {
      deptCount,
      memberCount,
      memberNames,
      leadName,
      leadRole,
      maxLevel,
    };
  }, [project?.crew_hierarchy_data]);

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
              <div className="bento-item lg-rect summary-bento-card no-padding overflow-hidden">
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

              <CompositeBentoCard
                className="summary-bento-card"
                onClick={() => {
                  setProductionViewMode("hierarchy");
                  setShowProductionModal(true);
                }}
                pillContent={
                  <div className="summary-lead-container">
                    <div className="summary-avatar">
                      <span className="summary-avatar-initial">
                        {crewStats.leadName && crewStats.leadName !== "TBD"
                          ? crewStats.leadName.charAt(0)
                          : "?"}
                      </span>
                    </div>
                    <div className="summary-lead-text">
                      <span className="summary-lead-name">
                        {crewStats.leadName}
                      </span>
                      <span className="summary-lead-role">
                        {crewStats.leadRole}
                      </span>
                    </div>
                  </div>
                }
                bottomContent={
                  <div className="summary-bento-middle">
                    <h3 className="summary-bento-title">Crew Hierarchy</h3>
                    <span className="summary-bento-subtitle">
                      Nodes: <strong>{crewStats.deptCount}</strong>{" "}
                      <span style={{ margin: "0 10px" }}></span> Levels:{" "}
                      <strong>{crewStats.maxLevel}</strong>
                    </span>
                    <div className="summary-progress-container">
                      <div className="summary-progress-bar">
                        <div
                          className="summary-progress-fill"
                          style={{ width: "34%" }}
                        ></div>
                      </div>
                      <div className="summary-progress-labels">
                        <span>Production Crew Allocation</span>
                        <span className="summary-progress-value">34%</span>
                      </div>
                    </div>
                  </div>
                }
                rightContent={
                  <div className="summary-bento-top-right">
                    <div className="summary-selector global-glass-effect">
                      <div className="summary-selector-icon">
                        <Icon name="groups" modifiers="sm" />
                      </div>
                      <span>{crewStats.memberCount} Crew</span>
                      <Icon name="expand_more" modifiers="sm" />
                    </div>
                  </div>
                }
              />

              <div
                className="bento-item sm-square glass-card summary-bento-card equipment-bento-card clickable-bento-card"
                onClick={() => {
                  setProductionViewMode("equipment");
                  setShowProductionModal(true);
                }}
              >
                <div className="summary-bento-top">
                  {(() => {
                    let heroImg = null;
                    let heroTitle = "ARRI Alexa";
                    let heroSubtitle = "Camera A";
                    try {
                      if (project?.equipment_data) {
                        const parsed =
                          typeof project.equipment_data === "string"
                            ? JSON.parse(project.equipment_data)
                            : project.equipment_data;
                        if (parsed?.hero) {
                          if (parsed.hero.image) heroImg = parsed.hero.image;
                          if (parsed.hero.name) heroTitle = parsed.hero.name;
                          if (parsed.hero.label)
                            heroSubtitle = parsed.hero.label;
                        }
                      }
                    } catch (e) {}

                    return (
                      <div className="equipment-preview global-glass-effect">
                        <div
                          className="hero-camera-image"
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: 0,
                            border: "none",
                            boxShadow: "none",
                            position: "absolute",
                            top: 0,
                            left: 0,
                          }}
                        >
                          {heroImg ? (
                            <img src={heroImg} alt={heroTitle} />
                          ) : (
                            <Icon
                              name="videocam"
                              modifiers="xl"
                              className="equipment-icon-opacity"
                            />
                          )}
                        </div>
                        <div className="equipment-preview-overlay">
                          <span className="equipment-preview-title">
                            {heroTitle}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="summary-selector global-glass-effect">
                    <div className="summary-selector-icon">
                      <Icon name="inventory" modifiers="sm" />
                    </div>
                    <span>12 Active</span>
                    <Icon name="expand_more" modifiers="sm" />
                  </div>
                </div>

                <div className="summary-bento-middle">
                  <h3 className="summary-bento-title">Equipment</h3>
                  <span className="summary-bento-subtitle">
                    Allocated: <strong>85%</strong>
                  </span>
                </div>

                <div className="summary-progress-container">
                  <div className="summary-progress-bar">
                    <div
                      className="summary-progress-fill"
                      style={{ width: "85%" }}
                    ></div>
                  </div>
                  <div className="summary-progress-labels">
                    <span>Utilization</span>
                    <span>85%</span>
                  </div>
                </div>
              </div>

              <div
                className="bento-item sm-square glass-card clickable-bento-card"
                onClick={() => setShowFinanceModal(true)}
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

                  <div className="timeline-legend-wrapper">
                    <div className="timeline-status-legend">
                      <div className="timeline-legend-item">
                        <div className="timeline-legend-dot pending" />
                        <span className="timeline-legend-label">Pending</span>
                      </div>
                      <div className="timeline-legend-item">
                        <div className="timeline-legend-dot in-progress" />
                        <span className="timeline-legend-label">
                          In Progress
                        </span>
                      </div>
                      <div className="timeline-legend-item">
                        <div className="timeline-legend-dot completed" />
                        <span className="timeline-legend-label">Completed</span>
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
              viewMode={productionViewMode}
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
