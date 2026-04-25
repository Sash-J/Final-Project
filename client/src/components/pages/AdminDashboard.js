import React, { useState, useEffect } from "react";
import PageHeader from "../common/PageHeader";
import "./AdminDashboard.css";
import ProjectCard from "./ProjectCard";
import "../ui/Skeleton.css";
import { ProjectCardSkeleton } from "../ui/DashboardSkeleton";
import { useModal } from "../../contexts/ModalContext";
import Icon from "../common/Icon";

import { useProjects } from "../../contexts/ProjectContext";
import { API } from "../../config";
import ProjectForm from "./ProjectForm";
import ModalPortal from "../common/ModalPortal";

const AdminDashboard = () => {
  const {
    projects,
    loading: projectsLoading,
    refreshProjects,
    invalidateCache,
  } = useProjects();

  const [editingProject, setEditingProject] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);

  const { showConfirm } = useModal();

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

  const handleDelete = async (id) => {
    const ok = await showConfirm(
      "Are you sure you want to delete this project? All associated data will be permanently removed.",
    );
    if (!ok) return;
    try {
      const res = await fetch(`${API}/api/projects/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        invalidateCache();
        refreshProjects(true);
      } else {
        const data = await res.json();
        alert(`${data.error || "Failed to delete"}`);
      }
    } catch (err) {
      alert(`${err.message}`);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus =
      currentStatus === "completed" ? "in_progress" : "completed";
    try {
      const res = await fetch(`${API}/api/projects/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
        credentials: "include",
      });
      if (res.ok) {
        invalidateCache();
        refreshProjects(true);
      } else {
        const data = await res.json();
        alert(`${data.error || "Failed to update status"}`);
      }
    } catch (err) {
      alert(`${err.message}`);
    }
  };

  //archived project filtering
  const ongoingProjects = projects.filter((p) => p.status !== "completed");
  const archivedProjects = projects.filter((p) => p.status === "completed");

  return (
    <section id="admin-dashboard">
      <PageHeader
        title="Admin Dashboard"
        description="Centralized project management and system configuration."
      >
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
      </PageHeader>

      <div className="admin-content-animated">
        {ongoingProjects.length > 0 || projectsLoading ? (
          <div className="project-tiles-grid">
            {projectsLoading
              ? [...Array(6)].map((_, i) => <ProjectCardSkeleton key={i} />)
              : ongoingProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onEdit={(p) => {
                      setEditingProject(p);
                      setShowProjectModal(true);
                    }}
                    onDelete={handleDelete}
                    onToggleStatus={handleToggleStatus}
                  />
                ))}
          </div>
        ) : (
          <div className="no-projects-message">
            <Icon name="folder_off" modifiers="lg" />
            <p>No active productions found. Start by creating a new one.</p>
          </div>
        )}

        {archivedProjects.length > 0 && (
          <div className="archived-section">
            <div className="archived-header">
              <Icon name="archive" modifiers="md" />
              <h3>Archived Projects</h3>
              <span className="archived-count">
                {archivedProjects.length} projects
              </span>
            </div>
            <div className="project-tiles-grid archived-grid">
              {archivedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  variant="compact"
                  onEdit={(p) => {
                    setEditingProject(p);
                    setShowProjectModal(true);
                  }}
                  onDelete={handleDelete}
                  onToggleStatus={handleToggleStatus}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Project Add/Edit Modal */}
      {showProjectModal && (
        <ModalPortal
          onClose={() => {
            setEditingProject(null);
            setShowProjectModal(false);
          }}
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
    </section>
  );
};

export default AdminDashboard;
