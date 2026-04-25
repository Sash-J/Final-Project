import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./GlassDropdown.css";

/**
 *Reusable glassmorphism-styled dropdown component.
 *Supports single and multi-select.
 *help from chatGPT
 * @param {Object} props
 * @param {string} props.label
 * @param {Array} props.options
 * @param {any} props.value
 * @param {Function} props.onChange
 * @param {boolean} props.multiple
 * @param {string} props.placeholder
 * @param {string} props.className
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
  const menuRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  const updatePosition = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
        zIndex: 10001,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && dropdownRef.current.contains(event.target))
        return;
      if (menuRef.current && menuRef.current.contains(event.target)) return;
      setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

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

  const containerClass =
    `glass-dropdown-container ${modifiers} ${className}`.trim();

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

      {isOpen &&
        createPortal(
          <div
            className="glass-dropdown-menu sui-fade-in"
            style={dropdownStyle}
            ref={menuRef}
          >
            {options.length === 0 ? (
              <div className="glass-dropdown-no-options">
                No options available
              </div>
            ) : (
              options.map((opt) => {
                const isSelected = multiple
                  ? Array.isArray(value) && value.includes(opt.value)
                  : String(value) === String(opt.value);

                return (
                  <div
                    key={opt.value}
                    className={`glass-dropdown-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleOptionClick(opt.value)}
                  >
                    {multiple && (
                      <div
                        className={`glass-checkbox ${isSelected ? "checked" : ""}`}
                      >
                        {isSelected && <span className="check-mark">✓</span>}
                      </div>
                    )}
                    <span className="item-label">{opt.label}</span>
                  </div>
                );
              })
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default GlassDropdown;
