import React, { useState, useRef } from "react";
import ReactDOM from "react-dom";
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
  style = {},
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [isFlipped, setIsFlipped] = useState(false);
  const wrapperRef = useRef(null);

  const displayTitle = title || text;
  const hasContent = Boolean(displayTitle || description);

  const handleMouseEnter = () => {
    setShowTooltip(true);
  };

  React.useEffect(() => {
    let animationFrameId;

    const updatePosition = () => {
      if (wrapperRef.current && showTooltip && hasContent) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const flip = rect.top < 70;
        setIsFlipped(flip);
        setCoords({
          top: flip ? rect.bottom + 8 : rect.top - 8,
          left: rect.left + rect.width / 2,
        });
        animationFrameId = requestAnimationFrame(updatePosition);
      }
    };

    if (showTooltip && hasContent) {
      animationFrameId = requestAnimationFrame(updatePosition);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [showTooltip, hasContent]);

  return (
    <div
      ref={wrapperRef}
      className={`hover-tooltip-wrapper ${wrapperClassName}`}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && hasContent && ReactDOM.createPortal(
        <div
          className={`hover-tooltip-positioner ${isFlipped ? "position-flipped" : ""}`}
          style={{ top: coords.top, left: coords.left }}
        >
          <div className={`hover-tooltip-modal ${description ? "hover-tooltip-rich" : ""}`}>
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
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default HoverTooltip;
