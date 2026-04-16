import React from "react";
import "./Icon.css";

/**
 * Reusable Material Symbol icon component with a modular modifier system.
 * Refered from chatgpt and OpenAI
 *
 * @param {Object} props
 * @param {string} props.name - The name of the Material Symbol (e.g., 'delete', 'download')
 * @param {string} props.modifiers - Space-separated modifier strings (e.g., 'sm bold')
 * @param {Object} props.style - Inline style overrides (e.g., for specific colors)
 * @param {string} props.className - Additional custom classes from parent
 */
const Icon = ({ name, modifiers = "", style = {}, className = "" }) => {
  const fullClassName =
    `icon-root material-symbols-outlined ${modifiers} ${className}`.trim();

  return (
    <span className={fullClassName} style={style}>
      {name}
    </span>
  );
};

export default Icon;
