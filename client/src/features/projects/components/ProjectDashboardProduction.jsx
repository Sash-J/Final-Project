import { useState } from "react";
import Icon from "../../../components/common/Icon";
import ModalPortal from "../../../components/common/ModalPortal";
import { useAuth } from "../../auth/context/AuthContext";
import CrewHierarchy from "./CrewHierarchy";
import EquipmentVisualization from "./EquipmentVisualization";
import "./ProjectDashboardProduction.css";

const ProjectDashboardProduction = ({
  project,
  onClose,
  viewMode = "hierarchy",
}) => {
  const { user, hasPermission, hasRole } = useAuth();

  const isClient = hasRole("client");
  const canEditHierarchy =
    !isClient &&
    hasPermission([
      "hierarchy.node.add",
      "hierarchy.node.edit",
      "hierarchy.node.delete",
      "hierarchy.node.drag",
      "hierarchy.delete",
      "Add child node",
      "Edit node",
      "Delete Node",
      "Node draggable",
      "production.edit",
    ]);

  const [lastUpdated, setLastUpdated] = useState({
    date: new Date(),
    user: user ? user.username : "System",
  });
  const [saveStatus, setSaveStatus] = useState(""); // '', 'saving', 'saved'

  const updateLastModified = () => {
    setLastUpdated({
      date: new Date(),
      user: user ? user.username : "Unknown User",
    });
  };

  return (
    <ModalPortal
      onClose={onClose}
      size="large"
      className="global-modal-glass production-glass-override"
    >
      <div className="production-modal-container">
        <div className="modal-header-section">
          <div className="timeline-header-top-row">
            <div className="timeline-header-title-group">
              <div>
                <h2>
                  {viewMode === "hierarchy" ? "Crew Hierarchy" : "Equipment"}
                </h2>
                <p>
                  {viewMode === "hierarchy"
                    ? canEditHierarchy
                      ? "Manage project crew structure and roles"
                      : "View project crew structure and roles"
                    : "Manage production equipment and inventory"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="integrated-budget-section production-integrated-budget fade-in">
          <div className="production-sub-nav">
            {viewMode === "hierarchy" && (
              <div className="org-metadata-container">
                {saveStatus && (
                  <div
                    className={`org-metadata-nav save-status-indicator ${saveStatus !== "hiding" ? "fade-in" : ""} ${saveStatus}`}
                  >
                    <Icon
                      name={saveStatus === "saving" ? "sync" : "check_circle"}
                      modifiers={saveStatus === "saving" ? "spin sm" : "sm"}
                    />
                    {saveStatus === "saving" ? "Saving..." : "Saved"}
                  </div>
                )}
                <div className="org-metadata-nav">
                  Last updated: {lastUpdated.date.toLocaleDateString()}{" "}
                  {lastUpdated.date.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  by <strong>{lastUpdated.user}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="production-tab-content">
            <div key={viewMode} className="tab-content-animator">
              {viewMode === "hierarchy" ? (
                <CrewHierarchy
                  project={project}
                  onUpdateHierarchy={updateLastModified}
                  onSaveStatusChange={setSaveStatus}
                />
              ) : (
                <EquipmentVisualization
                  project={project}
                  onUpdateEquipment={updateLastModified}
                  onSaveStatusChange={setSaveStatus}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ProjectDashboardProduction;
