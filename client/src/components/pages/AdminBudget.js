import React, { useState, useEffect, useCallback } from "react";
import { useBlocker } from "react-router-dom";
import { useModal } from "../../contexts/ModalContext";
import { useProjects } from "../../contexts/ProjectContext";
import BudgetEntryForm from "./BudgetEntryForm";
import GlassDropdown from "../common/GlassDropdown";
import PageHeader from "../common/PageHeader";
import ConfirmationModal from "../common/ConfirmationModal";
import "./AdminBudget.css";

import { API } from "../../config";

// ── Reusable status message ───────────────────────────────────────────────────
const StatusMsg = ({ msg }) => {
  if (!msg) return null;
  const isError = msg.startsWith("Error") || msg.startsWith("❌");
  return <p className={`status-msg ${isError ? "error" : "success"}`}>{msg}</p>;
};

// ── 1. Add Department ─────────────────────────────────────────────────────────
const AddDepartment = ({ phases, onAdded }) => {
  const [name, setName] = useState("");
  const [phaseId, setPhaseId] = useState("2"); // Default to Production
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const res = await fetch(`${API}/api/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          department_name: name,
          phase_id: parseInt(phaseId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(`Department "${name}" added`);
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

      <GlassDropdown
        label="Select Phase"
        placeholder="— Phase —"
        options={phases.map((p) => ({
          value: p.id,
          label: p.phase_name,
        }))}
        value={phaseId}
        onChange={(val) => setPhaseId(val)}
      />

      <button type="submit">Add Department</button>
      <div
        className="status-msg-container"
        style={{ minHeight: "32px", marginTop: "0.5rem" }}
      >
        <StatusMsg msg={msg} />
      </div>
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
      setMsg(`Category "${name}" added`);
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
      <div
        className="status-msg-container"
        style={{ minHeight: "32px", marginTop: "0.5rem" }}
      >
        <StatusMsg msg={msg} />
      </div>
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
      setMsg(`Budget item "${name}" added`);
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
      <div
        className="status-msg-container"
        style={{ minHeight: "32px", marginTop: "0.5rem" }}
      >
        <StatusMsg msg={msg} />
      </div>
    </form>
  );
};

// ── Main AdminBudget Component ────────────────────────────────────────────────
const AdminBudget = () => {
  const {
    projects,
    refreshProjects,
    phasesCache,
    deptsCache,
    catsCache,
    getBudgetMetadata,
    versionsCache,
    getBudgetVersions,
  } = useProjects();

  const [projectId, setProjectId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Unsaved changes protection state
  const [budgetIsDirty, setBudgetIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNav, setPendingNav] = useState(null); // { type, value }

  // Router-level navigation blocker (for Navbar, browser back, links)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      budgetIsDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  const { showConfirm } = useModal();

  const handleDirtyChange = useCallback((isDirty) => {
    setBudgetIsDirty(isDirty);
  }, []);

  useEffect(() => {
    refreshProjects();
    getBudgetMetadata();
  }, [refreshKey, refreshProjects, getBudgetMetadata]);

  // Browser-level unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (budgetIsDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [budgetIsDirty]);

  const handleProjectChange = async (id) => {
    if (budgetIsDirty) {
      setPendingNav({ type: "project", value: id });
      setShowUnsavedModal(true);
      return;
    }
    proceedWithProjectChange(id);
  };

  const proceedWithProjectChange = async (id) => {
    setProjectId(id);
    setVersionId("");
    if (id) {
      await getBudgetVersions(id);
    }
  };

  const handleVersionChange = (val) => {
    if (budgetIsDirty && String(val) !== String(versionId)) {
      setPendingNav({ type: "version", value: val });
      setShowUnsavedModal(true);
      return;
    }
    setVersionId(val);
  };

  const handleDiscard = () => {
    setBudgetIsDirty(false);
    setShowUnsavedModal(false);

    // If blocked by router
    if (blocker.state === "blocked") {
      blocker.proceed();
      return;
    }

    // If blocked by internal project/version switch
    if (!pendingNav) return;
    if (pendingNav.type === "project") {
      proceedWithProjectChange(pendingNav.value);
    } else if (pendingNav.type === "version") {
      setVersionId(pendingNav.value);
    }
    setPendingNav(null);
  };

  const handleStayAndSave = () => {
    setShowUnsavedModal(false);
    setPendingNav(null);

    // If blocked by router, reset it
    if (blocker.state === "blocked") {
      blocker.reset();
    }

    // Highlight the save button at the bottom
    const saveBtn = document.getElementById("bef-save-button");
    if (saveBtn) {
      saveBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      saveBtn.classList.add("highlight-pulse");
      setTimeout(() => saveBtn.classList.remove("highlight-pulse"), 3000);
    }
  };

  const handleCreateNewVersion = async () => {
    if (!projectId) return;

    if (budgetIsDirty) {
      const ok = await showConfirm(
        "You have unsaved changes. These will not be included in the new cloned version unless you save first. Proceed anyway?",
      );
      if (!ok) return;
    }

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
        // Force refresh versions list in context and select the new one
        await getBudgetVersions(projectId, true);
        setVersionId(data.id);
      } else {
        alert("Error creating version: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Failed to create version.");
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
        // Force refresh versions list in context
        await getBudgetVersions(projectId, true);
      } catch (err) {
        alert("Failed to delete version: " + err.message);
      }
    }
  };

  return (
    <section id="admin-budget">
      <PageHeader
        title="Budget Entry"
        description="Enhanced view for managing hierarchy and budget entry"
      />

      <div className="admin-content-animated">
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
                      Select Budget Version
                    </label>
                    <div className="version-controls">
                      <div className="version-select-container">
                        <GlassDropdown
                          placeholder="— Select —"
                          modifiers="lg fluid"
                          options={(versionsCache[projectId] || []).map(
                            (v) => ({
                              value: v.id,
                              label: `Version ${v.version_number}`,
                            }),
                          )}
                          value={versionId}
                          onChange={(val) => handleVersionChange(val)}
                        />
                      </div>

                      <div className="version-actions-row">
                        <button
                          type="button"
                          className="btn-delete-version"
                          onClick={handleDeleteVersion}
                          disabled={!versionId}
                          title="Delete selected version"
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "1rem" }}
                          >
                            delete
                          </span>
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
                  </div>
                )}
              </div>
            </div>

            <div className="grid-window">
              <AddDepartment
                phases={phasesCache || []}
                onAdded={handleDataAdded}
              />
            </div>
            <div className="grid-window">
              <AddCategory
                departments={deptsCache || []}
                onAdded={handleDataAdded}
              />
            </div>
            <div className="grid-window">
              <AddBudgetItem
                categories={catsCache || []}
                onAdded={handleDataAdded}
              />
            </div>
          </div>

          {/* ── Right Main: Budget Entry Form ── */}
          <div className="admin-main">
            <div className="grid-window full-height">
              <BudgetEntryForm
                embedded={true}
                externalProjectId={projectId}
                versionId={versionId}
                projectName={
                  projects.find((p) => p.id === projectId)?.project_name || ""
                }
                versionName={
                  (versionsCache[projectId] || []).find(
                    (v) => v.id === versionId,
                  )?.version_number || ""
                }
                refreshKey={refreshKey}
                onDirtyChange={handleDirtyChange}
              />
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showUnsavedModal || blocker.state === "blocked"}
        title="Unsaved Changes"
        message="You have unsaved modifications in your budget. If you leave now, these changes will be permanently lost."
        onConfirm={handleStayAndSave}
        onCancel={handleDiscard}
        confirmLabel="Go to Save"
        cancelLabel="Discard & Leave"
        confirmVariant="accent"
        cancelVariant="danger"
      />
    </section>
  );
};

export default AdminBudget;
