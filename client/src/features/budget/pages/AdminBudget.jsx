import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useBlocker } from "react-router-dom";
import { useModal } from "../../../context/ModalContext";
import { useProjects } from "../../projects/context/ProjectContext";
import BudgetEntryForm from "../components/BudgetEntryForm";
import GlassDropdown from "../../../components/common/GlassDropdown";
import PageHeader from "../../../components/common/PageHeader";
import ConfirmationModal from "../../../components/common/ConfirmationModal";

import HoverTooltip from "../../../components/common/HoverTooltip";
import "./AdminBudget.css";

import { budgetService } from "../../../services/budgetService";
import { getSortedDepartments, getSortedCategories } from "../utils/budgetHelpers";
import { AddDepartment, AddCategory, AddBudgetItem, WidgetOptionsMenu } from "../components/AdminSidebarWidgets";
import PublishBudgetModal from "../components/PublishBudgetModal";
// ── Main AdminBudget Component ────────────────────────────────────────────────
const AdminBudget = () => {
  const {
    projects,
    refreshProjects,
    hierarchyCache,
    phasesCache,
    deptsCache,
    catsCache,
    getBudgetMetadata,
    versionsCache,
    getBudgetVersions,
  } = useProjects();

  // Generate strictly ordered arrays from the budget hierarchy tree
  const sortedDepts = useMemo(() => getSortedDepartments(hierarchyCache, deptsCache), [hierarchyCache, deptsCache]);
  const sortedCats = useMemo(() => getSortedCategories(hierarchyCache, catsCache), [hierarchyCache, catsCache]);

  const [projectId, setProjectId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarActionsNode, setSidebarActionsNode] = useState(null);
  const [selectedCatId, setSelectedCatId] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [autoAlignEnabled, setAutoAlignEnabled] = useState(true);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState(null);
  const isSidebarExpanded = activeAccordion !== null;
  const isProjectGroupActive = activeAccordion === 'project';
  const isLowerGroupActive = ['department', 'category', 'item'].includes(activeAccordion);

  const [autoCenterViewportEnabled, setAutoCenterViewportEnabled] = useState(true);

  const handleAccordionToggle = (section) => {
    setActiveAccordion((prev) => {
      const nextState = prev === section ? null : section;
      
      if (nextState) {
        setTimeout(() => {
          let id = "";
          if (nextState === 'project') id = "accordion-project";
          if (nextState === 'department') id = "accordion-department";
          if (nextState === 'category') id = "add-category-card";
          if (nextState === 'item') id = "add-budget-item-card";
          
          if (id) {
            const el = document.getElementById(id);
            if (el && autoCenterViewportEnabled) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
        }, 300); // wait for CSS transition
      }
      return nextState;
    });
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

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
      const data = await budgetService.cloneBudgetVersion(projectId, versionId);
      
      if (data && !data.error) {
        await getBudgetVersions(projectId, true);
        setVersionId("");
        alert("Version cloned successfully.");
      } else {
        alert(`Failed to clone: ${data?.error || "Unknown error"}`);
      }
    } catch (err) {
      alert("Error cloning version.");
    }
  };

  const handleOpenPublishModal = () => {
    if (!versionId) return;
    setShowPublishModal(true);
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
        const data = await budgetService.deleteBudgetVersion(versionId);
        if (data && data.error) {
          throw new Error(data.error || "Failed to delete version");
        }
        setVersionId("");
        // Force refresh versions list in context
        await getBudgetVersions(projectId, true);
      } catch (err) {
        alert(`Error: ${err.message}`);
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
          <div className={`admin-sidebar ${isSidebarExpanded ? 'expanded' : ''}`}>
            <div className="admin-sidebar-overlay">
              <div className={`sidebar-section admin-sidebar-glass ${isSidebarExpanded && !isProjectGroupActive ? 'group-collapsed' : ''}`} id="accordion-project">
                <HoverTooltip text={isSidebarExpanded ? "" : "Select Project"} wrapperClassName="w-100" style={{ display: 'flex' }}>
                  <div className="sidebar-widget-header w-100" onClick={() => handleAccordionToggle('project')}>
                    <div className="sidebar-widget-icon-wrapper theme-blue">
                      <span className="material-symbols-outlined icon-root">account_tree</span>
                    </div>
                    <h3 className="sidebar-widget-title">Select Project</h3>
                    <WidgetOptionsMenu 
                      autoCenterEnabled={autoCenterViewportEnabled} 
                      onToggleAutoCenter={setAutoCenterViewportEnabled} 
                      isExpanded={activeAccordion === 'project'} 
                    />
                  </div>
                </HoverTooltip>
                
                <div className={`sidebar-widget-content ${activeAccordion === 'project' ? 'accordion-open' : ''}`}>
                  <div className="sidebar-widget-content-inner">
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
                          <HoverTooltip text="Delete selected version">
                            <button
                              type="button"
                              className="btn-neo-cancel version-action-btn-delete"
                              onClick={handleDeleteVersion}
                              disabled={!versionId}
                            >
                              <span className="material-symbols-outlined version-action-icon-delete">
                                delete
                              </span>
                            </button>
                          </HoverTooltip>

                          <HoverTooltip text="Clone current version to a new one">
                            <button
                              type="button"
                              className="btn-neo version-action-btn-clone"
                              onClick={handleCreateNewVersion}
                            >
                              + New Version
                            </button>
                          </HoverTooltip>
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </div>

              {versionId && (
                <div className={`sidebar-section admin-sidebar-glass ${isSidebarExpanded && !isLowerGroupActive ? 'group-collapsed' : ''}`} style={{ gap: '12px' }}>
                  <div id="accordion-department">
                    <AddDepartment
                      phases={phasesCache || []}
                      onAdded={handleDataAdded}
                      isExpanded={activeAccordion === 'department'}
                      isSidebarExpanded={isSidebarExpanded}
                      onToggle={() => handleAccordionToggle('department')}
                      autoCenterEnabled={autoCenterViewportEnabled}
                      onToggleAutoCenter={setAutoCenterViewportEnabled}
                    />
                  </div>
                  <hr className="widget-divider" />
                  <div id="add-category-card">
                    <AddCategory
                      departments={sortedDepts}
                      onAdded={handleDataAdded}
                      onDeptSelect={setSelectedDeptId}
                      isExpanded={activeAccordion === 'category'}
                      isSidebarExpanded={isSidebarExpanded}
                      onToggle={() => handleAccordionToggle('category')}
                      autoCenterEnabled={autoCenterViewportEnabled}
                      onToggleAutoCenter={setAutoCenterViewportEnabled}
                    />
                  </div>
                  <hr className="widget-divider" />
                  <div id="add-budget-item-card">
                    <AddBudgetItem
                      categories={sortedCats}
                      onAdded={handleDataAdded}
                      onCategorySelect={setSelectedCatId}
                      autoAlignEnabled={autoAlignEnabled}
                      onToggleAutoAlign={setAutoAlignEnabled}
                      isExpanded={activeAccordion === 'item'}
                      isSidebarExpanded={isSidebarExpanded}
                      onToggle={() => handleAccordionToggle('item')}
                      autoCenterEnabled={autoCenterViewportEnabled}
                      onToggleAutoCenter={setAutoCenterViewportEnabled}
                    />
                  </div>
                </div>
              )}
              {versionId && (
                <div 
                  ref={setSidebarActionsNode}
                  className={`sidebar-section admin-sidebar-glass sidebar-actions-container ${isSidebarExpanded ? 'group-collapsed' : ''}`}
                  style={{ gap: '12px', marginTop: '32px' }}
                >
                  {/* Actions will be portaled here from BudgetEntryForm */}
                </div>
              )}
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
                actionsContainer={sidebarActionsNode}
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

      <PublishBudgetModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        projectId={projectId}
        versionsCache={versionsCache}
        initialVersionId={versionId}
        onSuccess={() => getBudgetVersions(projectId, true)}
      />
    </section>
  );
};

export default AdminBudget;
