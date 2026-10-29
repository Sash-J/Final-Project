import React from "react";
import Icon from "./Icon";
import HoverTooltip from "./HoverTooltip";
import "./ViewToggle.css";

/**
 * Reusable segmented view/size/density toggle switcher.
 * Provides accessible icon/label buttons with tooltips, active states,
 * and seamless light/dark theme support.
 *
 * @param {Object} props
 * @param {Array<{value: string, icon?: string, label?: string, text?: string, disabled?: boolean, ariaLabel?: string}>} props.options
 * @param {string} props.value - Currently selected value
 * @param {(value: string) => void} props.onChange - Selection change handler
 * @param {string} [props.className] - Additional wrapper CSS classes
 * @param {string} [props.ariaLabel] - Accessible label for the control group
 * @param {"sm" | "md"} [props.size="sm"] - Size variant
 * @param {boolean} [props.disabled=false] - Whether the entire group is disabled
 */
const ViewToggle = ({
  options = [],
  value,
  onChange,
  className = "",
  ariaLabel = "View switcher",
  size = "sm",
  disabled = false,
}) => {
  const containerClassName = `sui-view-toggle view-toggle-root size-${size} ${className}`.trim();

  return (
    <div
      className={containerClassName}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const isOptionDisabled = disabled || Boolean(option.disabled);
        const tooltipText = option.label || option.text;
        const accessibleLabel =
          option.ariaLabel || option.label || option.text || String(option.value);

        const buttonElement = (
          <button
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={accessibleLabel}
            disabled={isOptionDisabled}
            tabIndex={isSelected ? 0 : -1}
            className={`sui-view-toggle-btn view-toggle-btn ${isSelected ? "active" : ""}`.trim()}
            onClick={() => {
              if (!isOptionDisabled && onChange) {
                onChange(option.value);
              }
            }}
          >
            {option.icon && (
              <Icon name={option.icon} modifiers={size === "md" ? "" : "sm"} />
            )}
            {option.showLabel && option.label && (
              <span className="view-toggle-btn-label">{option.label}</span>
            )}
          </button>
        );

        if (tooltipText && !isOptionDisabled) {
          return (
            <HoverTooltip key={option.value} text={tooltipText}>
              {buttonElement}
            </HoverTooltip>
          );
        }

        return <React.Fragment key={option.value}>{buttonElement}</React.Fragment>;
      })}
    </div>
  );
};

export default ViewToggle;
