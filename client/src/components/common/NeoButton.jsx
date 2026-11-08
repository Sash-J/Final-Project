import React, { forwardRef } from "react";
import Icon from "./Icon";
import HoverTooltip from "./HoverTooltip";
import "./NeoButton.css";

/**
 * NeoButton - Production Button Component conforming to 6 UX & Accessibility Rules:
 * Rule 1: 44px min tap target height
 * Rule 2: Descriptive action verbs
 * Rule 3: Visual hierarchy (solid primary vs ghost cancel)
 * Rule 4: Zero-layout-shift loading spinner + double-click protection
 * Rule 5: Keyboard focus-visible ring
 * Rule 6: Disabled reason tooltip
 */
const NeoButton = forwardRef(
  (
    {
      children,
      variant = "solid",
      loading = false,
      disabled = false,
      disabledReason = "",
      icon = null,
      iconPosition = "left",
      type = "button",
      fullWidth = false,
      onClick,
      className = "",
      ...restProps
    },
    ref
  ) => {
    const isActuallyDisabled = disabled || loading;

    // Determine variant classes
    let variantClass = "btn-neo btn-neo-solid";
    if (variant === "cancel" || variant === "ghost" || variant === "secondary") {
      variantClass = "btn-neo-cancel";
    } else if (variant === "danger") {
      variantClass = "btn-neo-cancel variant-danger";
    } else if (variant === "neutral") {
      variantClass = "btn-neo";
    }

    const buttonClasses = [
      variantClass,
      loading ? "is-loading" : "",
      fullWidth ? "btn-full-width" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const handleClick = (e) => {
      if (isActuallyDisabled) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    };

    const renderIcon = () => {
      if (!icon) return null;
      if (typeof icon === "string") {
        return <Icon name={icon} modifiers="sm" />;
      }
      return icon;
    };

    const buttonElement = (
      <button
        ref={ref}
        type={type}
        className={buttonClasses}
        disabled={isActuallyDisabled}
        aria-busy={loading}
        onClick={handleClick}
        {...restProps}
      >
        {icon && iconPosition === "left" && (
          <span className="neo-button-icon icon-left">{renderIcon()}</span>
        )}
        <span className="neo-button-label">{children}</span>
        {icon && iconPosition === "right" && (
          <span className="neo-button-icon icon-right">{renderIcon()}</span>
        )}
      </button>
    );

    // Rule 6: If disabled with an explanation, wrap in tooltip
    if (disabled && disabledReason && !loading) {
      return (
        <HoverTooltip
          text={disabledReason}
          wrapperClassName={`neo-button-wrapper ${fullWidth ? "is-full-width" : ""}`}
        >
          {buttonElement}
        </HoverTooltip>
      );
    }

    if (fullWidth) {
      return <div className="neo-button-wrapper is-full-width">{buttonElement}</div>;
    }

    return buttonElement;
  }
);

NeoButton.displayName = "NeoButton";

export default NeoButton;

