import { useEffect, useRef, useState } from "react";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import ModalPortal from "../../../components/common/ModalPortal";
import { projectService } from "../../../services/projectService";
import { useProjects } from "../../projects/context/ProjectContext";
import AddMilestonePanel from "./AddMilestonePanel";
import "./AddMilestonePanel.css";
import { ScrollTimeline } from "./ScrollTimeline";
import "./SuiTimeline.css";

const SuiTimeline = ({
  projectId,
  userRole,
  preview = false,
  updateTrigger = 0,
  viewMode = "detailed",
  onMilestonesChange,
  onClick,
}) => {
  const { getProjectMilestones, milestonesCache, detailsCache } = useProjects();
  const milestones = milestonesCache[projectId] || [];
  const project = detailsCache ? detailsCache[projectId] || {} : {};
  const projectColor = project.color || "#00c6e6";
  const [loading, setLoading] = useState(true);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const containerRef = useRef(null);
  const [dynamicScale, setDynamicScale] = useState(1);
  const [isGlobalDarkMode, setIsGlobalDarkMode] = useState(
    !document.body.classList.contains("light-theme")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsGlobalDarkMode(!document.body.classList.contains("light-theme"));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const fetchMilestones = async (force = false) => {
    setLoading(true);
    await getProjectMilestones(projectId, force);
    setLoading(false);
  };

  useEffect(() => {
    if (projectId) {
      fetchMilestones(updateTrigger > 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, updateTrigger]);

  useEffect(() => {
    if (!preview) return;

    const updateScale = () => {
      if (containerRef.current && containerRef.current.parentElement) {
        const parent = containerRef.current.parentElement;
        const parentHeight = parent.clientHeight;
        // Use offsetHeight (not scrollHeight) to measure only the card layout,
        // ignoring the absolutely-positioned SVG extension overflow
        const contentHeight = containerRef.current.offsetHeight || 1;

        if (parentHeight > 0 && contentHeight > 0) {
          // Scale it to be exactly the same height as the parent container
          const calculatedScale = Math.min(1, parentHeight / contentHeight);
          setDynamicScale(calculatedScale);
        }
      }
    };

    const timeout = setTimeout(updateScale, 150); // wait for render
    window.addEventListener("resize", updateScale);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", updateScale);
    };
  }, [preview, milestones]);

  const openModal = (m) => {
    setSelectedMilestone(m);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedMilestone(null);
    setIsModalOpen(false);
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await projectService.deleteMilestone(selectedMilestone.id);
      setShowDeleteConfirm(false);
      closeModal();
      fetchMilestones(true);
      if (onMilestonesChange) onMilestonesChange();
    } catch (err) {
      console.error(err);
      alert("Failed to delete. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="sui-timeline-loading">
        <div className="sui-spinner"></div>
      </div>
    );
  }

  // Format milestones for ScrollTimeline
  const sortedMilestones = [...milestones].sort(
    (a, b) => new Date(a.target_date) - new Date(b.target_date),
  );

  const activeViewMode = preview ? "simple" : viewMode;

  const events = sortedMilestones.map((m) => {
    const d = new Date(m.target_date);
    return {
      id: m.id,
      year: d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      title: m.title,
      subtitle:
        activeViewMode === "simple"
          ? ""
          : m.is_visiondivision === 1
            ? "VisionDivision"
            : "Client",
      description: activeViewMode === "simple" ? "" : m.description || "",
      note: activeViewMode === "simple" ? "" : m.client_note || "",
      color: "",
      originalMilestone: m,
    };
  });

  return (
    <>
      <div
        ref={containerRef}
        className={preview ? "sui-preview-clickable" : ""}
        onClick={preview ? onClick : undefined}
        style={preview ? { transform: `scale(${dynamicScale})` } : {}}
      >
        <ScrollTimeline
          key={activeViewMode}
          events={events}
          onEventClick={preview ? undefined : openModal}
          cardAlignment="alternating"
          progressIndicator={true}
          darkMode={isGlobalDarkMode}
          viewMode={activeViewMode}
          preview={preview}
        />
      </div>

      {!preview && isModalOpen && selectedMilestone && (
        <ModalPortal
          onClose={closeModal}
          size="medium"
          className="profile-modal-glass"
        >
          <AddMilestonePanel
            projectId={projectId}
            onSuccess={() => {
              closeModal();
              fetchMilestones(true);
              if (onMilestonesChange) onMilestonesChange();
            }}
            onClose={closeModal}
            mode="edit"
            milestone={selectedMilestone}
            userRole={userRole}
            onDelete={handleDelete}
          />
        </ModalPortal>
      )}

      {showDeleteConfirm && (
        <ConfirmationModal
          title="Delete Milestone"
          message={`Are you sure you want to delete the milestone "${selectedMilestone?.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Keep Milestone"
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
};

export default SuiTimeline;
