import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, memo } from "react";
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
  const modalRef = useRef(null);

  const displayTitle = title || text;
  const hasContent = Boolean(displayTitle || description);
  const isOpen = Boolean(tooltipData && hasContent);

  useEffect(() => {
    if (!hasContent) {
      setTooltipData(null);
    }
  }, [hasContent]);

  const calculatePosition = useCallback(() => {
    if (!wrapperRef.current) return null;
    const rect = wrapperRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;

    const isFlipped = rect.top < 70;
    return {
      isFlipped,
      top: Math.round(isFlipped ? rect.bottom + 8 : rect.top - 8),
      left: Math.round(rect.left + rect.width / 2),
      shiftX: 0,
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

  useLayoutEffect(() => {
    if (!isOpen || !modalRef.current || !tooltipData) return;

    const halfWidth = modalRef.current.offsetWidth / 2;
    if (halfWidth === 0) return;

    const edgePadding = 12;
    const minCenter = edgePadding + halfWidth;
    const maxCenter = Math.max(minCenter, window.innerWidth - edgePadding - halfWidth);
    const clampedCenter = Math.min(Math.max(tooltipData.left, minCenter), maxCenter);
    const nextShiftX = Math.round(clampedCenter - tooltipData.left);

    if (nextShiftX !== (tooltipData.shiftX || 0)) {
      setTooltipData((prev) => (prev ? { ...prev, shiftX: nextShiftX } : prev));
    }
  }, [isOpen, tooltipData, displayTitle, description]);

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
        return { ...pos, shiftX: prev?.shiftX || 0 };
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
            ref={modalRef}
            role="tooltip"
            className={`hover-tooltip-modal ${tooltipData.isFlipped ? "position-flipped" : ""} ${description ? "hover-tooltip-rich" : ""}`.trim()}
            style={{
              top: `${tooltipData.top}px`,
              left: `${tooltipData.left}px`,
              "--htt-shift-x": `${tooltipData.shiftX || 0}px`,
            }}
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
