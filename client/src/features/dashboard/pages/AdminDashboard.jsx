import React, { useState, useEffect } from "react";
import PageHeader from "../../../components/common/PageHeader";
import { PageContainer, PageContentCard } from "../../../components/common/PageContainer";
import "./AdminDashboard.css";
import ProjectCard from "../../projects/components/ProjectCard";
import "../../../components/Skeleton/Skeleton";
import { ProjectCardSkeleton } from "../../../components/Skeleton/DashboardSkeleton";
import Icon from "../../../components/common/Icon";
import { useAuth } from "../../auth/context/AuthContext";

import { useProjects } from "../../projects/context/ProjectContext";
import { projectService } from "../../../services/projectService";
import ProjectForm from "../../projects/components/ProjectForm";
import ModalPortal from "../../../components/common/ModalPortal";

const AdminDashboard = () => {
  const { user, hasRole, hasPermission } = useAuth();
  const isClient = hasRole("client") && !hasRole(["admin", "manager", "director"]);
  const canManageProjects = hasRole(["admin", "manager", "director"]) || hasPermission("project.create");

  const {
    projects,
    loading: projectsLoading,
    refreshProjects,
    invalidateCache,
  } = useProjects();

  const [editingProject, setEditingProject] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);

  // Load projects from context on mount.
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const handleAdded = () => {
    // Invalidate the cache if a new project is created, forcing a fresh fetch
    invalidateCache();
    refreshProjects(true);
    setEditingProject(null);
    setShowProjectModal(false);
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus =
      currentStatus === "completed" ? "in_progress" : "completed";
    try {
      await projectService.toggleProjectStatus(id, newStatus);
      invalidateCache();
      refreshProjects(true);
    } catch (err) {
      alert(err.message || "Failed to update status");
    }
  };

  //archived project filtering
  const ongoingProjects = projects.filter((p) => p.status !== "completed");
  const archivedProjects = projects.filter((p) => p.status === "completed");

  return (
    <PageContainer
      id={isClient ? "client-dashboard" : "admin-dashboard"}
      className={isClient ? "client-dashboard-section" : ""}
    >
      <PageHeader
        category={isClient ? "Client Portal" : "Administration"}
        title={isClient ? `Dashboard${user?.username ? `, ${user.username}` : ""}` : "Dashboard"}
        description={
          isClient
            ? "Overview of your assigned productions and project delivery status."
            : "Centralized project management and system configuration."
        }
      >
        {canManageProjects ? (
          <button
            className="sui-btn sui-btn-save new-project-btn"
            onClick={() => {
              setEditingProject(null);
              setShowProjectModal(true);
            }}
          >
            <Icon name="add" modifiers="sm" />
            <span>New Project</span>
          </button>
        ) : isClient ? (
          <div className="client-header-badges">
            <div className="client-status-pill">
              <span className="client-status-dot"></span>
              <span className="client-status-text">
                {ongoingProjects.length}{" "}
                {ongoingProjects.length === 1 ? "Active Production" : "Active Productions"}
              </span>
            </div>
            <button
              className="client-refresh-btn"
              onClick={() => refreshProjects(true)}
              title="Refresh dashboard"
            >
              <Icon name="refresh" modifiers="sm" />
            </button>
          </div>
        ) : null}
      </PageHeader>

      <PageContentCard className="admin-content-animated">
        {ongoingProjects.length > 0 || projectsLoading ? (
          <div className="project-tiles-grid">
            {projectsLoading
              ? [...Array(6)].map((_, i) => <ProjectCardSkeleton key={i} />)
              : ongoingProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onToggleStatus={canManageProjects ? handleToggleStatus : undefined}
                />
              ))}
          </div>
        ) : (
          <div className="no-projects-message">
            <Icon name="folder_off" modifiers="lg" />
            <p>
              {isClient
                ? "No active productions assigned to your account."
                : "No active productions found. Start by creating a new one."}
            </p>
          </div>
        )}

        {archivedProjects.length > 0 && (
          <div className="archived-section">
            <div className="archived-header">
              <Icon name="archive" modifiers="md" />
              <h3>Completed Projects</h3>
              <span className="archived-count">
                {archivedProjects.length}{" "}
                {archivedProjects.length === 1 ? "project" : "projects"}
              </span>
            </div>
            <div className="project-tiles-grid archived-grid">
              {archivedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  variant="compact"
                  onToggleStatus={canManageProjects ? handleToggleStatus : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </PageContentCard>

      {/* Project Add/Edit Modal */}
      {canManageProjects && showProjectModal && (
        <ModalPortal
          onClose={() => {
            setEditingProject(null);
            setShowProjectModal(false);
          }}
          className="global-modal-glass"
        >
          <ProjectForm
            onAdded={handleAdded}
            editingProject={editingProject}
            projects={projects}
            onCancelEdit={() => {
              setEditingProject(null);
              setShowProjectModal(false);
            }}
          />
        </ModalPortal>
      )}
    </PageContainer>
  );
};

export default AdminDashboard;
