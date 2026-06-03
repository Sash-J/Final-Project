import React, { useState } from "react";
import Icon from "../../common/Icon";
import ModalPortal from "../../common/ModalPortal";
import CrewHierarchy from "./CrewHierarchy";
import EquipmentVisualization from "./EquipmentVisualization";
import { useAuth } from "../../../contexts/AuthContext";
import "./ProjectDashboardProduction.css";

const ProjectDashboardProduction = ({ project, onClose }) => {
  const [activeTab, setActiveTab] = useState("hierarchy");
  const { user } = useAuth();
  
  const [lastUpdated, setLastUpdated] = useState({
    date: new Date(),
    user: user ? user.username : 'System'
  });

  const updateLastModified = () => {
    setLastUpdated({
      date: new Date(),
      user: user ? user.username : 'Unknown User'
    });
  };

  return (
    <ModalPortal 
      onClose={onClose}
      size="large"
      className="profile-modal-glass production-glass-override"
    >
      <div className="production-modal-container">
        <div className="modal-header-section">
          <h2>Production Status</h2>
          <p>Manage crew hierarchy and equipment</p>
        </div>

        <div className="integrated-budget-section fade-in" style={{ marginTop: '20px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="production-sub-nav" style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className={`btn-neo ${activeTab === "hierarchy" ? "btn-neo-solid" : ""}`}
                onClick={() => setActiveTab("hierarchy")}
                style={{ gap: '8px' }}
              >
                <Icon name="account_tree" modifiers="md" />
                <span>Crew Hierarchy</span>
              </button>
              <button
                className={`btn-neo ${activeTab === "equipment" ? "btn-neo-solid" : ""}`}
                onClick={() => setActiveTab("equipment")}
                style={{ gap: '8px' }}
              >
                <Icon name="handyman" modifiers="md" />
                <span>Equipment</span>
              </button>
            </div>
            
            {activeTab === "hierarchy" && (
              <div className="org-metadata-nav" style={{ marginLeft: 'auto' }}>
                Last updated: {lastUpdated.date.toLocaleDateString()} {lastUpdated.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} by <strong>{lastUpdated.user}</strong>
              </div>
            )}
          </div>

          <div className="production-tab-content">
            <div key={activeTab} className="tab-content-animator">
              {activeTab === "hierarchy" ? (
                <CrewHierarchy project={project} onUpdateHierarchy={updateLastModified} />
              ) : (
                <EquipmentVisualization />
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ProjectDashboardProduction;
