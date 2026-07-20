import React, { useState, useEffect, useRef } from "react";
import Icon from "../../../components/common/Icon";
import GlassDropdown from "../../../components/common/GlassDropdown";
import GlassDatePicker from "../../../components/common/GlassDatePicker";
import { userService } from "../../../services/userService";
import { projectService } from "../../../services/projectService";
import "./ProjectForm.css";

export const StatusMsg = ({ msg }) => {
  if (!msg) return null;
  const isError = msg.startsWith("Error") || msg.startsWith("X");
  return <p className={`status-msg ${isError ? "error" : "success"}`}>{msg}</p>;
};

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
    color: "var(--accent-color)",
  });

  const [clients, setClients] = useState([]);
  const [crew, setCrew] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const colorInputRef = useRef(null);


  const formatDateForInput = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const data = await userService.getClients();
        setClients(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch clients:", err);
      }
    };
    const fetchCrew = async () => {
      try {
        const data = await userService.getCrew();
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
        color: editingProject.color || "var(--accent-color)",
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
        color: "var(--accent-color)",
      });
    }
  }, [editingProject]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setMsg("Image size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, project_image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      if (editingProject) {
        await projectService.updateProject(editingProject.id, formData);
      } else {
        await projectService.createProject(formData);
      }
      
      setMsg(
        editingProject
          ? "Project updated successfully!"
          : "Project created successfully!",
      );
      setTimeout(() => {
        if (onAdded) onAdded();
      }, 1500);
    } catch (err) {
      setMsg(err.message || "Failed to save project.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="modal-header-section">
        <h2>
          {editingProject ? "Edit Project Profile" : "Initialize New Project"}
        </h2>
        <p>
          {editingProject
            ? "Update the core details of the project."
            : "Set up the core details for a new project."}
        </p>
      </div>

      <StatusMsg msg={msg} />

      <div className="modal-split-layout">
        <div className="modal-side-panel">
          <label className="project-side-label">
            Cover Visual
          </label>
          <div
            className="project-image-upload-panel"
            onClick={() => fileInputRef.current.click()}
            style={{ borderColor: formData.color }}
          >
            {formData.project_image ? (
              <img
                src={formData.project_image}
                alt="Preview"
                className="project-image-preview"
              />
            ) : (
              <div className="image-upload-placeholder">
                <Icon
                  name="cloud_upload"
                  modifiers="lg"
                  style={{ color: formData.color }}
                />
                <span>Upload Image</span>
              </div>
            )}
            <input
              type="file"
              hidden
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          <div className="project-color-section">
            <label className="project-side-label">
              Project Identity
            </label>
            <div className="identity-sphere-wrapper">
              <div
                className="identity-sphere"
                style={{
                  backgroundColor: formData.color,
                }}
                onClick={() => colorInputRef.current.click()}
              />
                <input
                  type="color"
                  ref={colorInputRef}
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  className="hidden-color-input"
                />
                <span className="color-hex-label">
                  {formData.color.toUpperCase()}
                </span>
            </div>
          </div>
        </div>

        <div className="modal-main-content">
          <form onSubmit={handleSubmit}>
            <div className="project-form-row">
              <div className="project-form-col">
                <div className="project-form-group">
                  <label className="neo-label">Project Name</label>
                  <input
                    type="text"
                    className="neo-input"
                    required
                    value={formData.project_name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        project_name: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="project-form-col">
                <div className="project-form-group">
                  <label className="neo-label">Code Name</label>
                  <input
                    type="text"
                    className="neo-input"
                    value={formData.code_name}
                    onChange={(e) =>
                      setFormData({ ...formData, code_name: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="project-form-row">
              <div className="project-form-col">
                <div className="project-form-group">
                  <label className="neo-label">Start Date</label>
                  <GlassDatePicker
                    value={formData.start_date}
                    onChange={(val) => setFormData({ ...formData, start_date: val })}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </div>
              <div className="project-form-col">
                <div className="project-form-group">
                  <label className="neo-label">Target Delivery</label>
                  <GlassDatePicker
                    value={formData.end_date}
                    onChange={(val) => setFormData({ ...formData, end_date: val })}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </div>
            </div>

            <div className="project-form-group">
              <label className="neo-label">Main Location</label>
              <div className="icon-field-wrapper">
                <Icon name="location_on" modifiers="md" />
                <input
                  type="text"
                  className="neo-input"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="project-form-row">
              <div className="project-form-col">
                <div className="project-form-group">
                  <label className="neo-label">Associate Client</label>
                  <GlassDropdown
                    isMulti
                    options={clients.map((c) => ({
                      value: c.id,
                      label: c.username,
                    }))}
                    value={formData.client_ids}
                    onChange={(ids) =>
                      setFormData({ ...formData, client_ids: ids })
                    }
                    placeholder="Add Client"
                  />
                </div>
              </div>
              <div className="project-form-col">
                <div className="project-form-group">
                  <label className="neo-label">Assign Production Crew</label>
                  <GlassDropdown
                    isMulti
                    options={crew.map((c) => ({
                      value: c.id,
                      label: c.username,
                    }))}
                    value={formData.crew_ids}
                    onChange={(ids) =>
                      setFormData({ ...formData, crew_ids: ids })
                    }
                    placeholder="Add Prod. Crew"
                  />
                </div>
              </div>
            </div>

            <div className="project-form-actions">
              <button
                type="button"
                className="btn-neo-cancel"
                onClick={onCancelEdit}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-neo btn-neo-solid"
                disabled={loading}
              >
                {loading
                  ? "Processing..."
                  : editingProject
                    ? "Save Changes"
                    : "Create Production"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default ProjectForm;
