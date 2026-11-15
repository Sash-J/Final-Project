import React from "react";
import "./FinanceSkeleton.css";

/**
 * Reserved-dimension loading skeleton mirroring the Finance Overview
 * Composite Bento layout to prevent CLS and overflow during loads.
 */
const FinanceSkeleton = ({ variant = "overview" }) => {
  if (variant === "subview") {
    return (
      <div
        className="fin-skel-overview"
        aria-busy="true"
        aria-label="Loading section"
      >
        <div className="fin-skel-card fin-skel-subview">
          <div className="fin-skel-row">
            <div className="skeleton-base fin-skel-hero-num" />
            <div className="skeleton-base fin-skel-chip" />
          </div>
          <div className="skeleton-base fin-skel-sub-line" />
          <div className="fin-skel-list">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="skeleton-base fin-skel-list-item" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fin-skel-overview"
      aria-busy="true"
      aria-label="Loading Finance Workspace"
    >
      <div className="fin-skel-bento-grid">
        {/* Column 1: Hero + Treasury + Insights */}
        <div className="fin-skel-col">
          <div className="fin-skel-card fin-skel-hero">
            <div className="fin-skel-row">
              <div className="skeleton-base fin-skel-pill" />
              <div className="skeleton-base fin-skel-chip" />
            </div>
            <div className="skeleton-base fin-skel-hero-num" />
            <div className="skeleton-base fin-skel-spark" />
            <div className="skeleton-base fin-skel-sub-line" />
          </div>

          <div className="fin-skel-card fin-skel-treasury">
            <div className="fin-skel-row">
              <div className="skeleton-base fin-skel-pill" />
              <div className="skeleton-base fin-skel-chip" />
            </div>
            <div className="fin-skel-grid-2x1">
              <div className="skeleton-base fin-skel-mini-tile" />
              <div className="skeleton-base fin-skel-mini-tile" />
            </div>
          </div>

          <div className="fin-skel-card fin-skel-insights">
            <div className="skeleton-base fin-skel-pill" />
            <div className="skeleton-base fin-skel-sub-line" />
            <div className="skeleton-base fin-skel-btn" />
          </div>
        </div>

        {/* Column 2: Buckets + Cashflow Trajectory */}
        <div className="fin-skel-col">
          <div className="fin-skel-card fin-skel-buckets">
            <div className="fin-skel-row">
              <div className="skeleton-base fin-skel-pill" />
              <div className="skeleton-base fin-skel-chip" />
            </div>
            <div className="fin-skel-grid-2x2">
              {[1, 2, 3, 4].map((tile) => (
                <div key={tile} className="skeleton-base fin-skel-tile" />
              ))}
            </div>
          </div>

          <div className="fin-skel-card fin-skel-chart">
            <div className="fin-skel-row">
              <div className="skeleton-base fin-skel-pill" />
              <div className="skeleton-base fin-skel-chip" />
            </div>
            <div className="skeleton-base fin-skel-chart-body" />
          </div>
        </div>

        {/* Column 3: Full-Height Watchlist Drawer */}
        <div className="fin-skel-col">
          <div className="fin-skel-card fin-skel-watchlist">
            <div className="fin-skel-row">
              <div className="skeleton-base fin-skel-pill" />
              <div className="skeleton-base fin-skel-chip" />
            </div>
            <div className="skeleton-base fin-skel-seg-bar" />
            <div className="fin-skel-list">
              {[1, 2, 3, 4, 5, 6].map((row) => (
                <div key={row} className="skeleton-base fin-skel-list-item" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceSkeleton;
