import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import Icon from "./Icon";
import "./GlassDatePicker.css";

const GlassDatePicker = ({
  value,
  onChange,
  placeholder = "YYYY-MM-DD",
  required = false,
  className,
  style,
  iconOnly = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(
    value ? new Date(value) : new Date(),
  );
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef(null);
  const modalRef = useRef(null);
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

  // Parse YYYY-MM-DD local dates avoiding timezone shifts
  const getLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split("-");
    return new Date(y, m - 1, d);
  };

  const selectedDate = getLocalDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8, // Just below the input
        left: rect.left,
      });
      // Ensure month displayed matches selected date when opened
      if (value) {
        setCurrentMonth(getLocalDate(value));
      }
    }
  }, [isOpen, value]);

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

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  const handleDateClick = (day) => {
    const formattedMonth = String(currentMonth.getMonth() + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    const dateStr = `${currentMonth.getFullYear()}-${formattedMonth}-${formattedDay}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const renderCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    const days = [];

    // Empty slots for previous month
    for (let i = 0; i < startDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="glass-datepicker-day empty"></div>,
      );
    }

    // Actual days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const isSelected = selectedDate && d.getTime() === selectedDate.getTime();
      const isToday = d.getTime() === today.getTime();

      days.push(
        <div
          key={i}
          className={`glass-datepicker-day ${isSelected ? "selected" : ""} ${isToday && !isSelected ? "today" : ""}`}
          onClick={() => handleDateClick(i)}
        >
          {i}
        </div>,
      );
    }

    return days;
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div 
      className="glass-datepicker-wrapper" 
      ref={wrapperRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="glass-datepicker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: "pointer" }}
      >
        {iconOnly ? (
          <div
            className={`neo-input glass-datepicker-icon-only-btn ${className || ""}`}
          >
            <Icon name="calendar_month" modifiers="md" style={{ color: "#fff" }} />
          </div>
        ) : (
          <>
            <Icon
              name="calendar_month"
              modifiers="md"
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 10,
                display: "flex",
                cursor: "pointer",
                pointerEvents: "auto",
              }}
            />
            <input
              type="text"
              className={`neo-input ${className || ""}`}
              value={value || ""}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/[^\d]/g, "");
                let formattedValue = "";
                if (rawValue.length > 0)
                  formattedValue += rawValue.substring(0, 4);
                if (rawValue.length > 4)
                  formattedValue += "-" + rawValue.substring(4, 6);
                if (rawValue.length > 6)
                  formattedValue += "-" + rawValue.substring(6, 8);
                onChange(formattedValue);
              }}
              placeholder={placeholder}
              required={required}
              style={{ cursor: "text", ...style }}
              onClick={(e) => {
                // Let it bubble, but we can also ensure it opens
              }}
            />
          </>
        )}
      </div>

      {isOpen &&
        ReactDOM.createPortal(
          <div
            className="glass-datepicker-positioner"
            style={{ top: coords.top, left: coords.left }}
          >
            <div 
              className="glass-datepicker-modal global-modal-glass" 
              ref={modalRef}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="glass-datepicker-header">
                <button
                  type="button"
                  className="glass-datepicker-nav-btn"
                  onClick={handlePrevMonth}
                >
                  <Icon name="chevron_left" modifiers="sm" />
                </button>
                <div className="glass-datepicker-month-year">
                  {monthNames[currentMonth.getMonth()]}{" "}
                  {currentMonth.getFullYear()}
                </div>
                <button
                  type="button"
                  className="glass-datepicker-nav-btn"
                  onClick={handleNextMonth}
                >
                  <Icon name="chevron_right" modifiers="sm" />
                </button>
              </div>

              <div className="glass-datepicker-grid">
                {dayNames.map((d) => (
                  <div key={d} className="glass-datepicker-day-name">
                    {d}
                  </div>
                ))}
                {renderCalendarDays()}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default GlassDatePicker;
