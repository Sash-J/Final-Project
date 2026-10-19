import { useNavigate } from "react-router-dom";
import HoverTooltip from "../../../components/common/HoverTooltip";
import Icon from "../../../components/common/Icon";
import ScrambleText from "../../../components/common/ScrambleText";
import VerificationBadge from "../../../components/common/VerificationBadge";
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

  const getClients = () => {
    if (Array.isArray(project.client_details) && project.client_details.length > 0) {
      return project.client_details.map((c) => ({
        id: c.id,
        name: c.username || c.name || "Client",
        tier: c.verified_level || c.role || "Gold level 1",
      }));
    }

    if (project.client_usernames) {
      const names = project.client_usernames
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const tiers = project.client_verified_levels
        ? project.client_verified_levels
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      return names.map((name, i) => ({
        id: i,
        name,
        tier: tiers[i] || project.client_roles || "Gold level 1",
      }));
    }

    return [];
  };

  const clients = getClients();
  const primaryClientTier = clients.length > 0 ? clients[0].tier : null;

  return (
    <div
      className={`project-card-container fade-in ${isCompleted ? "archived" : ""} ${isCompact ? "compact" : ""}`}
    >
      <div className="project-card-glass" onClick={handleCardClick}>
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
                className={`project-card-placeholder-icon ${isCompact ? 'compact' : ''}`}
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

        <div className="project-card-content">
          <div className="project-card-main-info">
            <div className="project-card-header">
              <h3 className="project-card-title">
                <ScrambleText text={project.project_name} as="span" />
                {!isCompleted && (
                  <HoverTooltip text="Verified project" icon="verified">
                    <Icon
                      name="verified"
                      modifiers="xs"
                      className="verified-badge"
                    />
                  </HoverTooltip>
                )}
              </h3>
              {isCompact && (
                <div className="compact-header-meta">
                  <span className="compact-code" style={{ color: project.color }}>
                    {project.code_name}
                  </span>
                  {primaryClientTier && (
                    <VerificationBadge
                      tier={primaryClientTier}
                      size="xs"
                      className="compact-client-badge"
                    />
                  )}
                </div>
              )}
            </div>

            {!isCompact && (
              <>
                <div className="project-card-client-wrap">
                  {clients.length > 0 ? (
                    clients.map((c, idx) => (
                      <span key={c.id || idx} className="project-card-client-item">
                        <span className="project-card-client-name">{c.name}</span>
                        <VerificationBadge
                          tier={c.tier}
                          size="xs"
                          className="project-card-client-badge"
                        />
                        {idx < clients.length - 1 && (
                          <span className="project-card-client-separator">,</span>
                        )}
                      </span>
                    ))
                  ) : (
                    <span className="project-card-client-name">Private Client</span>
                  )}
                </div>
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
