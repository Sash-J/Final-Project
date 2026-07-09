import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import Icon from "./Icon";
import "./HoverTooltip.css";

const HoverTooltip = ({ text, icon, children, wrapperClassName = "", style = {} }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef(null);

  const handleMouseEnter = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
    setShowTooltip(true);
  };

  return (
    <div
      ref={wrapperRef}
      className={`hover-tooltip-wrapper ${wrapperClassName}`}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && ReactDOM.createPortal(
        <div 
          className="hover-tooltip-positioner" 
          style={{ top: coords.top, left: coords.left }}
        >
          <div className="hover-tooltip-modal">
            {icon && <Icon name={icon} modifiers="xs" className="hover-tooltip-icon" />}
            <div className="hover-tooltip-text">{text}</div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default HoverTooltip;
