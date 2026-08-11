import React, { useRef, useState, useEffect } from "react";
import GlassSurface from "./GlassSurface";
import Grainient from "./Grainient";
import "./CompositeBentoCard.css";

const CompositeBentoCard = ({
  pillContent,
  bottomContent,
  rightContent,
  fill,
  className = "",
  onClick,
  overlayComponent,
  singleOverlay = false,
}) => {
  const cardRef = useRef(null);
  const compositeMaskId = useRef(
    `composite-mask-${Math.random().toString(36).substr(2, 9)}`,
  ).current;
  const [maskDims, setMaskDims] = useState(null);

  useEffect(() => {
    if (!singleOverlay || !cardRef.current) return;

    const updateDims = () => {
      const card = cardRef.current;
      const s1 = card.querySelector(".composite-shape-1");
      const s2 = card.querySelector(".composite-shape-2");
      const s3 = card.querySelector(".composite-shape-3");
      const b = card.querySelector(".composite-bridge-wrapper");

      if (s1 && s2 && s3 && b) {
        setMaskDims({
          s1: {
            x: s1.offsetLeft,
            y: s1.offsetTop,
            w: s1.offsetWidth,
            h: s1.offsetHeight,
          },
          s2: {
            x: s2.offsetLeft,
            y: s2.offsetTop,
            w: s2.offsetWidth,
            h: s2.offsetHeight,
          },
          s3: {
            x: s3.offsetLeft,
            y: s3.offsetTop,
            w: s3.offsetWidth,
            h: s3.offsetHeight,
          },
          b: {
            x: b.offsetLeft,
            y: b.offsetTop,
            w: b.offsetWidth,
            h: b.offsetHeight,
          },
        });
      }
    };

    const observer = new ResizeObserver(updateDims);
    observer.observe(cardRef.current);
    updateDims();

    return () => observer.disconnect();
  }, [singleOverlay]);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const cards = cardRef.current.querySelectorAll(".spotlight-overlay");
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
    });
  };

  const currentUrl =
    typeof window !== "undefined" ? window.location.href.split("#")[0] : "";

  return (
    <div
      className={`composite-bento-card ${className} ${singleOverlay ? "single-overlay" : ""}`}
      onClick={onClick}
      ref={cardRef}
      onMouseMove={handleMouseMove}
    >
      {singleOverlay && maskDims && (
        <svg
          width="0"
          height="0"
          style={{ position: "absolute", pointerEvents: "none" }}
        >
          <defs>
            <mask id={compositeMaskId}>
              <rect width="100%" height="100%" fill="black" />

              {/* Shape 3: Pill */}
              <rect
                x={maskDims.s3.x}
                y={maskDims.s3.y}
                width={maskDims.s3.w}
                height={maskDims.s3.h}
                rx={maskDims.s3.h / 2}
                fill="white"
              />

              {/* Shape 1: Bottom Left */}
              <rect
                x={maskDims.s1.x}
                y={maskDims.s1.y}
                width={maskDims.s1.w}
                height={maskDims.s1.h}
                rx="32"
                fill="white"
              />
              {/* Make Shape 1 right edge sharp so it touches Shape 2 */}
              <rect
                x={maskDims.s1.x + maskDims.s1.w - 32}
                y={maskDims.s1.y}
                width={32}
                height={maskDims.s1.h}
                fill="white"
              />

              {/* Shape 2: Right Block */}
              <rect
                x={maskDims.s2.x}
                y={maskDims.s2.y}
                width={maskDims.s2.w}
                height={maskDims.s2.h}
                rx="32"
                fill="white"
              />
              {/* Make Shape 2 bottom-left sharp so it connects to Shape 1 */}
              <rect
                x={maskDims.s2.x}
                y={maskDims.s2.y + maskDims.s2.h - 32}
                width={32}
                height={32}
                fill="white"
              />

              {/* Bridge / Fillet */}
              <svg
                x={maskDims.b.x}
                y={maskDims.b.y}
                width={maskDims.b.w}
                height={maskDims.b.h}
                viewBox="-32 0 32 32"
                preserveAspectRatio="none"
              >
                <path d="M 0 0 C 0 24 -6.4 32 -32 32 H 0 Z" fill="white" />
              </svg>
            </mask>
          </defs>
        </svg>
      )}

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
              strokeWidth="0.75"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>

      {/* Grainient Layer */}
      {singleOverlay ? (
        <div
          className="composite-bg-container grainient-group"
          style={{
            display: "block",
            maskImage: `url("${currentUrl}#${compositeMaskId}")`,
            WebkitMaskImage: `url("${currentUrl}#${compositeMaskId}")`,
          }}
        >
          <div style={{ position: "absolute", inset: 0 }}>
            {overlayComponent ? (
              React.cloneElement(overlayComponent, {
                className: "spotlight-overlay",
              })
            ) : (
              <Grainient className="spotlight-overlay" />
            )}
          </div>
        </div>
      ) : (
        <div className="composite-bg-container grainient-group">
          <div className="grainient-mask grainient-mask-3">
            {overlayComponent ? (
              React.cloneElement(overlayComponent, {
                className: "spotlight-overlay",
              })
            ) : (
              <Grainient className="spotlight-overlay" />
            )}
          </div>
          <div className="grainient-mask grainient-mask-1">
            {overlayComponent ? (
              React.cloneElement(overlayComponent, {
                className: "spotlight-overlay",
              })
            ) : (
              <Grainient className="spotlight-overlay" />
            )}
          </div>
          <div className="grainient-mask grainient-mask-2">
            {overlayComponent ? (
              React.cloneElement(overlayComponent, {
                className: "spotlight-overlay",
              })
            ) : (
              <Grainient className="spotlight-overlay" />
            )}
          </div>
          <div className="composite-bridge-wrapper">
            <div className="grainient-mask grainient-mask-bridge">
              {overlayComponent ? (
                React.cloneElement(overlayComponent, {
                  className: "spotlight-overlay",
                })
              ) : (
                <Grainient className="spotlight-overlay" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Foreground Content */}
      <div className="composite-content-layer">
        {singleOverlay ? (
          <div
            className="composite-pill-content"
            style={{
              width: "calc(100% - var(--right-width) - var(--gap))",
              height: "var(--pill-height)",
              borderRadius: "100px",
            }}
          >
            {pillContent}
          </div>
        ) : (
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
        )}
        <div className="composite-bottom-content">{bottomContent}</div>
        <div className="composite-right-content">{rightContent}</div>
      </div>
    </div>
  );
};

export default CompositeBentoCard;
