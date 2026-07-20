import React, { useRef } from "react";
import GlassSurface from "./GlassSurface";
import Grainient from "./Grainient";
import "./CompositeBentoCard.css";

const CompositeBentoCard = ({
  pillContent,
  bottomContent,
  rightContent,
  fill, // Removed hardcoded default; now driven by CSS unless explicitly passed
  className = "",
  onClick,
}) => {
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const cards = cardRef.current.querySelectorAll('.spotlight-overlay');
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
    });
  };

  return (
    <div 
      className={`composite-bento-card ${className}`} 
      onClick={onClick}
      ref={cardRef}
      onMouseMove={handleMouseMove}
    >
      {/* Background Shapes (Glass & Borders) */}
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
        <div className="composite-bridge-wrapper">
          <div
            className="composite-bridge-shape"
            style={fill ? { background: fill } : {}}
          ></div>
          <svg
            className="composite-svg-bridge"
            viewBox="-32 0 32 32"
            preserveAspectRatio="none"
          >
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
      </div>

      {/* Grainient Layer (Flattened Opacity Group) */}
      <div className="composite-bg-container grainient-group">
        <div className="grainient-mask grainient-mask-1">
          <Grainient className="spotlight-overlay" />
        </div>
        <div className="grainient-mask grainient-mask-2">
          <Grainient className="spotlight-overlay" />
        </div>
        <div className="composite-bridge-wrapper">
          <div className="grainient-mask grainient-mask-bridge">
            <Grainient className="spotlight-overlay" />
          </div>
        </div>
      </div>

      {/* Foreground Content */}
      <div className="composite-content-layer">
        <GlassSurface
          className="composite-pill-content global-glass-effect"
          width="calc(100% - var(--right-width) - var(--gap))"
          height="var(--pill-height)"
          borderRadius={100}
          blur={12}
          opacity={0.6}
          backgroundOpacity={0}
        >
          {pillContent}
        </GlassSurface>
        <div className="composite-bottom-content">{bottomContent}</div>
        <div className="composite-right-content">{rightContent}</div>
      </div>
    </div>
  );
};

export default CompositeBentoCard;
