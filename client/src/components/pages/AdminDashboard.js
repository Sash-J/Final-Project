import React, { useState, useEffect, useRef } from "react";
import PageHeader from "../common/PageHeader";
import "./AdminDashboard.css";
import SuiTimeline from "./SuiTimeline";
import "../ui/Skeleton.css";
import { useModal } from "../../contexts/ModalContext";
import GlassDropdown from "../common/GlassDropdown";
import ModalPortal from "../common/ModalPortal";
import Icon from "../common/Icon";

import { API } from "../../config";

// ── Reusable status message ───────────────────────────────────────────────────
const StatusMsg = ({ msg }) => {
  if (!msg) return null;
  const isError = msg.startsWith("Error") || msg.startsWith("❌");
  return <p className={`status-msg ${isError ? "error" : "success"}`}>{msg}</p>;
};

// ── Project Management (Add/Edit) ──────────────────────────────────────────
const ProjectForm = ({ onAdded, editingProject, onCancelEdit, projects }) => {
  const [formData, setFormData] = useState({
    project_name: "",
    code_name: "",
    start_date: "",
    end_date: "",
    location: "",
    project_image: "",
    client_ids: [],
    crew_ids: [],
    color: "#00c6e6",
  });

  const [clients, setClients] = useState([]);
  const [crew, setCrew] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = React.useRef(null);
  const colorInputRef = React.useRef(null);

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch(`${API}/api/clients`, {
          credentials: "include",
        });
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch clients:", err);
      }
    };
    const fetchCrew = async () => {
      try {
        const res = await fetch(`${API}/api/crew`, { credentials: "include" });
        const data = await res.json();
        setCrew(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch crew:", err);
      }
    };
    fetchClients();
    fetchCrew();
  }, []);

  useEffect(() => {
    if (editingProject) {
      setFormData({
        project_name: editingProject.project_name || "",
        code_name: editingProject.code_name || "",
        start_date: formatDateForInput(editingProject.start_date),
        end_date: formatDateForInput(editingProject.end_date),
        location: editingProject.location || "",
        project_image: editingProject.project_image || "",
        client_ids: editingProject.client_ids
          ? String(editingProject.client_ids)
              .split(",")
              .filter(Boolean)
              .map(Number)
          : [],
        crew_ids: editingProject.crew_ids
          ? String(editingProject.crew_ids)
              .split(",")
              .filter(Boolean)
              .map(Number)
          : [],
        color: editingProject.color || "#00c6e6",
      });
    } else {
      setFormData({
        project_name: "",
        code_name: "",
        start_date: "",
        end_date: "",
        location: "",
        project_image: "",
        client_ids: [],
        crew_ids: [],
        color: "#00c6e6",
      });
    }
  }, [editingProject]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setMsg("❌ Invalid format. Please upload JPEG, PNG, or WebP.");
      return;
    }

    if (file.size > 200 * 1024) {
      setMsg("❌ File too large. Maximum size is 200KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, project_image: reader.result }));
      setMsg(""); // Clear error if successful
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    const url = editingProject
      ? `${API}/api/projects/${editingProject.id}`
      : `${API}/api/projects`;
    const method = editingProject ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setMsg(`✅ Project ${editingProject ? "updated" : "added"} successfully`);
      onAdded && onAdded();
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="project-modal-overlay">
      <div className="project-modal-glass-card">
        <div className="modal-header-section">
          <h2>
            {editingProject ? "Edit Project Profile" : "Create New Project"}
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.9rem",
              marginTop: "4px",
            }}
          >
            {editingProject
              ? "Update the core details and visual identity of this production."
              : "Set up the foundational details for your new production project."}
          </p>
        </div>

        {/* Real-time Color Conflict Warning */}
        {(() => {
          const conflictingProject = projects?.find(
            (p) =>
              p.color?.toLowerCase() === formData.color?.toLowerCase() &&
              (!editingProject || p.id !== editingProject.id),
          );
          if (conflictingProject) {
            return (
              <div
                className="color-conflict-warning"
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#fca5a5",
                  padding: "10px 15px",
                  borderRadius: "12px",
                  marginBottom: "20px",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  animation: "shake 0.5s cubic-bezier(.36,.07,.19,.97) both",
                }}
              >
                <Icon name="warning" modifiers="sm" />
                <span>
                  <strong>Conflict:</strong> This color is already assigned to{" "}
                  <strong>{conflictingProject.project_name}</strong>. Each
                  production must have a unique identity.
                </span>
              </div>
            );
          }
          return null;
        })()}

        <div className="modal-split-layout">
          <div className="modal-side-panel">
            <div
              className="project-image-upload-panel"
              onClick={() => fileInputRef.current?.click()}
            >
              {formData.project_image ? (
                <img
                  src={formData.project_image}
                  className="project-image-preview"
                  alt="Project Logo"
                />
              ) : (
                <div className="image-upload-placeholder">
                  <Icon
                    name="add_a_photo"
                    modifiers="md"
                    style={{ color: "#00c6e6" }}
                  />
                  <span>Add Picture</span>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleImageChange}
              />
            </div>
            <p
              style={{
                color: "rgba(255,255,255,0.3)",
                fontSize: "0.75rem",
                textAlign: "center",
                marginBottom: "20px",
              }}
            >
              Max size: 200KB
              <br />
              Type: JPG, PNG, WebP
            </p>

            <div className="project-color-section" style={{ width: "100%" }}>
              <label
                style={{
                  display: "block",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: "0.8rem",
                  marginBottom: "12px",
                  textAlign: "center",
                }}
              >
                Project Identity Sphere
              </label>

              {/* Identity Sphere Picker */}
              <div
                className="identity-sphere-wrapper"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div
                  className="identity-sphere"
                  onClick={() => colorInputRef.current?.click()}
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50%",
                    backgroundColor: formData.color,
                    cursor: "pointer",
                    boxShadow: `0 0 30px ${formData.color}66, inset 0 0 20px rgba(255,255,255,0.3)`,
                    border: "4px solid rgba(255,255,255,0.1)",
                    transition:
                      "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    className="sphere-glint"
                    style={{
                      position: "absolute",
                      top: "10%",
                      left: "15%",
                      width: "30%",
                      height: "30%",
                      background:
                        "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 80%)",
                      borderRadius: "50%",
                    }}
                  />
                </div>
                <input
                  type="color"
                  ref={colorInputRef}
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  style={{
                    opacity: 0,
                    width: 0,
                    height: 0,
                    position: "absolute",
                  }}
                />
                <span
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    letterSpacing: "1px",
                  }}
                >
                  {formData.color.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="modal-main-content">
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
              <StatusMsg msg={msg} />

              <div className="project-form-row">
                <div className="project-form-col">
                  <label>Project Name</label>
                  <input
                    name="project_name"
                    type="text"
                    className="project-form-input-full"
                    placeholder="e.g. Summer Film 2024"
                    value={formData.project_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="project-form-col">
                  <label>Code Name</label>
                  <input
                    name="code_name"
                    type="text"
                    className="project-form-input-full"
                    placeholder="e.g. S-24"
                    value={formData.code_name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="project-form-row">
                <div className="project-form-col">
                  <label>Start Date</label>
                  <div className="icon-field-wrapper">
                    <Icon name="calendar_month" modifiers="md" />
                    <input
                      name="start_date"
                      type="date"
                      className="project-form-input-full"
                      value={formData.start_date}
                      onChange={handleChange}
                      max="9999-12-31"
                    />
                  </div>
                </div>
                <div className="project-form-col">
                  <label>End Date</label>
                  <div className="icon-field-wrapper">
                    <Icon name="calendar_month" modifiers="md" />
                    <input
                      name="end_date"
                      type="date"
                      className="project-form-input-full"
                      value={formData.end_date}
                      onChange={handleChange}
                      max="9999-12-31"
                    />
                  </div>
                </div>
              </div>

              <div className="project-form-group location-group">
                <label>Location</label>
                <input
                  name="location"
                  type="text"
                  className="project-form-input-full"
                  placeholder="e.g. London, UK"
                  value={formData.location}
                  onChange={handleChange}
                />
              </div>

              <div className="project-form-row" style={{ gap: "20px" }}>
                <div className="project-form-col">
                  <GlassDropdown
                    label="Assign Clients"
                    placeholder="Select Clients..."
                    options={clients.map((c) => ({
                      value: c.id,
                      label: c.username,
                    }))}
                    value={formData.client_ids}
                    onChange={(val) =>
                      setFormData({ ...formData, client_ids: val })
                    }
                    multiple={true}
                  />
                </div>
                <div className="project-form-col">
                  <GlassDropdown
                    label="Assign Production Crew"
                    placeholder="Select Crew members..."
                    options={crew.map((cr) => ({
                      value: cr.id,
                      label: cr.username,
                    }))}
                    value={formData.crew_ids}
                    onChange={(val) =>
                      setFormData({ ...formData, crew_ids: val })
                    }
                    multiple={true}
                  />
                </div>
              </div>

              <div
                className="project-form-actions"
                style={{ marginTop: "10px" }}
              >
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={onCancelEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit-neo"
                  disabled={
                    loading ||
                    projects?.some(
                      (p) =>
                        p.color?.toLowerCase() ===
                          formData.color?.toLowerCase() &&
                        (!editingProject || p.id !== editingProject.id),
                    )
                  }
                >
                  {loading
                    ? "Processing..."
                    : editingProject
                      ? "Save Changes"
                      : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [editingProject, setEditingProject] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [selectedTimelineProject, setSelectedTimelineProject] = useState(null);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const milestoneScrollRef = useRef(null);
  const { showConfirm } = useModal();

  // Milestone Add Form
  const [msForm, setMsForm] = useState({
    title: "",
    description: "",
    target_date: "",
    is_visiondivision: 1,
  });
  const [msLoading, setMsLoading] = useState(false);

  const handleTimelineScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isAtTop = scrollTop <= 10;
    if (isAtTop && showScrollHint) {
      setShowScrollHint(false);
    } else if (!isAtTop && !showScrollHint) {
      setShowScrollHint(true);
    }

    // Calculate progress (0 at bottom, 1 at top)
    const maxScroll = Math.max(1, scrollHeight - clientHeight);
    const progress = 1 - scrollTop / maxScroll;
    setScrollProgress(progress);
  };

  useEffect(() => {
    if (!selectedTimelineProject) return;
    setShowScrollHint(true);

    let scrollAttempts = 0;
    const scrollToBottom = () => {
      if (milestoneScrollRef.current) {
        const { scrollHeight, clientHeight } = milestoneScrollRef.current;
        milestoneScrollRef.current.scrollTop = scrollHeight - clientHeight;

        // Intensified polling to ensure we settle at the very bottom even as images/SVG finish rendering
        if (scrollAttempts < 5) {
          scrollAttempts++;
          setTimeout(scrollToBottom, 150);
        }
      }
    };

    // Immediate attempt + series of follow-ups to handle dynamic SVG height calculation
    scrollToBottom();
  }, [selectedTimelineProject?.id, selectedTimelineProject?._t]);

  const handleAddMilestone = async (e) => {
    e.preventDefault();
    try {
      setMsLoading(true);
      const res = await fetch(
        `${API}/api/projects/${selectedTimelineProject.id}/milestones`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(msForm),
        },
      );
      if (!res.ok) throw new Error("Failed to add milestone");
      setMsForm({
        title: "",
        description: "",
        target_date: "",
        is_visiondivision: 1,
      });
      // To refresh SuiTimeline, we can briefly unmount and remount or rely on a state key.
      // Easiest trick is to update selectedTimelineProject ref to trigger re-render of SuiTimeline
      setSelectedTimelineProject({
        ...selectedTimelineProject,
        _t: Date.now(),
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setMsLoading(false);
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setProjectsLoading(true);
        const res = await fetch(`${API}/api/projects`, {
          credentials: "include",
        });
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch projects:", err);
      } finally {
        setProjectsLoading(false);
      }
    };
    fetchProjects();
  }, [refreshKey]);

  const handleAdded = () => {
    setRefreshKey((prev) => prev + 1);
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
        setRefreshKey((prev) => prev + 1);
      } else {
        const data = await res.json();
        alert(`❌ ${data.error || "Failed to delete"}`);
      }
    } catch (err) {
      alert(`❌ ${err.message}`);
    }
  };

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
          + New Project
        </button>
      </PageHeader>

      <div className="admin-content-animated">
        <div className="admin-dashboard-grid single-column">
          <div className="grid-window full-width">
            <h3 className="project-list-header">Existing Projects</h3>
            <div className="um-table-container">
              {projectsLoading ? (
                <table className="um-table skeleton-table">
                  <thead>
                    <tr>
                      <th>Project Name</th>
                      <th>Code</th>
                      <th>Clients</th>
                      <th>Crew</th>
                      <th>Budget Versions</th>
                      <th>Dates</th>
                      <th>Location</th>
                      <th className="project-action-cell">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td><div className="skeleton-base w-80 h-16" /></td>
                        <td><div className="skeleton-base w-50 h-16 r-8" /></td>
                        <td><div className="skeleton-base w-60 h-16" /></td>
                        <td><div className="skeleton-base w-60 h-16" /></td>
                        <td><div className="skeleton-base w-40 h-24 r-12" /></td>
                        <td><div className="skeleton-base w-70 h-16" /></td>
                        <td><div className="skeleton-base w-50 h-16" /></td>
                        <td className="project-action-cell">
                          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                            <div className="skeleton-base w-90 h-32 r-8" />
                            <div className="skeleton-base w-50 h-32 r-8" />
                            <div className="skeleton-base w-40 h-32 r-8" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="um-table">
                  <thead>
                    <tr>
                      <th>Project Name</th>
                      <th>Code</th>
                      <th>Clients</th>
                      <th>Crew</th>
                      <th>Budget Versions</th>
                      <th>Dates</th>
                      <th>Location</th>
                      <th className="project-action-cell">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id}>
                        <td
                          data-label="Project Name"
                          className="project-name-cell"
                        >
                          <span>{p.project_name}</span>
                        </td>
                        <td data-label="Code">
                          <code className="project-code-box">
                            {p.code_name || "-"}
                          </code>
                        </td>
                        <td data-label="Clients" className="clients-cell">
                          {p.client_usernames ? (
                            p.client_usernames
                          ) : (
                            <span className="no-clients-tag warning-tag pulse">
                              ⚠️ Missing Client
                            </span>
                          )}
                        </td>
                        <td data-label="Crew" className="clients-cell">
                          {p.crew_usernames || (
                            <span className="no-clients-tag">None</span>
                          )}
                        </td>
                        <td
                          data-label="Budget Versions"
                          className="version-count-cell"
                        >
                          <span className="version-badge">
                            {p.version_count || 0}
                          </span>
                        </td>
                        <td data-label="Dates" className="project-dates-cell">
                          {p.start_date
                            ? new Date(p.start_date).toLocaleDateString()
                            : "-"}{" "}
                          -{" "}
                          {p.end_date
                            ? new Date(p.end_date).toLocaleDateString()
                            : "-"}
                        </td>
                        <td data-label="Location">{p.location || "-"}</td>
                        <td data-label="Action" className="project-action-cell">
                          <div className="action-buttons">
                            <button
                              onClick={() => setSelectedTimelineProject(p)}
                              className="approve-btn milestone-btn"
                            >
                              Milestones
                            </button>
                            <button
                              onClick={() => {
                                setEditingProject(p);
                                setShowProjectModal(true);
                              }}
                              className="approve-btn edit-btn"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="reject-btn delete-btn"
                            >
                              <Icon name="delete" modifiers="sm" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {projects.length === 0 && (
                      <tr>
                        <td colSpan="8" className="no-projects-cell">
                          No projects found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Project Add/Edit Modal */}
      {showProjectModal && (
        <ModalPortal>
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

      {/* Milestone Timeline Modal */}
      {selectedTimelineProject && (
        <ModalPortal>
          <div className="sui-modal-overlay">
            <div className="milestone-modal-content-wide">
              <button
                className="modal-close-btn"
                onClick={() => setSelectedTimelineProject(null)}
              >
                ✕
              </button>

              <h3 className="milestone-modal-title">
                Milestones: {selectedTimelineProject.project_name}
              </h3>

              <div className="milestone-modal-body">
                <div className="milestone-modal-main">
                  <div className="milestone-timeline-wrapper">
                    <div
                      className="milestone-scroll-container"
                      ref={milestoneScrollRef}
                      onScroll={handleTimelineScroll}
                    >
                      <SuiTimeline
                        projectId={selectedTimelineProject.id}
                        userRole="admin"
                        key={selectedTimelineProject._t || "1"}
                        scrollProgress={scrollProgress}
                      />
                    </div>
                    <div
                      className={`milestone-scroll-hint ${showScrollHint ? "" : "fade-out"}`}
                    >
                      <Icon name="arrow_upward" modifiers="sm" />
                      <span>Scroll Ahead</span>
                    </div>
                  </div>
                </div>

                <div className="milestone-sidebar">
                  <div className="milestone-sidebar-header">
                    <h4>Add Milestone to Timeline</h4>
                  </div>
                  <form onSubmit={handleAddMilestone}>
                    <div className="sui-form-group">
                      <label>Milestone Title</label>
                      <input
                        type="text"
                        className="sui-form-control"
                        required
                        value={msForm.title}
                        onChange={(e) =>
                          setMsForm({ ...msForm, title: e.target.value })
                        }
                        onFocus={(e) => e.target.select()}
                        placeholder="e.g. Phase 1 Delivery"
                      />
                    </div>
                    <div className="sui-form-group">
                      <label>Target Date</label>
                      <div className="icon-field-wrapper">
                        <Icon name="calendar_month" modifiers="md" />
                        <input
                          type="date"
                          className="sui-form-control"
                          required
                          value={msForm.target_date}
                          onChange={(e) =>
                            setMsForm({
                              ...msForm,
                              target_date: e.target.value,
                            })
                          }
                          onFocus={(e) => e.target.select()}
                          max="9999-12-31"
                        />
                      </div>
                    </div>
                    <div className="sui-form-group">
                      <label>Assignee</label>
                      <GlassDropdown
                        options={[
                          { value: 1, label: "VisionDivision" },
                          { value: 0, label: "Client" },
                        ]}
                        value={msForm.is_visiondivision}
                        onChange={(val) =>
                          setMsForm({ ...msForm, is_visiondivision: val })
                        }
                        placeholder="Select Assignee..."
                      />
                    </div>
                    <div className="sui-form-group">
                      <label>Description (Optional)</label>
                      <textarea
                        className="sui-form-control"
                        rows="3"
                        value={msForm.description}
                        onChange={(e) =>
                          setMsForm({ ...msForm, description: e.target.value })
                        }
                        placeholder="Detailed description..."
                      ></textarea>
                    </div>
                    <button
                      type="submit"
                      className="sui-btn sui-btn-save milestone-sidebar-submit"
                      disabled={msLoading}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                      }}
                    >
                      {msLoading ? (
                        "Adding..."
                      ) : (
                        <>
                          <Icon name="add_circle" modifiers="md" />
                          Add Milestone to Timeline
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </section>
  );
};

export default AdminDashboard;
