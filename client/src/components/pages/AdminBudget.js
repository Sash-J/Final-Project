import React, { useState, useEffect } from "react";
import { useModal } from "../../contexts/ModalContext";
import BudgetEntryForm from "./BudgetEntryForm";
import GlassDropdown from "../common/GlassDropdown";
import "./AdminBudget.css";

const API = "http://localhost:5000";

// ── Reusable status message ───────────────────────────────────────────────────
const StatusMsg = ({ msg }) => {
  if (!msg) return null;
  const isError = msg.startsWith("Error") || msg.startsWith("❌");
  return <p className={`status-msg ${isError ? "error" : "success"}`}>{msg}</p>;
};

// ── 1. Add Department ─────────────────────────────────────────────────────────
const AddDepartment = ({ onAdded }) => {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const res = await fetch(`${API}/api/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ department_name: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(`✅ Department "${name}" added`);
      setName("");
      onAdded && onAdded();
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    }
  };

  return (
    <form className="db-form" onSubmit={handleSubmit}>
      <h3>Add Department</h3>
      <label>Enter Department Name</label>
      <input
        type="text"
        placeholder="e.g. Camera Department"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <button type="submit">Add Department</button>
      <StatusMsg msg={msg} />
    </form>
  );
};

// ── 2. Add Category ───────────────────────────────────────────────────────────
const AddCategory = ({ departments, onAdded }) => {
  const [name, setName] = useState("");
  const [deptId, setDeptId] = useState("");
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const res = await fetch(`${API}/api/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category_name: name,
          department_id: parseInt(deptId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(`✅ Category "${name}" added`);
      setName("");
      setDeptId("");
      onAdded && onAdded();
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    }
  };

  return (
    <form className="db-form" onSubmit={handleSubmit}>
      <h3>Add Category</h3>
      <label>Enter Category Name</label>
      <input
        type="text"
        placeholder="e.g. Lighting"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <GlassDropdown
        label="Select Department"
        placeholder="— Department —"
        options={departments.map((d) => ({
          value: d.id,
          label: d.department_name,
        }))}
        value={deptId}
        onChange={(val) => setDeptId(val)}
      />
      <button type="submit">Add Category</button>
      <StatusMsg msg={msg} />
    </form>
  );
};

