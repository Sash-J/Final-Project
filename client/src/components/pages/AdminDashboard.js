import React, { useState, useEffect, useRef } from "react";
import PageHeader from "../common/PageHeader";
import "./AdminDashboard.css";
import SuiTimeline from "./SuiTimeline";
import "../ui/Skeleton.css";
import { useModal } from "../../contexts/ModalContext";
import GlassDropdown from "../common/GlassDropdown";
import ModalPortal from "../common/ModalPortal";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ── Reusable status message ───────────────────────────────────────────────────
const StatusMsg = ({ msg }) => {
  if (!msg) return null;
  const isError = msg.startsWith("Error") || msg.startsWith("❌");
  return <p className={`status-msg ${isError ? "error" : "success"}`}>{msg}</p>;
};

// ── Project Management (Add/Edit) ──────────────────────────────────────────
const ProjectForm = ({ onAdded, editingProject, onCancelEdit }) => {
  const [formData, setFormData] = useState({
    project_name: "",
    code_name: "",
    start_date: "",
    end_date: "",
    location: "",
    client_ids: [],
    crew_ids: [],
  });
  const [clients, setClients] = useState([]);
  const [crew, setCrew] = useState([]);
  const [msg, setMsg] = useState("");

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

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  useEffect(() => {
    if (editingProject) {
      setFormData({
        project_name: editingProject.project_name || "",
        code_name: editingProject.code_name || "",
        start_date: formatDateForInput(editingProject.start_date),
        end_date: formatDateForInput(editingProject.end_date),
        location: editingProject.location || "",
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
      });
    } else {
      setFormData({
        project_name: "",
        code_name: "",
        start_date: "",
        end_date: "",
        location: "",
        client_ids: [],
        crew_ids: [],
      });
    }
  }, [editingProject]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
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
      if (!editingProject) {
        setFormData({
          project_name: "",
          code_name: "",
          start_date: "",
          end_date: "",
          location: "",
          client_ids: [],
          crew_ids: [],
        });
      }
      onAdded && onAdded();
      if (editingProject && onCancelEdit) setTimeout(onCancelEdit, 1500);
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    }
  };

  return (
    <form className="db-form" onSubmit={handleSubmit}>
      <h3>{editingProject ? "Edit Project" : "Add New Project"}</h3>

      <div className="project-form-group">
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

      <div className="project-form-group">
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

      <div className="project-form-row">
        <div className="project-form-col">
          <label>Start Date</label>
          <input
            name="start_date"
            type="date"
            className="project-form-input-full"
            value={formData.start_date}
            onChange={handleChange}
          />
        </div>
        <div className="project-form-col">
          <label>End Date</label>
          <input
            name="end_date"
            type="date"
            className="project-form-input-full"
            value={formData.end_date}
            onChange={handleChange}
          />
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

      <GlassDropdown
        label="Assign Clients"
        placeholder="Select Clients..."
        options={clients.map((c) => ({ value: c.id, label: c.username }))}
        value={formData.client_ids}
        onChange={(val) => setFormData({ ...formData, client_ids: val })}
        multiple={true}
      />

      <GlassDropdown
        label="Assign Production Crew"
        placeholder="Select Crew members..."
        options={crew.map((cr) => ({ value: cr.id, label: cr.username }))}
        value={formData.crew_ids}
        onChange={(val) => setFormData({ ...formData, crew_ids: val })}
        multiple={true}
      />

      <div className="project-form-actions">
        <button type="submit" className="btn-submit-flex">
          {editingProject ? "Update Details" : "Create Project"}
        </button>
        {editingProject && (
          <button type="button" onClick={onCancelEdit} className="btn-cancel">
            Cancel
          </button>
        )}
      </div>

      <div className="status-msg-container" style={{ minHeight: '32px', marginTop: '1rem' }}>
        <StatusMsg msg={msg} />
      </div>
    </form>
  );
};

const AdminDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [editingProject, setEditingProject] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [selectedTimelineProject, setSelectedTimelineProject] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { showConfirm } = useModal();

  // Milestone Add Form
  const [msForm, setMsForm] = useState({
    title: "",
    description: "",
    target_date: "",
    is_visiondivision: 1,
  });
  const [msLoading, setMsLoading] = useState(false);

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
        {/* Project List - Now spanning full width */}
        <div className="grid-window full-width">
          <h3 className="project-list-header">Existing Projects</h3>
          <div className="um-table-container">
            {projectsLoading ? (
              <div style={{ padding: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} style={{ display: 'flex', gap: '15px', padding: '15px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ flex: 2 }}><div className="skeleton-base" style={{ width: '80%', height: '16px' }} /></div>
                      <div style={{ flex: 1 }}><div className="skeleton-base" style={{ width: '40%', height: '16px' }} /></div>
                      <div style={{ flex: 2 }}><div className="skeleton-base" style={{ width: '70%', height: '16px' }} /></div>
                      <div style={{ flex: 3 }}><div className="skeleton-base" style={{ width: '90%', height: '32px', borderRadius: '16px' }} /></div>
                    </div>
                  ))}
                </div>
              </div>
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
                      <td className="project-name-cell">{p.project_name}</td>
                      <td>
                        <code className="project-code-box">
                          {p.code_name || "-"}
                        </code>
                      </td>
                      <td className="clients-cell">
                        {p.client_usernames ? (
                          p.client_usernames
                        ) : (
                          <span className="no-clients-tag warning-tag pulse">
                            ⚠️ Missing Client
                          </span>
                        )}
                      </td>
                      <td className="clients-cell">
                        {p.crew_usernames || (
                          <span className="no-clients-tag">None</span>
                        )}
                      </td>
                      <td className="version-count-cell">
                        <span className="version-badge">
                          {p.version_count || 0}
                        </span>
                      </td>
                      <td className="project-dates-cell">
                        {p.start_date
                          ? new Date(p.start_date).toLocaleDateString()
                          : "-"} - {p.end_date
                          ? new Date(p.end_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td>{p.location || "-"}</td>
                      <td className="project-action-cell">
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
                            Delete
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
          <div className="sui-modal-overlay">
            <div className="sui-modal-content add-edit-modal-content">
              <button
                className="modal-close-btn"
                onClick={() => {
                  setEditingProject(null);
                  setShowProjectModal(false);
                }}
              >
                ✕
              </button>
              <ProjectForm
                onAdded={handleAdded}
                editingProject={editingProject}
                onCancelEdit={() => {
                  setEditingProject(null);
                  setShowProjectModal(false);
                }}
              />
            </div>
          </div>
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

              <div 
                className="milestone-modal-body"
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "20px",
                  flex: 1,
                  minHeight: 0,
                  width: "100%",
                  boxSizing: "border-box"
                }}
              >
                <div 
                  className="milestone-modal-main"
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    height: "100%",
                    backgroundColor: "rgba(0, 198, 230, 0.05)",
                    border: "1px solid rgba(0, 198, 230, 0.2)"
                  }}
                >
                  <div 
                    className="milestone-timeline-wrapper"
                    style={{
                      flex: 1,
                      minHeight: "500px",
                      background: "rgba(0,0,0,0.5)",
                      position: "relative",
                      overflow: "hidden",
                      width: "100%",
                      display: "flex",
                      boxSizing: "border-box"
                    }}
                  >
                    <SuiTimeline
                      projectId={selectedTimelineProject.id}
                      userRole="admin"
                      key={selectedTimelineProject._t || "1"}
                    />
                  </div>
                </div>

                <div 
                  className="milestone-sidebar"
                  style={{
                    width: "400px",
                    flexShrink: 0,
                    background: "rgba(255,255,255,0.05)",
                    padding: "20px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "block"
                  }}
                >
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
                      <input
                        type="date"
                        className="sui-form-control"
                        required
                        value={msForm.target_date}
                        onChange={(e) =>
                          setMsForm({ ...msForm, target_date: e.target.value })
                        }
                        onFocus={(e) => e.target.select()}
                      />
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
                    >
                      {msLoading ? "Adding..." : "Add Milestone to Timeline"}
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
