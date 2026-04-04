import React, { useState, useEffect, useRef } from "react";
import "./GlassDropdown.css";

/**
 * Reusable glassmorphism-styled dropdown component.
 * Supports single and multi-select.
 *
 * @param {Object} props
 * @param {string} props.label - Optional label above the dropdown
 * @param {Array} props.options - Array of { value, label }
 * @param {any} props.value - Selected value(s)
 * @param {Function} props.onChange - Selection callback
 * @param {boolean} props.multiple - Enable multi-select
 * @param {string} props.placeholder - Default trigger text
 * @param {string} props.className - Custom outer class
 */
const GlassDropdown = ({
  label,
  options = [],
  value,
  onChange,
  multiple = false,
  placeholder = "Select...",
  className = "",
  modifiers = "",
  style = {},
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => setIsOpen(!isOpen);

  const handleOptionClick = (optionValue) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const isSelected = currentValues.includes(optionValue);
      const nextValues = isSelected
        ? currentValues.filter((v) => v !== optionValue)
        : [...currentValues, optionValue];
      onChange(nextValues);
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  // Determine trigger text
  let triggerText = placeholder;
  if (multiple) {
    const count = Array.isArray(value) ? value.length : 0;
    if (count > 0) {
      triggerText = `${count} selected`;
    }
  } else if (value !== "" && value !== undefined && value !== null) {
    const selectedOpt = options.find((o) => String(o.value) === String(value));
    if (selectedOpt) triggerText = selectedOpt.label;
  }

  // Combine standard class with modifiers
  const containerClass = `glass-dropdown-container ${modifiers} ${className}`.trim();

  return (
    <div className={containerClass} ref={dropdownRef} style={style}>
      {label && <label className="glass-dropdown-label">{label}</label>}
      
      <div 
        className={`glass-dropdown-trigger ${isOpen ? "active" : ""}`} 
        onClick={handleToggle}
      >
        <span className="trigger-text">{triggerText}</span>
        <span className={`trigger-arrow ${isOpen ? "up" : ""}`}>▼</span>
      </div>

      {isOpen && (
        <div className="glass-dropdown-menu sui-fade-in">
          {options.length === 0 ? (
            <div className="glass-dropdown-no-options">No options available</div>
          ) : (
            options.map((opt) => {
              const isSelected = multiple
                ? (Array.isArray(value) && value.includes(opt.value))
                : String(value) === String(opt.value);

              return (
                <div
                  key={opt.value}
                  className={`glass-dropdown-item ${isSelected ? "selected" : ""}`}
                  onClick={() => handleOptionClick(opt.value)}
                >
                  {multiple && (
                    <div className={`glass-checkbox ${isSelected ? "checked" : ""}`}>
                      {isSelected && <span className="check-mark">✓</span>}
                    </div>
                  )}
                  <span className="item-label">{opt.label}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default GlassDropdown;
