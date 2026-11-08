import React, { useState, useEffect, useRef, useMemo } from "react";
import Icon from "../../../components/common/Icon";
import GlassDropdown from "../../../components/common/GlassDropdown";
import GlassDatePicker from "../../../components/common/GlassDatePicker";
import FloatingInput from "../../../components/common/FloatingInput";
import NeoButton from "../../../components/common/NeoButton";
import { userService } from "../../../services/userService";
import { projectService } from "../../../services/projectService";
import { validateProjectForm } from "../../../utils/validators";
import "./ProjectForm.css";

import toast from "react-hot-toast";

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
    route_locations: [],
  });

  const [clients, setClients] = useState([]);
  const [crew, setCrew] = useState([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({
    project_name: false,
    code_name: false,
    start_date: false,
    end_date: false,
  });
  const fileInputRef = useRef(null);
  const colorInputRef = useRef(null);

  const validationErrors = useMemo(() => validateProjectForm(formData), [formData]);
  const isFormValid = useMemo(
    () =>
      !validationErrors.project_name &&
      !validationErrors.code_name &&
      !validationErrors.start_date &&
      !validationErrors.end_date,
    [validationErrors]
  );

  const submitDisabledReason = useMemo(() => {
    if (!formData.project_name.trim()) return "Project name is required";
    if (validationErrors.project_name) return validationErrors.project_name;
    if (validationErrors.code_name) return validationErrors.code_name;
    if (validationErrors.start_date) return validationErrors.start_date;
    if (validationErrors.end_date) return validationErrors.end_date;
    return "";
  }, [formData.project_name, validationErrors]);

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
        route_locations: Array.isArray(editingProject.route_locations)
          ? editingProject.route_locations
          : editingProject.route_locations
            ? JSON.parse(editingProject.route_locations)
            : undefined, // undefined prevents sending an empty array if not loaded
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
        route_locations: [],
      });
    }
  }, [editingProject]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, project_image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({
      project_name: true,
      code_name: true,
      start_date: true,
      end_date: true,
    });

    if (!isFormValid) {
      toast.error("Please fix project form errors.");
      return;
    }

    setLoading(true);
    const payload = {
      ...formData,
      client_ids: Array.isArray(formData.client_ids)
        ? formData.client_ids.map(Number)
        : formData.client_ids
          ? [Number(formData.client_ids)]
          : [],
      crew_ids: Array.isArray(formData.crew_ids)
        ? formData.crew_ids.map(Number)
        : formData.crew_ids
          ? [Number(formData.crew_ids)]
          : [],
    };

    try {
      if (editingProject) {
        await projectService.updateProject(editingProject.id, payload);
      } else {
        await projectService.createProject(payload);
      }

      toast.success(
        editingProject
          ? "Project updated successfully!"
          : "Project created successfully!",
      );
      setTimeout(() => {
        if (onAdded) onAdded();
      }, 1500);
    } catch (err) {
      toast.error(err.message || "Failed to save project.");
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
      <div className="modal-split-layout">
        <div className="modal-side-panel">
          <label className="project-side-label">Cover Visual</label>
          <div
            className="project-image-upload-panel"
            onClick={() => fileInputRef.current.click()}
            style={{ borderColor: formData.color }}
          >
            {formData.project_image ? (
              <img
                src={
                  formData.project_image.startsWith("image/")
                    ? `data:${formData.project_image}`
                    : formData.project_image
                }
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
            <label className="project-side-label">Project Identity</label>
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
                <FloatingInput
                  label="Project Name"
                  required
                  placeholder="e.g. Inception Commercial"
                  value={formData.project_name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      project_name: e.target.value,
                    })
                  }
                  onBlur={() => setTouched((prev) => ({ ...prev, project_name: true }))}
                  error={touched.project_name ? validationErrors.project_name : ""}
                />
              </div>
              <div className="project-form-col">
                <FloatingInput
                  label="Code Name"
                  placeholder="e.g. INCP-2026"
                  value={formData.code_name}
                  onChange={(e) =>
                    setFormData({ ...formData, code_name: e.target.value })
                  }
                  onBlur={() => setTouched((prev) => ({ ...prev, code_name: true }))}
                  error={touched.code_name ? validationErrors.code_name : ""}
                />
              </div>
            </div>

            <div className="project-form-row">
              <div className="project-form-col">
                <FloatingInput
                  label="Start Date"
                  hasValue={Boolean(formData.start_date)}
                  error={touched.start_date ? validationErrors.start_date : ""}
                >
                  <GlassDatePicker
                    value={formData.start_date}
                    onChange={(val) => {
                      setFormData({ ...formData, start_date: val });
                      setTouched((prev) => ({ ...prev, start_date: true }));
                    }}
                  />
                </FloatingInput>
              </div>
              <div className="project-form-col">
                <FloatingInput
                  label="Target Delivery"
                  hasValue={Boolean(formData.end_date)}
                  error={touched.end_date ? validationErrors.end_date : ""}
                >
                  <GlassDatePicker
                    value={formData.end_date}
                    onChange={(val) => {
                      setFormData({ ...formData, end_date: val });
                      setTouched((prev) => ({ ...prev, end_date: true }));
                    }}
                  />
                </FloatingInput>
              </div>
            </div>

            <div className="project-form-row">
              <div className="project-form-col">
                <FloatingInput
                  label="Associate Client"
                  hasValue={Boolean(formData.client_ids && formData.client_ids.length > 0)}
                >
                  <GlassDropdown
                    multiple
                    isMulti
                    options={clients.map((c) => ({
                      value: c.id,
                      label: c.username,
                    }))}
                    value={formData.client_ids}
                    onChange={(ids) =>
                      setFormData({
                        ...formData,
                        client_ids: Array.isArray(ids) ? ids : (ids ? [ids] : []),
                      })
                    }
                    placeholder="Add Client"
                  />
                </FloatingInput>
              </div>
              <div className="project-form-col">
                <FloatingInput
                  label="Assign Production Crew"
                  hasValue={Boolean(formData.crew_ids && formData.crew_ids.length > 0)}
                >
                  <GlassDropdown
                    multiple
                    isMulti
                    options={crew.map((c) => ({
                      value: c.id,
                      label: c.username,
                    }))}
                    value={formData.crew_ids}
                    onChange={(ids) =>
                      setFormData({
                        ...formData,
                        crew_ids: Array.isArray(ids) ? ids : (ids ? [ids] : []),
                      })
                    }
                    placeholder="Add Prod. Crew"
                  />
                </FloatingInput>
              </div>
            </div>

            <div className="project-form-actions">
              <NeoButton
                type="button"
                variant="cancel"
                onClick={onCancelEdit}
                disabled={loading}
              >
                Cancel
              </NeoButton>
              <NeoButton
                type="submit"
                variant="solid"
                loading={loading}
                disabled={!isFormValid}
                disabledReason={submitDisabledReason}
              >
                {editingProject ? "Save Changes" : "Create Production"}
              </NeoButton>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default ProjectForm;
