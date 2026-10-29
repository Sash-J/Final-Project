import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { useProjects } from "../../projects/context/ProjectContext";
import Folder from "../../../components/common/Folder";
import BudgetEntryForm from "../components/BudgetEntryForm";
import Icon from "../../../components/common/Icon";
import PageHeader from "../../../components/common/PageHeader";
import ViewToggle from "../../../components/common/ViewToggle";
import MiniBudgetSheet from "../components/MiniBudgetSheet";
import VerificationBadge from "../../../components/common/VerificationBadge";
import HoverTooltip from "../../../components/common/HoverTooltip";
import { PageContainer, PageContentCard } from "../../../components/common/PageContainer";
import toast from "react-hot-toast";
import { InfoIcon } from "../../../components/toast/GlobalToaster";
import "./ClientBudgetVault.css";

const FOLDER_SIZE_OPTIONS = [
  { value: "sm", icon: "view_comfy", label: "Small Folders" },
  { value: "lg", icon: "view_compact", label: "Large Folders" },
  { value: "xl", icon: "grid_view", label: "Extra Large Folders (Default)" },
];

const ClientBudgetVault = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryProjectId = searchParams.get("projectId");
  const queryVersionId = searchParams.get("versionId");

  const [folderSize, setFolderSize] = useState(() => {
    return localStorage.getItem("client_budget_folder_size") || "xl";
  });

  const shelfRef = useRef(null);

  const handleSizeChange = useCallback((newSize) => {
    if (newSize === folderSize) return;

    const container = shelfRef.current || document.querySelector(".vault-shelf-container");
    if (!container) {
      setFolderSize(newSize);
      return;
    }

    // 1. FIRST: Capture current bounding rects of all cards
    const cards = Array.from(container.querySelectorAll(".vault-folder-card"));
    const firstRects = new Map();
    cards.forEach((card) => {
      card.style.transition = "none";
      card.style.transform = "none";
      firstRects.set(card, card.getBoundingClientRect());
    });

    // 2. State update (React updates classes and layout)
    setFolderSize(newSize);
    try {
      localStorage.setItem("client_budget_folder_size", newSize);
    } catch {
      // ignore
    }

    // 3. INVERT & PLAY on the next frame after DOM updates
    requestAnimationFrame(() => {
      cards.forEach((card) => {
        const first = firstRects.get(card);
        if (!first) return;
        const last = card.getBoundingClientRect();

        const deltaX = first.left - last.left;
        const deltaY = first.top - last.top;

        if (deltaX !== 0 || deltaY !== 0) {
          // Invert: snap card back to its previous position
          card.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
          card.style.transition = "none";

          // Play: animate from inverted position to final (0, 0)
          requestAnimationFrame(() => {
            card.style.transition = "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)";
            card.style.transform = "";

            const onEnd = () => {
              card.style.transition = "";
              card.removeEventListener("transitionend", onEnd);
            };
            card.addEventListener("transitionend", onEnd);
          });
        } else {
          card.style.transition = "";
          card.style.transform = "";
        }
      });
    });
  }, [folderSize]);

  const {
    projects,
    refreshProjects,
    versionsCache,
    getBudgetVersions,
  } = useProjects();

  const [selectedProjectId, setSelectedProjectId] = useState(queryProjectId || null);
  const [selectedVersionId, setSelectedVersionId] = useState(queryVersionId || null);

  // Load projects on mount
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // Load published versions for all projects so folders show their documents
  useEffect(() => {
    if (projects && projects.length > 0) {
      projects.forEach((p) => {
        getBudgetVersions(p.id, false);
      });
    }
  }, [projects, getBudgetVersions]);

  // Handle URL query parameters and navbar resets
  useEffect(() => {
    if (!queryProjectId) {
      setSelectedProjectId(null);
      setSelectedVersionId(null);
    } else {
      setSelectedProjectId(queryProjectId);
      if (queryVersionId) {
        setSelectedVersionId(queryVersionId);
      }
    }
  }, [queryProjectId, queryVersionId, location.key]);

  // When a project is selected, auto-select its latest published version if none is set
  useEffect(() => {
    if (selectedProjectId && !selectedVersionId) {
      const versions = (versionsCache[selectedProjectId] || []).filter(
        (v) => v.published_to_client === 1 || v.published_to_client === true
      );
      if (versions.length > 0) {
        setSelectedVersionId(String(versions[versions.length - 1].id));
      }
    }
  }, [selectedProjectId, selectedVersionId, versionsCache]);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((p) => String(p.id) === String(selectedProjectId)) || null;
  }, [projects, selectedProjectId]);

  const publishedVersions = useMemo(() => {
    if (!selectedProjectId) return [];
    return (versionsCache[selectedProjectId] || []).filter(
      (v) => v.published_to_client === 1 || v.published_to_client === true
    );
  }, [versionsCache, selectedProjectId]);

  const selectedVersion = useMemo(() => {
    if (!selectedVersionId || !publishedVersions.length) return null;
    return publishedVersions.find((v) => String(v.id) === String(selectedVersionId)) || null;
  }, [publishedVersions, selectedVersionId]);

  const ongoingProjects = useMemo(
    () => (projects || []).filter((p) => p.status !== "completed"),
    [projects]
  );
  const completedProjects = useMemo(
    () => (projects || []).filter((p) => p.status === "completed"),
    [projects]
  );

  const handleOpenVersion = useCallback((projId, versId) => {
    setSelectedProjectId(String(projId));
    setSelectedVersionId(String(versId));
    setSearchParams({ projectId: String(projId), versionId: String(versId) });
  }, [setSearchParams]);

  const handleBackToVault = useCallback(() => {
    setSelectedProjectId(null);
    setSelectedVersionId(null);
    setSearchParams({});
  }, [setSearchParams]);

  // Transform versions of a project into Document cards for the Folder component
  const getProjectFolderItems = useCallback((projId, project = null) => {
    const versions = (versionsCache[projId] || []).filter(
      (v) => v.published_to_client === 1 || v.published_to_client === true
    );

    const projName = project?.project_name || "Production Budget";
    const projBudget = project?.latest_budget_total;

    if (versions.length === 0) {
      return [];
    }

    return versions.map((v) => {
      const dateText = v.published_at
        ? new Date(v.published_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        : "Published Release";

      return {
        title: `Version ${v.version_number}`,
        description: dateText,
        versionId: String(v.id),
        versionNumber: v.version_number,
        content: (
          <MiniBudgetSheet
            versionNumber={v.version_number}
            dateStr={dateText}
            isDraft={false}
            projectName={projName}
            totalAmount={projBudget}
          />
        ),
      };
    });
  }, [versionsCache]);

  const getPrimaryClientTier = useCallback((project) => {
    if (Array.isArray(project.client_details) && project.client_details.length > 0) {
      const match = project.client_details.find((c) => c.verified_level);
      return match
        ? match.verified_level
        : project.client_details[0].verified_level || project.client_details[0].role || null;
    }

    if (project.client_verified_levels) {
      const first = project.client_verified_levels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)[0];
      if (first) return first;
    }

    if (project.client_roles) {
      const firstRole = project.client_roles
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)[0];
      if (firstRole) return firstRole;
    }

    return null;
  }, []);

  const renderFolderCard = (project, isCompleted = false) => {
    const folderItems = getProjectFolderItems(project.id, project);
    const publishedList = (versionsCache[project.id] || []).filter(
      (v) => v.published_to_client === 1 || v.published_to_client === true
    );
    const hasPublished = publishedList.length > 0;
    const latestVersion = hasPublished ? publishedList[publishedList.length - 1] : null;
    const projectColor = project.color || "#00c6e6";

    const primaryClientTier = getPrimaryClientTier(project);
    const isVerified = Boolean(
      primaryClientTier ||
      project.is_verified ||
      project.verified ||
      (project.client_verified_levels && project.client_verified_levels.trim().length > 0)
    );

    const folderScale = isCompleted
      ? folderSize === "sm"
        ? 0.52
        : folderSize === "lg"
          ? 0.65
          : 0.78
      : folderSize === "sm"
        ? 0.75
        : folderSize === "lg"
          ? 0.92
          : 1.12;

    return (
      <div
        key={project.id}
        className={`vault-folder-card size-${folderSize} ${isCompleted ? "archived" : ""}`}
        style={{ "--card-accent": projectColor }}
        onClick={(e) => {
          if (e.target.closest(".folder-document") || e.target.closest(".badge-interactive-container")) {
            return;
          }
          if (!hasPublished) {
            toast("This project does not have a published budget statement yet.", { icon: <InfoIcon /> });
          }
        }}
      >
        <div className="vault-folder-stage-wrapper">
          <Folder
            label={project.project_name}
            items={folderItems}
            mode="flap"
            variant="glass"
            layout="spread"
            color={projectColor}
            paperColor="#ffffff"
            tabPosition="right"
            openOn="hover"
            size={folderScale}
            frost={0.25}
            tilt={0.45}
            speed={1.1}
            bounce={0.35}
            peek={true}
            intro={true}
            draggable={true}
            zoomOnClick={false}
            theme="dark"
            onItemClick={(item) => {
              if (item?.versionId) {
                handleOpenVersion(project.id, item.versionId);
              } else if (hasPublished && latestVersion) {
                handleOpenVersion(project.id, String(latestVersion.id));
              } else {
                toast("This project does not have a published budget statement yet.", { icon: <InfoIcon /> });
              }
            }}
          />
        </div>

        <div className="vault-folder-meta">
          <div className="vault-folder-meta-top">
            <div className="vault-folder-title-wrap">
              <h3 className="vault-folder-name" title={project.project_name}>
                {project.project_name}
              </h3>
              {isVerified && (
                <HoverTooltip text={`Verified project${primaryClientTier ? ` • ${primaryClientTier}` : ""}`} icon="verified">
                  <Icon name="verified" modifiers="xs" className="verified-badge" />
                </HoverTooltip>
              )}
            </div>

            <div className="vault-folder-badges">
              {project.code_name && (
                <span className="vault-folder-code">
                  {project.code_name}
                </span>
              )}
              {primaryClientTier && (
                <VerificationBadge
                  tier={primaryClientTier}
                  size="xs"
                  className="compact-client-badge"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const isEnlargedView = Boolean(selectedProjectId && selectedVersionId);

  return (
    <PageContainer id="client-budget-vault" className="client-dashboard-section">
      <PageHeader
        category="Client Portal"
        title="Project Budget"
        description="View published production budget breakdowns for your assigned projects"
      >
        {!isEnlargedView && (
          <ViewToggle
            value={folderSize}
            onChange={handleSizeChange}
            ariaLabel="Folder size switcher"
            options={FOLDER_SIZE_OPTIONS}
          />
        )}
      </PageHeader>

      <PageContentCard className="client-content-animated">
        {!isEnlargedView ? (
          /* ── State 1: Project Budget Vault (3D Glass Folders Shelf) ── */
          <div ref={shelfRef} className="vault-shelf-container">
            {projects.length === 0 ? (
              <div className="vault-empty-shelf">
                <Icon name="inventory_2" className="vault-empty-icon" />
                <h3>No Assigned Productions Found</h3>
                <p>You have not been assigned to any production projects yet.</p>
              </div>
            ) : (
              <>
                {ongoingProjects.length > 0 ? (
                  <div className={`vault-folders-grid size-${folderSize}`}>
                    {ongoingProjects.map((project) => renderFolderCard(project, false))}
                  </div>
                ) : (
                  <div className="no-projects-message">
                    <Icon name="folder_off" modifiers="lg" />
                    <p>No active productions found.</p>
                  </div>
                )}

                {completedProjects.length > 0 && (
                  <div className="archived-section">
                    <div className="archived-header">
                      <Icon name="archive" modifiers="md" />
                      <h3>Completed Projects</h3>
                      <span className="archived-count">
                        {completedProjects.length}{" "}
                        {completedProjects.length === 1 ? "project" : "projects"}
                      </span>
                    </div>
                    <div className={`vault-folders-grid size-${folderSize} vault-archived-grid`}>
                      {completedProjects.map((project) => renderFolderCard(project, true))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* ── State 2: Enlarged Document View (Focused Budget Sheet) ── */
          <div
            className="vault-sheet-view"
            style={{ "--project-accent": selectedProject?.color || "#00c6e6" }}
          >
            <div className="vault-sheet-topbar">
              <div className="vault-sheet-topbar-left">
                <button className="vault-back-btn" onClick={handleBackToVault}>
                  <Icon name="arrow_back" />
                  <span>Back to Vault</span>
                </button>
                <div className="vault-sheet-title-info">
                  <span className="vault-sheet-project-name">
                    {selectedProject?.project_name || "Project Budget"}
                  </span>
                  <span className="vault-sheet-version-badge">
                    Version {selectedVersion?.version_number || "1"} • Published Statement
                  </span>
                </div>
              </div>

              {publishedVersions.length > 1 && (
                <div className="vault-version-switcher">
                  {publishedVersions.map((v) => {
                    const isActive = String(v.id) === String(selectedVersionId);
                    return (
                      <button
                        key={v.id}
                        className={`vault-version-pill ${isActive ? "active" : ""}`}
                        onClick={() => handleOpenVersion(selectedProjectId, String(v.id))}
                      >
                        Version {v.version_number}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="vault-sheet-content-card">
              <BudgetEntryForm
                embedded={true}
                externalProjectId={selectedProjectId}
                versionId={selectedVersionId}
                projectName={selectedProject?.project_name || ""}
                versionName={selectedVersion?.version_number ? `Version ${selectedVersion.version_number}` : ""}
                canEdit={false}
                hideUnused={true}
                hideMargin={true}
              />
            </div>
          </div>
        )}
      </PageContentCard>
    </PageContainer>
  );
};

export default ClientBudgetVault;
