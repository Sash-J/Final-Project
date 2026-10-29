import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkBadge01Icon, FingerPrintIcon } from "@hugeicons/core-free-icons";
import Icon from "../../../components/common/Icon";
import ScrambleText from "../../../components/common/ScrambleText";
import VerificationBadge from "../../../components/common/VerificationBadge";
import ReflectiveCard from "../../../components/common/ReflectiveCard";
import "./ProjectCard.css";

const ProjectCard = ({
  project,
  onDelete,
  onEdit,
  onToggleStatus,
  onClick,
  variant = "standard",
}) => {
  const navigate = useNavigate();
  const isCompleted = project.status === "completed";
  const isCompact = variant === "compact";

  const [isLightTheme, setIsLightTheme] = useState(
    typeof document !== "undefined" && document.body?.classList?.contains("light-theme")
  );

  useEffect(() => {
    setIsLightTheme(document.body.classList.contains("light-theme"));
    const observer = new MutationObserver(() => {
      setIsLightTheme(document.body.classList.contains("light-theme"));
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const handleCardClick = (e) => {
    if (e?.target?.closest(".prc-actions")) {
      return;
    }
    if (onClick) {
      onClick(project);
    } else {
      navigate(`/admin/projects/${project.id}`);
    }
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
  const isVerified = Boolean(
    primaryClientTier ||
    project.is_verified ||
    project.verified ||
    (project.client_verified_levels && project.client_verified_levels.trim().length > 0)
  );

  const statusLabel = isCompleted ? "Completed" : "Active";

  const clientsCount = project.client_usernames
    ? project.client_usernames.split(",").filter(Boolean).length
    : clients.length;

  // ReflectiveCard powered Project Card
  return (
    <div
      className={`project-card-container fade-in ${isCompleted ? "archived" : ""} ${isCompact ? "compact" : ""}`}
    >
      <ReflectiveCard
        theme={isLightTheme ? "light" : "dark"}
        tint={project.color || "#00c6e6"}
        metalness={isCompleted ? 0.6 : 1}
        roughness={isCompleted ? 0.45 : 0.3}
        blurStrength={6}
        shine={isCompleted ? 0.7 : 1}
        glare={isCompleted ? 0.3 : 0.5}
        grayscale={isCompleted ? 1 : 1}
        warp={0.6}
        warpScale={1}
        bevel={0}
        tiltStrength={isCompact ? 4 : 6}
        radius={isCompact ? 20 : 24}
        enableTilt={true}
        intro={true}
        width="100%"
        height={isCompact ? 84 : "100%"}
        className={`project-card-reflective ${isCompleted ? "archived" : ""} ${isCompact ? "compact" : ""}`}
        onClick={handleCardClick}
        backdrop={
          !isCompact && project.project_image ? (
            <div className="prc-image-backdrop">
              <img
                src={project.project_image}
                alt={project.project_name}
                className="prc-backdrop-img"
              />
            </div>
          ) : null
        }
      >
        <div className={`project-reflective-layout ${isCompact ? "compact" : ""}`}>
          {/* Top Header Row: Verified on Left, Active on Right */}
          <div className="reflective-card__header">
            {isCompact && project.project_image && (
              <img
                src={project.project_image}
                alt=""
                className="prc-compact-thumb"
              />
            )}
            {isVerified && (
              <span className="reflective-card__badge" title="Verified Production">
                <HugeiconsIcon icon={CheckmarkBadge01Icon} size={16} strokeWidth={1.8} />
                <span>Verified</span>
              </span>
            )}
            <span className="reflective-card__status">
              <span className={`reflective-card__dot ${isCompleted ? "completed" : "active"}`} />
              <span>{statusLabel}</span>
            </span>
          </div>

          {/* Center: Left open for reflection visuals */}

          {/* Bottom Section: Name & Role */}
          <div className="reflective-card__identity">
            <h3 className="reflective-card__name" title={project.project_name}>
              <ScrambleText text={project.project_name} as="span" />
            </h3>

            {!isCompact && (
              <div className="reflective-card__role prc-role-wrap">
                {clients.length > 0 ? (
                  clients.map((c, idx) => (
                    <span key={c.id || idx} className="prc-client-item">
                      <span className="prc-client-name">{c.name}</span>
                      <VerificationBadge
                        tier={c.tier}
                        size="xs"
                        className="prc-client-badge"
                      />
                      {idx < clients.length - 1 && (
                        <span className="prc-client-separator">,</span>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="prc-client-name prc-private">Private Client</span>
                )}
                {project.location && (
                  <span className="prc-location-chip">
                    <Icon name="location_on" modifiers="xs" />
                    <span>{project.location}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Bottom Footer: ID number & stats on left, action tiles on right */}
          <div className="reflective-card__footer">
            <div className="reflective-card__id">
              <span className="reflective-card__value">
                {project.code_name || `PRJ-${String(project.id).padStart(4, "0")}`}
              </span>
              {!isCompact && (
                <div className="prc-stats-row">
                  <span className="prc-stat-pill" title="Assigned Clients">
                    <Icon name="groups" modifiers="xs" />
                    <span>{clientsCount}</span>
                  </span>
                  <span className="prc-stat-pill" title="Budget Versions">
                    <Icon name="layers" modifiers="xs" />
                    <span>v{project.version_count || 1}</span>
                  </span>
                </div>
              )}
            </div>

            <div className="prc-actions" onClick={(e) => e.stopPropagation()}>
              {onEdit && (
                <button
                  type="button"
                  className="reflective-card__tile prc-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(project);
                  }}
                  title="Edit Project"
                >
                  <Icon name="edit" modifiers="xs" />
                </button>
              )}
              {onToggleStatus && (
                <button
                  type="button"
                  className={`reflective-card__tile prc-action-btn ${isCompleted ? "archived" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStatus(project.id, project.status);
                  }}
                  title={isCompleted ? "Restore Project" : "Archive Project"}
                >
                  <Icon name={isCompleted ? "undo" : "archive"} modifiers="xs" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="reflective-card__tile prc-action-btn danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(project.id);
                  }}
                  title="Delete Project"
                >
                  <Icon name="delete" modifiers="xs" />
                </button>
              )}
              {!onEdit && !onToggleStatus && !onDelete && (
                <span className="reflective-card__tile" title="Vision Division Security Verified">
                  <HugeiconsIcon icon={FingerPrintIcon} size={22} strokeWidth={1.6} />
                </span>
              )}
            </div>
          </div>
        </div>
      </ReflectiveCard>
    </div>
  );
};

export default ProjectCard;
