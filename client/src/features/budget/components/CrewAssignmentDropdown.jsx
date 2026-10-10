import React, { useMemo } from "react";
import HoverTooltip from "../../../components/common/HoverTooltip";
import "./CrewAssignmentDropdown.css";

const CrewAssignmentDropdown = React.memo(({
  assignedCrew = [],
  projectCrew = [],
  isActive,
  onToggle,
  onAssign,
  isCrewEditing,
  setIsCrewEditing,
  badgeSize = 18,
}) => {
  const renderedDropdownOptions = useMemo(() => {
    if (projectCrew.length === 0) {
      return (
        <div className="no-crew-assigned-warning">
          No crew assigned to project.
        </div>
      );
    }
    return projectCrew.map((c) => {
      const isAssigned = assignedCrew.some(item => item.id === c.id);
      return (
        <div 
          key={c.id} 
          className={`crew-assign-option ${isAssigned ? "selected" : ""}`}
          onClick={() => onAssign(c.id)}
        >
          <div 
            className="option-check clickable-unassign"
            onClick={(e) => {
              if (isAssigned) {
                e.stopPropagation();
                onAssign(c.id);
              }
            }}
          >
            {isAssigned && (
              <>
                <span className="material-symbols-outlined check-icon" style={{ fontSize: "0.9rem" }}>check</span>
                <span className="material-symbols-outlined remove-icon" style={{ fontSize: "0.9rem", display: "none" }}>close</span>
              </>
            )}
          </div>
          <div className="dropdown-crew-avatar">
            {c.profile_image ? (
              <img src={c.profile_image} alt={c.username} className="dropdown-crew-avatar-img" />
            ) : (
              <div className="dropdown-crew-avatar-text">
                {c.full_name ? c.full_name.charAt(0).toUpperCase() : (c.username ? c.username.charAt(0).toUpperCase() : "?")}
              </div>
            )}
          </div>
          <span>{c.full_name || c.username}</span>
        </div>
      );
    });
  }, [projectCrew, assignedCrew, onAssign]);

  return (
    <div className="crew-assign-selector-wrapper">
      <HoverTooltip text="Assign Crew">
        <button 
          type="button"
          className="btn-assign-crew-trigger" 
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {assignedCrew.length > 0 ? (() => {
            const firstCrew = assignedCrew[0];
            const initial = firstCrew.full_name 
              ? firstCrew.full_name.charAt(0).toUpperCase() 
              : (firstCrew.username ? firstCrew.username.charAt(0).toUpperCase() : "?");
            return (
              <div className="crew-avatar-badge" style={{ '--badge-size': `${badgeSize}px` }}>
                {firstCrew.profile_image ? (
                  <img src={firstCrew.profile_image} alt={firstCrew.username} className="crew-avatar-img" />
                ) : (
                  <div className="crew-avatar-text">{initial}</div>
                )}
              </div>
            );
          })() : (
            <span className="material-symbols-outlined">person_add</span>
          )}
        </button>
      </HoverTooltip>
      {isActive && (
        <div className="crew-assign-dropdown glass-sandblasted" onClick={(e) => e.stopPropagation()}>
          <div className="dropdown-title-container">
            <span className="dropdown-title">Assign Crew</span>
            <label className="crew-edit-toggle">
              <input 
                type="checkbox" 
                checked={isCrewEditing} 
                onChange={(e) => setIsCrewEditing(e.target.checked)} 
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">Edit</span>
            </label>
          </div>
          {renderedDropdownOptions}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) return false;
  if (prevProps.isCrewEditing !== nextProps.isCrewEditing) return false;
  if (prevProps.badgeSize !== nextProps.badgeSize) return false;
  if (prevProps.projectCrew !== nextProps.projectCrew) return false;
  
  if (prevProps.assignedCrew.length !== nextProps.assignedCrew.length) return false;
  
  const prevIds = prevProps.assignedCrew.map(c => c.id).sort().join(',');
  const nextIds = nextProps.assignedCrew.map(c => c.id).sort().join(',');
  if (prevIds !== nextIds) return false;
  
  return true;
});

export default CrewAssignmentDropdown;