// ── 3. Add Budget Item ────────────────────────────────────────────────────────
const AddBudgetItem = ({ categories, onAdded }) => {
  const [name, setName] = useState("");
  const [catId, setCatId] = useState("");
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const res = await fetch(`${API}/api/budget-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ item_name: name, category_id: parseInt(catId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(`✅ Budget item "${name}" added`);
      setName("");
      setCatId("");
      onAdded && onAdded();
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    }
  };

  return (
    <form className="db-form" onSubmit={handleSubmit}>
      <h3>Add Budget Item</h3>
      <label>Enter Item Name</label>
      <input
        type="text"
        placeholder="e.g. LED Panel"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <GlassDropdown
        label="Select Category"
        placeholder="— Category —"
        options={categories.map((c) => ({
          value: c.id,
          label: `${c.category_name} (${c.department_name})`,
        }))}
        value={catId}
        onChange={(val) => setCatId(val)}
      />
      <button type="submit">Add Budget Item</button>
      <StatusMsg msg={msg} />
    </form>
  );
};

// ── Main AdminBudget Component ────────────────────────────────────────────────
const AdminBudget = () => {
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [versions, setVersions] = useState([]);
  const [versionId, setVersionId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const { showConfirm } = useModal();

  const fetchMetadata = async () => {
    try {
      const options = { credentials: "include" };
      const [d, c, p] = await Promise.all([
        fetch(`${API}/api/departments`, options).then((r) => r.json()),
        fetch(`${API}/api/categories`, options).then((r) => r.json()),
        fetch(`${API}/api/projects`, options).then((r) => r.json()),
      ]);
      setDepartments(Array.isArray(d) ? d : []);
      setCategories(Array.isArray(c) ? c : []);
      setProjects(Array.isArray(p) ? p : []);
    } catch (err) {
      console.error("Failed to fetch metadata:", err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [refreshKey]);

  const handleProjectChange = async (id) => {
    setProjectId(id);
    setVersionId("");
    if (id) {
      try {
        const res = await fetch(`${API}/api/projects/${id}/budget-versions`, {
          credentials: "include",
        });
        const vData = await res.json();
        if (Array.isArray(vData) && vData.length > 0) {
          setVersions(vData);
        } else {
          setVersions([]);
        }
      } catch (err) {
        console.error("Error fetching versions:", err);
      }
    }
  };

  const handleCreateNewVersion = async () => {
    if (!projectId) return;

    const ok = await showConfirm(
      "Do you want to clone the current budget version?",
    );
    if (!ok) return;

    try {
      const res = await fetch(
        `${API}/api/projects/${projectId}/budget-versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ source_version_id: versionId }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        // Refresh versions list and select the new one
        const vRes = await fetch(
          `${API}/api/projects/${projectId}/budget-versions`,
          { credentials: "include" },
        );
        const vData = await vRes.json();
        setVersions(vData);
        setVersionId(data.id);
      } else {
        alert("Error creating version: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Failed to create version:", err);
    }
  };

  const handleDataAdded = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleDeleteVersion = async () => {
    if (!versionId) return;

    const confirmed = await showConfirm(
      "Are you sure you want to delete this budget version? This action cannot be undone.",
    );

    if (confirmed) {
      try {
        const res = await fetch(`${API}/api/budget-versions/${versionId}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to delete version");
        }
        setVersionId("");
        // Refresh versions list
        const vRes = await fetch(
          `${API}/api/projects/${projectId}/budget-versions`,
          { credentials: "include" },
        );
        const vData = await vRes.json();
        setVersions(Array.isArray(vData) ? vData : []);
      } catch (err) {
        console.error("Error deleting version:", err);
        alert("Failed to delete version: " + err.message);
      }
    }
  };

  return (
    <section id="admin-budget">
      <div className="admin-header">
        <h2>Budget Entry Dashboard</h2>
        <p>
          Consolidated view for managing hierarchy and entering project budgets
        </p>
      </div>

      <div className="admin-budget-content">
        {/* ── Left Sidebar: Controls & Management ── */}
        <div className="admin-sidebar">
          {/* 1. Project Selection */}
          <div className="grid-window">
            <div className="db-form">
              <h3>Project Selection</h3>
              <GlassDropdown
                label="Choose project to manage budgets"
                placeholder="- Select Project -"
                options={projects.map((p) => ({
                  value: p.id,
                  label: `${p.project_name} ${p.code_name ? `(${p.code_name})` : ""}`,
                }))}
                value={projectId}
                onChange={(val) => handleProjectChange(val)}
              />

              {projectId && (
                <div className="version-selection-area">
                  <label className="version-selection-label">
                    Budget Version
                  </label>
                  <div className="version-controls">
                    <div style={{ flex: 1 }}>
                      <GlassDropdown
                        placeholder="— Select —"
                        options={versions.map((v) => ({
                          value: v.id,
                          label: `Version ${v.version_number}`,
                        }))}
                        value={versionId}
                        onChange={(val) => setVersionId(val)}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn-delete-version"
                      onClick={handleDeleteVersion}
                      disabled={!versionId}
                      title="Delete selected version"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>

                    <button
                      type="button"
                      className="btn-new-version"
                      onClick={handleCreateNewVersion}
                      title="Clone current version to a new one"
                    >
                      + New Version
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid-window">
            <AddDepartment onAdded={handleDataAdded} />
          </div>
          <div className="grid-window">
            <AddCategory departments={departments} onAdded={handleDataAdded} />
          </div>
          <div className="grid-window">
            <AddBudgetItem categories={categories} onAdded={handleDataAdded} />
          </div>
        </div>

        {/* ── Right Main: Budget Entry Form ── */}
        <div className="admin-main">
          <div className="grid-window full-height">
            <BudgetEntryForm
              embedded={true}
              externalProjectId={projectId}
              versionId={versionId}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminBudget;
