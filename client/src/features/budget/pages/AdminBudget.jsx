import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useBlocker, useSearchParams, useLocation } from "react-router-dom";
import { useModal } from "../../../context/ModalContext";
import { useProjects } from "../../projects/context/ProjectContext";
import BudgetEntryForm from "../components/BudgetEntryForm";
import GlassDropdown from "../../../components/common/GlassDropdown";
import PageHeader from "../../../components/common/PageHeader";
import { PageContainer, PageContentCard } from "../../../components/common/PageContainer";
import ConfirmationModal from "../../../components/common/ConfirmationModal";

import HoverTooltip from "../../../components/common/HoverTooltip";
import "./AdminBudget.css";

import { budgetService } from "../../../services/budgetService";
import { getSortedDepartments, getSortedCategories } from "../utils/budgetHelpers";
import { AddDepartment, AddCategory, AddBudgetItem, WidgetOptionsMenu, CompareBudgetWidget } from "../components/AdminSidebarWidgets";
import PublishBudgetModal from "../components/PublishBudgetModal";
import { useAuth } from "../../auth/context/AuthContext";
// ── Main AdminBudget Component ────────────────────────────────────────────────
const AdminBudget = () => {
  const { hasRole, hasPermission } = useAuth();
  const isClient = hasRole("client");
  const canEditBudget = hasPermission("budget.edit") && !isClient;
  const canPublishBudget = hasPermission("budget.publish") && !isClient;

  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get("projectId") || searchParams.get("project") || "";

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

  const projectOptions = useMemo(() => projects
    .filter((p) => p.status !== "completed")
    .map((p) => ({
      value: p.id,
      label: `${p.project_name} ${p.code_name ? `(${p.code_name})` : ""}`,
    })), [projects]);

  const versionOptions = useMemo(() => (versionsCache[projectId] || []).map((v) => {
    const tags = [];
    if (v.published_to_crew) tags.push("Crew");
    if (v.published_to_client) tags.push("Client");
    const tagStr = tags.length > 0 && !isClient ? ` [Published: ${tags.join(" & ")}]` : "";
    return {
      value: String(v.id),
      label: `Version ${v.version_number}${tagStr}`,
    };
  }), [versionsCache, projectId, isClient]);

  const [selectedCatId, setSelectedCatId] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [autoAlignEnabled, setAutoAlignEnabled] = useState(true);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState(null);
  const isSidebarExpanded = activeAccordion !== null;
  const isProjectGroupActive = activeAccordion === 'project';
  const isLowerGroupActive = ['department', 'category', 'item'].includes(activeAccordion);
  const isCompareGroupActive = activeAccordion === 'compare';

  const [compareProjectId, setCompareProjectId] = useState("");
  const [compareVersionId, setCompareVersionId] = useState("");
  const [comparisonData, setComparisonData] = useState(null);
  const [isCompareLoading, setIsCompareLoading] = useState(false);

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
          if (nextState === 'compare') id = "accordion-compare";

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

  const location = useLocation();
  const prevLocationKeyRef = useRef(location.key);

  useEffect(() => {
    if (prevLocationKeyRef.current !== location.key) {
      prevLocationKeyRef.current = location.key;
      if (!budgetIsDirty && !searchParams.get("projectId")) {
        setProjectId("");
        setVersionId("");
        setSelectedCatId("");
        setSelectedDeptId("");
      }
    }
  }, [location.key, budgetIsDirty, searchParams]);

  // Router-level navigation blocker (for Navbar, browser back, links)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      canEditBudget && budgetIsDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  const { showConfirm } = useModal();

  const handleDirtyChange = useCallback((isDirty) => {
    setBudgetIsDirty(isDirty);
  }, []);

  useEffect(() => {
    refreshProjects(true);
    getBudgetMetadata(refreshKey > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const proceedWithProjectChange = useCallback(async (id) => {
    setProjectId(id);
    setVersionId("");
    setSelectedCatId("");
    setSelectedDeptId("");
    if (id) {
      await getBudgetVersions(id, true);
    }
  }, [getBudgetVersions]);

  // Whenever projectId is set/changed, ensure versions are loaded
  useEffect(() => {
    if (projectId) {
      getBudgetVersions(projectId, false);
    }
  }, [projectId, getBudgetVersions]);

  // Auto-select project from query param or default for clients
  useEffect(() => {
    if (queryProjectId) {
      const found = projects.find((p) => String(p.id) === String(queryProjectId));
      if (found && String(projectId) !== String(found.id)) {
        proceedWithProjectChange(found.id);
      }
    } else if (isClient && projects.length > 0 && !projectId) {
      proceedWithProjectChange(projects[0].id);
    }
  }, [queryProjectId, projects, isClient, projectId, proceedWithProjectChange]);

  // Auto-select latest version when project versions load
  useEffect(() => {
    if (projectId && !versionId && versionOptions.length > 0) {
      setVersionId(versionOptions[versionOptions.length - 1].value);
    }
  }, [projectId, versionId, versionOptions]);

  // Fetch comparison data when Compare budget changes
  useEffect(() => {
    const fetchCompareData = async () => {
      if (!compareProjectId || !compareVersionId) {
        setComparisonData(null);
        return;
      }
      setIsCompareLoading(true);
      try {
        const data = await budgetService.getBudgetFull(compareProjectId, compareVersionId);

        const vA = (versionsCache[projectId] || []).find((v) => String(v.id) === String(versionId))?.version_number || "A";
        const vB = (versionsCache[compareProjectId] || []).find((v) => String(v.id) === String(compareVersionId))?.version_number || "B";

        setComparisonData({
          budgetB: data?.values || {},
          versionNameA: `Version ${vA}`,
          versionNameB: `Version ${vB}`
        });
      } catch (err) {
        console.error("Failed to fetch compare data:", err);
        setComparisonData(null);
      } finally {
        setIsCompareLoading(false);
      }
    };

    fetchCompareData();
  }, [compareProjectId, compareVersionId, projectId, versionId, versionsCache]);

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
    <PageContainer id="admin-budget">
      <PageHeader
        category={isClient ? "Client Portal" : "Production Budget"}
        title={isClient ? "Project Budget" : "Entry"}
        description={
          isClient
            ? "View published production budget breakdowns for your assigned projects"
            : "Enhanced view for managing hierarchy and budget entry"
        }
      />

      <PageContentCard>
        <div className="admin-budget-content">
          <div className={`admin-sidebar ${isSidebarExpanded ? 'expanded' : ''}`}>
            <div className="admin-sidebar-overlay">
              <div className={`sidebar-section admin-sidebar-glass ${isSidebarExpanded && !isProjectGroupActive ? 'group-collapsed' : ''}`} id="accordion-project">
                <HoverTooltip text={isSidebarExpanded ? "" : (isClient ? "Project & Version" : "Select Project")} wrapperClassName="w-100" style={{ display: 'flex' }}>
                  <div className="sidebar-widget-header w-100" onClick={() => handleAccordionToggle('project')}>
                    <div className="sidebar-widget-icon-wrapper theme-blue">
                      <span className="material-symbols-outlined icon-root">account_tree</span>
                    </div>
                    <h3 className="sidebar-widget-title">{isClient ? "Project & Version" : "Select Project"}</h3>
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
                        label={isClient ? "Choose project to view budget" : "Choose project to manage budgets"}
                        placeholder="- Select Project -"
                        options={projectOptions}
                        value={projectId}
                        onChange={(val) => handleProjectChange(val)}
                      />
                    </div>

                    {projectId && (
                      <div className="version-selection-area">
                        <div className="version-controls">
                          <div className="version-select-container">
                            <GlassDropdown
                              label={isClient ? "Published Budget Version" : "Select Budget Version"}
                              placeholder={
                                isClient
                                  ? (versionOptions.length === 0 ? "— No Published Versions —" : "— Select Version —")
                                  : "— Select —"
                              }
                              modifiers="lg fluid"
                              options={versionOptions}
                              value={versionId}
                              onChange={(val) => handleVersionChange(val)}
                              disabled={versionOptions.length === 0}
                            />
                          </div>

                          {isClient && versionOptions.length === 0 && (
                            <div className="client-budget-notice">
                              <span className="material-symbols-outlined icon-root">info</span>
                              <span>No published budget is available for this project yet. Published versions from the production team will appear here once released.</span>
                            </div>
                          )}

                          {canEditBudget && (
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
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {canEditBudget && versionId && (
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
              {!isClient && versionId && (
                <div className={`sidebar-section admin-sidebar-glass ${isSidebarExpanded && !isCompareGroupActive ? 'group-collapsed' : ''}`} style={{ gap: '12px' }}>
                  <div id="accordion-compare">
                    <CompareBudgetWidget
                      projects={projects}
                      isExpanded={activeAccordion === 'compare'}
                      isSidebarExpanded={isSidebarExpanded}
                      onToggle={() => handleAccordionToggle('compare')}
                      compareProjectId={compareProjectId}
                      setCompareProjectId={setCompareProjectId}
                      compareVersionId={compareVersionId}
                      setCompareVersionId={setCompareVersionId}
                      onClearCompare={() => {
                        setCompareProjectId("");
                        setCompareVersionId("");
                        if (activeAccordion === 'compare') {
                          setActiveAccordion(null);
                        }
                      }}
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
                    (v) => String(v.id) === String(versionId),
                  )?.version_number || ""
                }
                refreshKey={refreshKey}
                onDirtyChange={handleDirtyChange}
                selectedCatId={autoAlignEnabled ? selectedCatId : ""}
                selectedDeptId={autoAlignEnabled ? selectedDeptId : ""}
                onPublish={canPublishBudget ? handleOpenPublishModal : undefined}
                actionsContainer={sidebarActionsNode}
                comparisonData={comparisonData}
                isCompareLoading={isCompareLoading}
                canEdit={canEditBudget}
              />
            </div>
          </div>
        </div>
      </PageContentCard>

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
    </PageContainer>
  );
};

export default AdminBudget;