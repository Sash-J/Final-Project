import React, { useState, useEffect, useCallback } from "react";
import { useBlocker } from "react-router-dom";
import { useModal } from "../../contexts/ModalContext";
import { useProjects } from "../../contexts/ProjectContext";
import BudgetEntryForm from "./BudgetEntryForm";
import GlassDropdown from "../common/GlassDropdown";
import PageHeader from "../common/PageHeader";
import ConfirmationModal from "../common/ConfirmationModal";
import ModalPortal from "../common/ModalPortal";
import "./AdminBudget.css";

import { API } from "../../config";

// ── Reusable status message ───────────────────────────────────────────────────
const StatusMsg = ({ msg, setMsg }) => {
  useEffect(() => {
    if (!msg) return;
    const isError =
      msg.startsWith("Error") ||
      msg.startsWith("X") ||
      msg.startsWith("❌");
    if (!isError && setMsg) {
      const timer = setTimeout(() => {
        setMsg("");
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [msg, setMsg]);

  if (!msg) return null;
  const isError =
    msg.startsWith("Error") ||
    msg.startsWith("X") ||
    msg.startsWith("❌");
  return <p key={msg} className={`status-msg ${isError ? "error" : "success"}`}>{msg}</p>;
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
    <form onSubmit={handleSubmit}>
      <div className="modal-header-section" style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "15px", marginBottom: "25px" }}>
        <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: "600", textTransform: "none", letterSpacing: "normal" }}>Add Department</h3>
      </div>
      <div className="neo-form-group">
        <label className="neo-label">Enter Department Name</label>
        <input
          className="neo-input"
          type="text"
          placeholder="e.g. Camera Department"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="neo-form-group" style={{ marginBottom: "25px" }}>
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
      </div>

      <button type="submit" className="btn-neo btn-neo-solid" style={{ width: "100%" }}>Add Department</button>
      <div
        className="status-msg-container"
        style={{ minHeight: "32px", marginTop: "0.5rem" }}
      >
        <StatusMsg msg={msg} setMsg={setMsg} />
      </div>
    </form>
  );
};

// ── 2. Add Category ───────────────────────────────────────────────────────────
const AddCategory = ({ departments, onAdded, onDeptSelect }) => {
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
      onDeptSelect && onDeptSelect("");
      onAdded && onAdded();
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    }
  };

  const handleDeptChange = (val) => {
    setDeptId(val);
    onDeptSelect && onDeptSelect(val);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-header-section" style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "15px", marginBottom: "25px" }}>
        <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: "600", textTransform: "none", letterSpacing: "normal" }}>Add Category</h3>
      </div>
      <div className="neo-form-group">
        <label className="neo-label">Enter Category Name</label>
        <input
          className="neo-input"
          type="text"
          placeholder="e.g. Lighting"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="neo-form-group" style={{ marginBottom: "25px" }}>
        <GlassDropdown
          label="Select Department"
          placeholder="— Department —"
          options={departments.map((d) => ({
            value: d.id,
            label: d.department_name,
          }))}
          value={deptId}
          onChange={handleDeptChange}
        />
      </div>
      <button type="submit" className="btn-neo btn-neo-solid" style={{ width: "100%" }}>Add Category</button>
      <div
        className="status-msg-container"
        style={{ minHeight: "32px", marginTop: "0.5rem" }}
      >
        <StatusMsg msg={msg} setMsg={setMsg} />
      </div>
    </form>
  );
};

