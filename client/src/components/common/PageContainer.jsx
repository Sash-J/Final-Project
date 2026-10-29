import React from "react";
import "./PageContainer.css";

/**
 * PageContainer provides the standardized outer 1700px grid boundary,
 * auto-centering, and responsive padding for all portal and dashboard pages.
 */
export const PageContainer = ({
  children,
  className = "",
  id,
  as: Component = "section",
  ...props
}) => {
  return (
    <Component
      id={id}
      className={`page-container ${className}`.trim()}
      {...props}
    >
      {children}
    </Component>
  );
};

/**
 * PageContentCard provides the signature glassmorphic elevated surface
 * (32px radius, blur, subtle border, shadow) used across all dashboards.
 */
export const PageContentCard = ({
  children,
  className = "",
  id,
  as: Component = "div",
  ...props
}) => {
  return (
    <Component
      id={id}
      className={`page-content-card admin-content-animated ${className}`.trim()}
      {...props}
    >
      {children}
    </Component>
  );
};

export default PageContainer;
