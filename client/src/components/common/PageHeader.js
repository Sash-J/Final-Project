import React from "react";
import "./PageHeader.css";

const PageHeader = ({ title, description, children, className = "" }) => {
  return (
    <div className={`page-header ${className}`}>
      <h2>{title}</h2>
      {description && <p className="page-header-desc">{description}</p>}
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  );
};

export default PageHeader;
