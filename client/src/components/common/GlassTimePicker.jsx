import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import Icon from "./Icon";
import "./GlassTimePicker.css";

const GlassTimePicker = ({
  value,
  onChange,
  className = "",
  style = {},
  id,
  iconOnly = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const wrapperRef = useRef(null);
  const modalRef = useRef(null);
  const pathRef = useRef(null);
  const svgRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 300);
  };

  const [isDragging, setIsDragging] = useState(false);

  // Calculate initial progress based on 24h "HH:MM" string
  const getProgressFromValue = (timeStr) => {
    if (!timeStr) return 0.5; // default 12:00 PM
    const [h, m] = timeStr.split(":");
    const minutes = parseInt(h, 10) * 60 + parseInt(m, 10);
    return minutes / 1440;
  };

  const [progress, setProgress] = useState(getProgressFromValue(value));

  // Sync state if prop changes externally
  useEffect(() => {
    if (!isDragging) {
      setProgress(getProgressFromValue(value));
    }
  }, [value, isDragging]);

  useEffect(() => {
    if (isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        left: rect.left - 240 / 2 + 21, // Center the modal roughly
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        isOpen &&
        modalRef.current &&
        !modalRef.current.contains(e.target) &&
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Derived state for the thumb UI
  const getThumbPos = (prog) => {
    if (!pathRef.current || !svgRef.current) return { x: 50, y: 50 };
    const pathLength = pathRef.current.getTotalLength();
    const point = pathRef.current.getPointAtLength(prog * pathLength);
    const svgRect = svgRef.current.viewBox.baseVal;
    return {
      x: (point.x / svgRect.width) * 100,
      y: (point.y / svgRect.height) * 100,
    };
  };

  const [thumbPos, setThumbPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    if (isOpen) {
      // Small timeout to ensure path is rendered and measureable
      setTimeout(() => setThumbPos(getThumbPos(progress)), 10);
    }
  }, [progress, isOpen]);

  const updateProgress = (newProgress) => {
    const clampedProgress = Math.min(Math.max(newProgress, 0), 1);
    
    // Snap to 10-minute intervals
    let totalMinutes = Math.round(clampedProgress * 1440);
    totalMinutes = Math.round(totalMinutes / 10) * 10;
    
    const snappedProgress = totalMinutes / 1440;
    setProgress(snappedProgress);

    // Convert to HH:MM and fire onChange
    let hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 24) hours = 23; // Edge case max
    const formatted = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    onChange(formatted);
  };

  const handlePointerMove = (e) => {
    if (!pathRef.current) return;
    const rect = pathRef.current.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const newProg = pointerX / rect.width;
    updateProgress(newProg);
  };

  const handlePointerDown = (e) => {
    setIsDragging(true);
    handlePointerMove(e);

    const onMove = (moveEvent) => handlePointerMove(moveEvent);
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Format time for the label (e.g. 12:00 PM)
  const getFormattedDisplayTime = (prog) => {
    const totalMinutes = Math.round(prog * 1440);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const isMorning = h < 12 || h === 24;
    const h12 = h % 12 || 12;
    const period = isMorning ? "AM" : "PM";
    return `${h12.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${period}`;
  };

  return (
    <div 
      className="glass-timepicker-wrapper" 
      ref={wrapperRef} 
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {iconOnly ? (
        <div
          className={`neo-input glass-timepicker-icon-only-btn ${className}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Icon name="schedule" modifiers="md" style={{ color: "#fff" }} />
        </div>
      ) : (
        <>
          <Icon
            name="schedule"
            modifiers="md"
            className="glass-timepicker-icon"
            onClick={() => setIsOpen(!isOpen)}
          />
          <input
            id={id}
            type="text"
            readOnly
            value={getFormattedDisplayTime(progress)}
            className={`neo-input ${className}`}
            onClick={() => setIsOpen(!isOpen)}
            style={{ cursor: "pointer" }}
          />
        </>
      )}

      {isOpen &&
        ReactDOM.createPortal(
          <div
            className="glass-timepicker-positioner"
            style={{ top: coords.top, left: coords.left }}
          >
            <div 
              className="glass-timepicker-modal global-modal-glass" 
              ref={modalRef}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="slider-wrapper">
                <div
                  className="slider-thumb"
                  style={{ left: `${thumbPos.x}%`, top: `${thumbPos.y}%` }}
                  onPointerDown={handlePointerDown}
                >
                  <div className="slider-value-container">
                    <span className="slider-value">
                      {getFormattedDisplayTime(progress)}
                    </span>
                  </div>
                </div>
                <svg
                  className="slider-svg"
                  viewBox="0 0 238 36"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  ref={svgRef}
                >
                  <path
                    ref={pathRef}
                    className="slider-svg-path"
                    d="M2 34L7.21879 31.0968C78.5901 -8.60616 165.659 -7.50128 236 34V34"
                    stroke="var(--accent-color, #00c6e6)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    onPointerDown={handlePointerDown}
                  />
                </svg>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default GlassTimePicker;
