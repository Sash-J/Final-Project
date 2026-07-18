import React from "react";
import "./CompositeBentoCard.css";

const CompositeBentoCard = ({
  pillContent,
  bottomContent,
  rightContent,
  fill, // Removed hardcoded default; now driven by CSS unless explicitly passed
  className = "",
  onClick,
}) => {
  return (
    <div className={`composite-bento-card ${className}`} onClick={onClick}>
      {/* Background Shapes */}
      <div className="composite-bg-container">
        {/* Shape 1: Bottom Left */}
        <div
          className="composite-shape-1"
          style={fill ? { background: fill } : {}}
        ></div>

        {/* Shape 2: Right Block */}
        <div
          className="composite-shape-2"
          style={fill ? { background: fill } : {}}
        ></div>

        {/* Shape 3: Top Left Pill */}
        <div
          className="composite-shape-3"
          style={fill ? { background: fill } : {}}
        ></div>

        {/* The SVG Fillet Bridge */}
        <svg
          className="composite-svg-bridge"
          viewBox="-32 0 32 32"
          preserveAspectRatio="none"
        >
          <path
            d="M 0 0 C 0 24 -6.4 32 -32 32 H 0 Z"
            fill={fill || "var(--bridge-fill, rgba(13, 15, 23, 0.65))"}
          />
          {/* Draw the inner stroke along the curve */}
          <path
            className="composite-bridge-stroke"
            d="M 0 0 C 0 24 -6.4 32 -32 32"
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Foreground Content */}
      <div className="composite-content-layer">
        <div className="composite-pill-content global-glass-effect">{pillContent}</div>
        <div className="composite-bottom-content">{bottomContent}</div>
        <div className="composite-right-content">{rightContent}</div>
      </div>
    </div>
  );
};

export default CompositeBentoCard;
