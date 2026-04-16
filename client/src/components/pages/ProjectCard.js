import React from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../common/Icon";
import "./ProjectCard.css";

const ProjectCard = ({
  project,
  onDelete,
  onEdit,
  onToggleStatus,
  variant = "standard",
}) => {
  const navigate = useNavigate();
  const isCompleted = project.status === "completed";
  const isCompact = variant === "compact";

  const handleCardClick = () => {
    navigate(`/admin/projects/${project.id}`);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div
      className={`project-card-container fade-in ${isCompleted ? "archived" : ""} ${isCompact ? "compact" : ""}`}
    >
      <div className="project-card-glass" onClick={handleCardClick}>
        {/* Background Image Layer */}
        <div className="project-card-image-wrap">
          {project.project_image ? (
            <img
              src={project.project_image}
              alt={project.project_name}
              className="project-card-img"
            />
          ) : (
            <div
              className="project-card-img-placeholder"
              style={{
                background: `linear-gradient(135deg, ${project.color}44 0%, ${project.color}dd 100%)`,
              }}
            >
              <Icon
                name="movie"
                modifiers={isCompact ? "sm" : "lg"}
                style={{ color: "#fff", opacity: 0.5 }}
              />
            </div>
          )}

          {!isCompact && (
            <div
              className="project-card-overlay-gradient"
              style={{
                background: `linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)`,
              }}
            />
          )}
        </div>

        {/* Foreground Content Content Layer */}
        <div className="project-card-content">
          <div className="project-card-main-info">
            <div className="project-card-header">
              <h3 className="project-card-title">
                {project.project_name}
                {!isCompleted && (
                  <Icon
                    name="verified"
                    modifiers="xs"
                    className="verified-badge"
                  />
                )}
              </h3>
              {isCompact && (
                <span className="compact-code" style={{ color: project.color }}>
                  {project.code_name}
                </span>
              )}
            </div>

            {!isCompact && (
              <>
                <p className="project-card-client">
                  {project.client_usernames || "Private Client"}
                </p>
                <p className="project-card-location">
                  {project.location || "Remote Production"}
                </p>
              </>
            )}
          </div>

          <div className="project-card-footer">
            {!isCompact && (
              <div className="project-card-stats">
                <div className="stat-item">
                  <Icon name="groups" modifiers="xs" />
                  <span>
                    {project.client_usernames
                      ? project.client_usernames.split(",").length
                      : 0}
                  </span>
                </div>
                <div className="stat-item">
                  <Icon name="layers" modifiers="xs" />
                  <span>v{project.version_count || 1}</span>
                </div>
              </div>
            )}

            <div className="project-card-actions">
              <button
                className={`pill-toggle-btn ${isCompleted ? "archived" : "active"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStatus(project.id, project.status);
                }}
              >
                <span>{isCompleted ? "Restore" : ""}</span>
                <Icon name={isCompleted ? "undo" : "archive"} modifiers="md" />
              </button>
            </div>
          </div>
        </div>

        {!isCompact && (
          <div
            className="project-identity-badge"
            style={{ backgroundColor: project.color }}
          >
            {project.code_name || "ID"}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectCard;
