import React from "react";
import "./Skeleton.css";

export const ProjectCardSkeleton = ({ variant = "standard" }) => {
  const isCompact = variant === "compact";

  return (
    <div
      className={`project-card-container skeleton-container ${
        isCompact ? "compact" : ""
      }`}
    >
      <div className={`pcs-reflective-card ${isCompact ? "compact" : ""}`}>
        <div className={`pcs-layout ${isCompact ? "compact" : ""}`}>
          {/* Header Row: Badge & Status */}
          <div className="pcs-header">
            {isCompact ? (
              <div className="pcs-compact-thumb skeleton-base" />
            ) : (
              <div className="pcs-badge skeleton-base" />
            )}
            <div className="pcs-status skeleton-base" />
          </div>

          {/* Identity Section: Project Name & Client/Location */}
          <div className="pcs-identity">
            <div className="pcs-title skeleton-base" />
            {!isCompact && (
              <div className="pcs-role-row">
                <div className="pcs-client-pill skeleton-base" />
                <div className="pcs-location-pill skeleton-base" />
              </div>
            )}
          </div>

          {/* Footer Row: Code Name, Stats & Action Tiles */}
          <div className="pcs-footer">
            <div className="pcs-footer-left">
              <div className="pcs-code skeleton-base" />
              {!isCompact && (
                <div className="pcs-stats">
                  <div className="pcs-stat-pill skeleton-base" />
                  <div className="pcs-stat-pill skeleton-base" />
                </div>
              )}
            </div>
            <div className="pcs-actions">
              <div className="pcs-action-tile skeleton-base" />
              <div className="pcs-action-tile skeleton-base" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardSkeleton = ({ count = 6 }) => (
  <div className="project-tiles-grid pcs-dashboard-grid">
    {Array.from({ length: count }).map((_, i) => (
      <ProjectCardSkeleton key={i} />
    ))}
  </div>
);

export default DashboardSkeleton;
