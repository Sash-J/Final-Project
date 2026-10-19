import React from "react";
import "./PageHeader.css";

const AsteriskIcon = () => (
  <svg
    className="page-header-asterisk-icon"
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="currentColor"
    aria-hidden="true"
  >
    <rect x="10.6" y="3" width="2.8" height="18" rx="1.4" />
    <rect x="10.6" y="3" width="2.8" height="18" rx="1.4" transform="rotate(45 12 12)" />
    <rect x="10.6" y="3" width="2.8" height="18" rx="1.4" transform="rotate(90 12 12)" />
    <rect x="10.6" y="3" width="2.8" height="18" rx="1.4" transform="rotate(135 12 12)" />
  </svg>
);

const DiagonalArrowIcon = () => (
  <svg
    className="page-header-arrow-icon"
    viewBox="0 0 24 24"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="7" y1="7" x2="17" y2="17" />
    <polyline points="8 17 17 17 17 8" />
  </svg>
);

const PageHeader = ({
  title,
  category,
  eyebrow,
  description,
  children,
  className = "",
  showBadge = true,
  badgeIcon,
}) => {
  const explicitEyebrow = eyebrow || category;
  let displayEyebrow = explicitEyebrow;
  let displayTitle = title;

  if (!displayEyebrow && title && typeof title === "string") {
    const parts = title.trim().split(/\s+/);
    if (parts.length > 1) {
      displayTitle = parts[parts.length - 1];
      displayEyebrow = parts.slice(0, parts.length - 1).join(" ");
    } else {
      displayEyebrow = "";
      displayTitle = title;
    }
  }

  return (
    <div className={`page-header ${className}`}>
      <div className="page-header-title-group">
        {displayEyebrow && (
          <span className="page-header-eyebrow">{displayEyebrow}</span>
        )}
        <div className="page-header-main-row">
          <h1 className="page-header-title">{displayTitle}</h1>
          {showBadge && (
            <div className="page-header-badge-group">
              <div className="page-header-asterisk-badge">
                {badgeIcon || <AsteriskIcon />}
              </div>
              <div className="page-header-arrow-badge">
                <DiagonalArrowIcon />
              </div>
            </div>
          )}
        </div>
        {description && <p className="page-header-desc">{description}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  );
};

export default PageHeader;