// ── 3. Add Budget Item ────────────────────────────────────────────────────────
const AddBudgetItem = ({
  categories,
  onAdded,
  onCategorySelect,
  autoAlignEnabled,
  onToggleAutoAlign,
}) => {
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
      setMsg(`"${name}" added`);
      setName("");
      setCatId("");
      onCategorySelect && onCategorySelect("");
      onAdded && onAdded();
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    }
  };

  const handleCatChange = (val) => {
    setCatId(val);
    onCategorySelect && onCategorySelect(val);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-header-section" style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "15px", marginBottom: "25px" }}>
        <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: "600", textTransform: "none", letterSpacing: "normal" }}>Add Budget Item</h3>
      </div>
      <div className="neo-form-group">
        <label className="neo-label">Enter Item Name</label>
        <input
          className="neo-input"
          type="text"
          placeholder="e.g. LED Panel"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="neo-form-group" style={{ marginBottom: "25px" }}>
        <GlassDropdown
          label="Select Category"
          placeholder="— Category —"
          options={categories.map((c) => ({
            value: c.id,
            label: `${c.category_name} (${c.department_name})`,
          }))}
          value={catId}
          onChange={handleCatChange}
        />
      </div>
      <button type="submit" className="btn-neo btn-neo-solid" style={{ width: "100%", marginBottom: "15px" }}>Add Budget Item</button>
      <div className="switch-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
        <span className="switch-label neo-label" style={{ marginBottom: 0 }}>Auto-align Department</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={autoAlignEnabled}
            onChange={(e) => onToggleAutoAlign(e.target.checked)}
          />
          <span className="slider"></span>
        </label>
      </div>
      <div
        className="status-msg-container"
        style={{ minHeight: "32px", marginTop: "0.5rem" }}
      >
        <StatusMsg msg={msg} setMsg={setMsg} />
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
  const [selectedCatId, setSelectedCatId] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [addCatMarginTop, setAddCatMarginTop] = useState(0);
  const [addItemMarginTop, setAddItemMarginTop] = useState(0);
  const [autoAlignEnabled, setAutoAlignEnabled] = useState(true);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishToCrew, setPublishToCrew] = useState(false);
  const [publishToClient, setPublishToClient] = useState(false);
  const [selectedPublishVersionId, setSelectedPublishVersionId] = useState("");

  useEffect(() => {
    if (!selectedDeptId || !autoAlignEnabled) {
      setAddCatMarginTop(0);
      return;
    }

    const timer = setTimeout(() => {
      const row = document.getElementById(`dept-section-${selectedDeptId}`);
      const card = document.getElementById("add-category-card");
      if (row && card) {
        const rowRect = row.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        setAddCatMarginTop((prev) => {
          let offset = rowRect.top - cardRect.top + prev;
          return offset < 0 ? 0 : offset;
        });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedDeptId, autoAlignEnabled]);

  useEffect(() => {
    if (!selectedCatId || !autoAlignEnabled) {
      setAddItemMarginTop(0);
      return;
    }

    const timer = setTimeout(() => {
      const row = document.getElementById(`cat-section-${selectedCatId}`);
      const card = document.getElementById("add-budget-item-card");
      if (row && card) {
        const rowRect = row.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        setAddItemMarginTop((prev) => {
          let offset = rowRect.top - cardRect.top + prev;
          return offset < 0 ? 0 : offset;
        });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedCatId, autoAlignEnabled]);

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
    getBudgetMetadata(refreshKey > 0);
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
    setSelectedCatId("");
    setSelectedDeptId("");
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
    setSelectedCatId("");
    setSelectedDeptId("");
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

  const handleOpenPublishModal = () => {
    if (!versionId) return;
    setSelectedPublishVersionId(versionId);
    const versionList = versionsCache[projectId] || [];
    const currentVersion = versionList.find((v) => String(v.id) === String(versionId));
    if (currentVersion) {
      setPublishToCrew(!!currentVersion.published_to_crew);
      setPublishToClient(!!currentVersion.published_to_client);
    } else {
      setPublishToCrew(false);
      setPublishToClient(false);
    }
    setShowPublishModal(true);
  };

  const handlePublishVersionChange = (targetVersionId) => {
    setSelectedPublishVersionId(targetVersionId);
    const versionList = versionsCache[projectId] || [];
    const targetVersion = versionList.find((v) => String(v.id) === String(targetVersionId));
    if (targetVersion) {
      setPublishToCrew(!!targetVersion.published_to_crew);
      setPublishToClient(!!targetVersion.published_to_client);
    } else {
      setPublishToCrew(false);
      setPublishToClient(false);
    }
  };

  const handleSavePublishSettings = async () => {
    try {
      const res = await fetch(`${API}/api/budget-versions/${selectedPublishVersionId}/publish`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          published_to_crew: publishToCrew,
          published_to_client: publishToClient,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update publish settings");
      }

      await getBudgetVersions(projectId, true);
      setShowPublishModal(false);
    } catch (err) {
      alert("Error: " + err.message);
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
          {/* Master Project Selection Panel */}
          <div className="master-project-selection full-width" style={{ zIndex: 50, marginBottom: "20px" }}>
            <div className="project-dropdown-wrapper">
              <GlassDropdown
                label="Choose project to manage budgets"
                placeholder="- Select Project -"
                options={projects
                  .filter((p) => p.status !== "completed")
                  .map((p) => ({
                    value: p.id,
                    label: `${p.project_name} ${p.code_name ? `(${p.code_name})` : ""}`,
                  }))}
                value={projectId}
                onChange={(val) => handleProjectChange(val)}
              />
            </div>

            {projectId && (
              <div className="version-selection-area">
                <div className="version-controls">
                  <div className="version-select-container">
                    <GlassDropdown
                      label="Select Budget Version"
                      placeholder="— Select —"
                      modifiers="lg fluid"
                      options={(versionsCache[projectId] || []).map(
                        (v) => {
                          const tags = [];
                          if (v.published_to_crew) tags.push("Crew");
                          if (v.published_to_client) tags.push("Client");
                          const tagStr = tags.length > 0 ? ` [Published: ${tags.join(" & ")}]` : "";
                          return {
                            value: v.id,
                            label: `Version ${v.version_number}${tagStr}`,
                          };
                        }
                      )}
                      value={versionId}
                      onChange={(val) => handleVersionChange(val)}
                    />
                  </div>

                  <div className="version-actions-row">
                      <button
                        type="button"
                        className="btn-neo-cancel"
                        onClick={handleDeleteVersion}
                        disabled={!versionId}
                        title="Delete selected version"
                        style={{ padding: "8px 16px" }}
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
                        className="btn-neo"
                        onClick={handleCreateNewVersion}
                        title="Clone current version to a new one"
                        style={{ padding: "8px 16px", borderRadius: "12px" }}
                      >
                        + New Version
                      </button>
                    </div>
                  </div>
                </div>
              )}
          </div>

          <div className="admin-sidebar">

            <div className="grid-window">
              <AddDepartment
                phases={phasesCache || []}
                onAdded={handleDataAdded}
              />
            </div>
            <div
              className="grid-window"
              id="add-category-card"
              style={{ marginTop: `${addCatMarginTop}px` }}
            >
              <AddCategory
                departments={deptsCache || []}
                onAdded={handleDataAdded}
                onDeptSelect={setSelectedDeptId}
              />
            </div>
            <div
              className="grid-window"
              id="add-budget-item-card"
              style={{ marginTop: `${addItemMarginTop}px` }}
            >
              <AddBudgetItem
                categories={catsCache || []}
                onAdded={handleDataAdded}
                onCategorySelect={setSelectedCatId}
                autoAlignEnabled={autoAlignEnabled}
                onToggleAutoAlign={setAutoAlignEnabled}
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
                selectedCatId={autoAlignEnabled ? selectedCatId : ""}
                selectedDeptId={autoAlignEnabled ? selectedDeptId : ""}
                onPublish={handleOpenPublishModal}
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

      {showPublishModal && (
        <ModalPortal className="no-glass" showClose={false}>
          <div className="publish-modal-overlay" onClick={() => setShowPublishModal(false)}>
            <div className="publish-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="publish-modal-header">
                <h3>Publish Budget Version</h3>
                <button className="publish-modal-close" onClick={() => setShowPublishModal(false)}>&times;</button>
              </div>
              <div className="publish-modal-body">
                <div className="publish-modal-field">
                  <label className="publish-modal-label">Select Version to Publish</label>
                  <select
                    className="publish-version-select"
                    value={selectedPublishVersionId}
                    onChange={(e) => handlePublishVersionChange(e.target.value)}
                  >
                    {(versionsCache[projectId] || []).map((v) => {
                      const tags = [];
                      if (v.published_to_crew) tags.push("Crew");
                      if (v.published_to_client) tags.push("Client");
                      const tagStr = tags.length > 0 ? ` [Published: ${tags.join(" & ")}]` : "";
                      return (
                        <option key={v.id} value={v.id}>
                          Version {v.version_number}{tagStr}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="publish-version-details">
                  <div className="detail-item">
                    <span className="detail-label">Active Version in Editor:</span>
                    <span className="detail-value active-highlight">
                      Version {(versionsCache[projectId] || []).find((v) => String(v.id) === String(versionId))?.version_number || "None"}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Last Published:</span>
                    <span className="detail-value">
                      {(() => {
                        const selVer = (versionsCache[projectId] || []).find((v) => String(v.id) === String(selectedPublishVersionId));
                        if (selVer && selVer.published_at) {
                          return new Date(selVer.published_at).toLocaleString();
                        }
                        return "Not published yet";
                      })()}
                    </span>
                  </div>
                </div>

                <div className="publish-options-group">
                  <div className="publish-option">
                    <label className="publish-checkbox-label">
                      <input
                        type="checkbox"
                        checked={publishToCrew}
                        onChange={(e) => setPublishToCrew(e.target.checked)}
                        className="publish-checkbox-input"
                      />
                      <span>Publish to Production Crew</span>
                    </label>
                  </div>

                  <div className="publish-option">
                    <label className="publish-checkbox-label">
                      <input
                        type="checkbox"
                        checked={publishToClient}
                        onChange={(e) => setPublishToClient(e.target.checked)}
                        className="publish-checkbox-input"
                      />
                      <span>Publish to Client</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="publish-modal-footer">
                <button className="btn-cancel" onClick={() => setShowPublishModal(false)}>Cancel</button>
                <button className="btn-save" onClick={handleSavePublishSettings}>Save Settings</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </section>
  );
};

export default AdminBudget;
