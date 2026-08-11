import React, { useEffect, useRef } from "react";
import "./LiquidGlassCard.css";

const LiquidGlassCard = ({ children, className = "", variant = "dark", ...props }) => {
  const cardRef = useRef(null);

  // Removed parallax movement per user request
  const glassClass = variant === "dark" ? "liquid-glass-dark" : "liquid-glass-light";

  return (
    <div
      ref={cardRef}
      className={`liquid-glass-container ${glassClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default LiquidGlassCard;
