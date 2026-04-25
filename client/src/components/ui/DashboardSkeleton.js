import React from "react";
import "./Skeleton.css";

export const ProjectCardSkeleton = () => (
  <div className="project-card-skeleton">
    <div className="pcs-image-wrap">
      <div className="skeleton-base pcs-image" />
      <div className="skeleton-base pcs-badge" />
    </div>
    <div className="pcs-content">
      <div className="skeleton-base pcs-title" />
      <div className="pcs-meta">
        <div className="skeleton-base pcs-meta-item" />
        <div className="skeleton-base pcs-meta-item short" />
      </div>
      <div className="pcs-footer">
        <div className="skeleton-base pcs-team-chip" />
        <div className="skeleton-base pcs-version-chip" />
      </div>
    </div>
  </div>
);

export const DashboardMetricsSkeleton = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "20px",
      marginBottom: "30px",
    }}
  >
    {[1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className="glass-panel"
        style={{ padding: "20px", minHeight: "120px" }}
      >
        <div
          className="skeleton-base"
          style={{ width: "40%", height: "15px", marginBottom: "15px" }}
        />
        <div
          className="skeleton-base"
          style={{ width: "80%", height: "30px" }}
        />
      </div>
    ))}
  </div>
);

const DashboardSkeleton = () => (
  <div className="project-tiles-grid" style={{ padding: "10px 0" }}>
    {[...Array(6)].map((_, i) => (
      <ProjectCardSkeleton key={i} />
    ))}
  </div>
);

export default DashboardSkeleton;
