import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import "./HoverTooltip.css";

const HoverTooltip = ({
  text,
  title,
  description,
  icon,
  iconClassName = "",
  children,
  wrapperClassName = "",
  style,
}) => {
  const [tooltipData, setTooltipData] = useState(null);
  const wrapperRef = useRef(null);

  const displayTitle = title || text;
  const hasContent = Boolean(displayTitle || description);
  const isOpen = Boolean(tooltipData && hasContent);

  const calculatePosition = useCallback(() => {
    if (!wrapperRef.current) return null;
    const rect = wrapperRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;

    const isFlipped = rect.top < 70;
    return {
      isFlipped,
      top: Math.round(isFlipped ? rect.bottom + 8 : rect.top - 8),
      left: Math.round(rect.left + rect.width / 2),
    };
  }, []);

  const handleMouseEnter = () => {
    if (hasContent) {
      const pos = calculatePosition();
      if (pos) {
        setTooltipData(pos);
      }
    }
  };

  const handleMouseLeave = () => {
    setTooltipData(null);
  };

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const pos = calculatePosition();
      if (!pos) return;

      setTooltipData((prev) => {
        if (
          prev &&
          prev.isFlipped === pos.isFlipped &&
          Math.abs(prev.top - pos.top) < 0.5 &&
          Math.abs(prev.left - pos.left) < 0.5
        ) {
          return prev;
        }
        return pos;
      });
    };

    window.addEventListener("scroll", updatePosition, { passive: true, capture: true });
    window.addEventListener("resize", updatePosition, { passive: true });

    return () => {
      window.removeEventListener("scroll", updatePosition, { capture: true });
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, calculatePosition]);

  return (
    <div
      ref={wrapperRef}
      className={`hover-tooltip-wrapper ${wrapperClassName}`.trim()}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isOpen &&
        createPortal(
          <div
            role="tooltip"
            className={`hover-tooltip-modal ${tooltipData.isFlipped ? "position-flipped" : ""} ${description ? "hover-tooltip-rich" : ""}`.trim()}
            style={{ top: `${tooltipData.top}px`, left: `${tooltipData.left}px` }}
          >
            {icon && (
              <Icon
                name={icon}
                modifiers="xs"
                className={`hover-tooltip-icon ${iconClassName}`.trim()}
              />
            )}
            {description ? (
              <div className="hover-tooltip-content">
                {displayTitle && <div className="hover-tooltip-title">{displayTitle}</div>}
                <div className="hover-tooltip-desc">{description}</div>
              </div>
            ) : (
              <div className="hover-tooltip-text">{displayTitle}</div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

export default memo(HoverTooltip);
