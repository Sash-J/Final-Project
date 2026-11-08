import React, { useState, useRef, memo, forwardRef } from "react";
import Icon from "./Icon";
import { sanitizeRealtime, sanitizeOnBlur } from "../../utils/sanitizer";
import "./FloatingInput.css";

const FloatingInput = forwardRef(
  (
    {
      label,
      value,
      defaultValue,
      hasValue: customHasValue,
      onChange,
      onFocus,
      onBlur,
      placeholder = "",
      type = "text",
      as = "input",
      prefix,
      suffix,
      icon,
      required = false,
      disabled = false,
      error = "",
      className = "",
      children,
      rows = 3,
      sanitize = true,
      ...restProps
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const internalInputRef = useRef(null);
    const inputRef = ref || internalInputRef;

    // Determine if input has a value (controlled, custom, or uncontrolled)
    const isControlled = value !== undefined;
    const hasValue =
      customHasValue !== undefined
        ? Boolean(customHasValue)
        : isControlled
        ? Boolean(value !== "" && value !== null && value !== undefined)
        : Boolean(inputRef.current?.value);

    const isDateField =
      type === "date" ||
      type === "time" ||
      type === "datetime-local" ||
      type === "month" ||
      type === "week";

    const isFloating = isFocused || hasValue || isDateField;
    const isTextarea = as === "textarea";
    const isSelect = as === "select";
    const isCustomControl = Boolean(children && !isSelect);

    const handleFocus = (e) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleChange = (e) => {
      if (sanitize && e.target && typeof e.target.value === "string") {
        const raw = e.target.value;
        const cleaned = sanitizeRealtime(raw, type);
        if (cleaned !== raw) {
          e.target.value = cleaned;
        }
      }
      onChange?.(e);
    };

    const handleBlur = (e) => {
      setIsFocused(false);
      if (sanitize && e.target && typeof e.target.value === "string") {
        const raw = e.target.value;
        const cleaned = sanitizeOnBlur(raw, type);
        if (cleaned !== raw) {
          e.target.value = cleaned;
          onChange?.(e);
        }
      }
      onBlur?.(e);
    };

    const fieldClasses = [
      "floating-field",
      isFloating ? "is-floating" : "",
      isFocused ? "is-focused" : "",
      hasValue ? "has-value" : "",
      label ? "has-label" : "no-label",
      prefix ? "has-prefix" : "",
      suffix || icon ? "has-suffix" : "",
      isTextarea ? "is-textarea" : "",
      isSelect ? "is-select" : "",
      isCustomControl ? "is-custom-control" : "",
      required ? "is-required" : "",
      disabled ? "is-disabled" : "",
      restProps.readOnly ? "is-readonly" : "",
      error ? "has-error" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={fieldClasses}>
        <div className="floating-field-control-wrap">
          {prefix && <span className="floating-prefix">{prefix}</span>}

          {isCustomControl ? (
            <div
              className="floating-custom-control"
              onFocus={handleFocus}
              onBlur={handleBlur}
            >
              {children}
            </div>
          ) : isTextarea ? (
            <textarea
              ref={inputRef}
              className="floating-input floating-textarea"
              value={value}
              defaultValue={defaultValue}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={isFocused ? placeholder : ""}
              disabled={disabled}
              required={required}
              rows={rows}
              {...restProps}
            />
          ) : isSelect ? (
            <>
              <select
                ref={inputRef}
                className="floating-input floating-select"
                value={value}
                defaultValue={defaultValue}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                disabled={disabled}
                required={required}
                {...restProps}
              >
                {children}
              </select>
              <span className="floating-select-arrow" aria-hidden="true">
                <Icon name="arrow_drop_down" modifiers="sm" />
              </span>
            </>
          ) : (
            <input
              ref={inputRef}
              type={type}
              className="floating-input"
              value={value}
              defaultValue={defaultValue}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={isFocused ? placeholder : ""}
              disabled={disabled}
              required={required}
              {...restProps}
            />
          )}

          {label && (
            <label
              className="floating-label"
              onClick={() => inputRef.current?.focus()}
            >
              {label}
              {required && <span className="floating-label-required">*</span>}
            </label>
          )}

          {icon && (
            <span className="floating-suffix">
              <Icon name={icon} modifiers="xs" />
            </span>
          )}
          {suffix && !icon && <span className="floating-suffix">{suffix}</span>}
        </div>

        {error && <span className="floating-error-msg">{error}</span>}
      </div>
    );
  }
);

FloatingInput.displayName = "FloatingInput";

export default memo(FloatingInput);
