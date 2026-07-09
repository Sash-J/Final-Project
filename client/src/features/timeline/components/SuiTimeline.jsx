import axios from "axios";
import { useEffect, useRef, useState } from "react";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import Icon from "../../../components/common/Icon";
import ModalPortal from "../../../components/common/ModalPortal";
import "./SuiTimeline.css";
import "./AddMilestonePanel.css";
import { projectService } from "../../../services/projectService";

import { API } from "../../../config";
import { useProjects } from "../../projects/context/ProjectContext";
import AddMilestonePanel from "./AddMilestonePanel";

const SuiTimeline = ({
  projectId,
  userRole,
  preview = false,
  updateTrigger = 0,
  onMilestonesChange,
  onClick,
  scrollProgress = 0,
}) => {
  const { getProjectMilestones, milestonesCache } = useProjects();
  const milestones = milestonesCache[projectId] || [];
  const [loading, setLoading] = useState(true);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

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
    const updateDims = () => {
      if (containerRef.current) {
        let { clientWidth } = containerRef.current;
        if (clientWidth < 100) clientWidth = 800;

        const itemHeight = Math.max(300, window.innerHeight * 0.35);
        const paddingY = 250;
        const totalHeight = preview 
          ? 200 
          : Math.max(window.innerHeight, milestones.length * itemHeight + paddingY * 2);

        setDimensions({ width: clientWidth, height: totalHeight });
      }
    };
    updateDims();
    const timer = setTimeout(updateDims, 300);
    window.addEventListener("resize", updateDims);
    return () => {
      window.removeEventListener("resize", updateDims);
      clearTimeout(timer);
    };
  }, [milestones, preview]);

  useEffect(() => {
    if (!loading && containerRef.current && !preview) {
      const timer = setTimeout(() => {
        const parent = containerRef.current.parentElement;
        if (parent) {
          parent.scrollTop = parent.scrollHeight;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, preview]);

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

  const count = milestones.length;
  const startY = 120;
  const endY = dimensions.height - 150;

  const sortedMilestones = [...milestones].sort((a, b) => {
    const dateA = new Date(a.target_date || 0);
    const dateB = new Date(b.target_date || 0);
    return dateA - dateB;
  });

  const points = sortedMilestones.map((m, i) => {
    if (preview) {
      const startX = 40;
      const endX = dimensions.width - 40;
      const x =
        count === 1
          ? (startX + endX) / 2
          : startX + (i / (count - 1)) * (endX - startX);
      
      const normalizedX = count <= 1 ? 0.5 : i / (count - 1);
      const amplitude = 30;
      const y = dimensions.height / 2 + Math.sin(normalizedX * Math.PI * 2) * amplitude;
      return { x, y, isTop: i % 2 === 0, ...m };
    }

    const y =
      count === 1
        ? (startY + endY) / 2
        : endY - (i / (count - 1)) * (endY - startY);

    const normalizedY = count <= 1 ? 0.5 : (endY - y) / (endY - startY);
    
    // Depth perspective mapping: tighter at top (0.15), wider at bottom (1.0)
    const perspectiveFactor = 0.15 + (normalizedY * 0.85); 
    const amplitude = count <= 1 ? 0 : dimensions.width * 0.35 * perspectiveFactor;
    
    const centerX = dimensions.width / 2;
    // 1.5 cycles depending on count to make it look winding
    const x = centerX + Math.sin(normalizedY * Math.PI * Math.min(count, 3)) * amplitude;

    // Drop line logic
    // we want nodes to drop down or slightly left/right. 
    // Just a clean vertical drop-down line
    const dropLength = 60 + (i % 3) * 20; // Stagger drops slightly
    const textY = y + dropLength;
    const isLeft = x < centerX;

    return { x, y, textY, isLeft, dropLength, ...m };
  });

  const formatDt = (dStr) => {
    if (!dStr) return "No Date";
    const date = new Date(dStr);
    if (isNaN(date.getTime())) return dStr;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const generateMasterPath = () => {
    if (points.length === 0)
      return { previewDPath: "", segments: [], gradientStops: [], gradientId: "" };

    let previewDPath = "";
    let segments = [];
    const gradientStops = [];
    const gradientId = preview
      ? `timeline-gradient-hz-${projectId}`
      : `timeline-gradient-vt-${projectId}`;

    const getColor = (status) => {
      if (status === "completed") return "#00c6e6";
      if (status === "in_progress") return "#e0f2fe"; // brighter glowing cyan
      return "rgba(0, 198, 230, 0.2)";
    };

    if (preview) {
      let prevX = 0;
      let prevY = dimensions.height / 2;
      previewDPath += `M ${prevX} ${prevY}`;

      points.forEach((p, i) => {
        const midX = (prevX + p.x) / 2;
        previewDPath += ` C ${midX} ${prevY}, ${midX} ${p.y}, ${p.x} ${p.y}`;
        const startPercent = (prevX / dimensions.width) * 100;
        const endPercent = (p.x / dimensions.width) * 100;
        const color = getColor(p.status);
        gradientStops.push(
          <stop key={`start-${i}`} offset={`${startPercent}%`} stopColor={color} />
        );
        gradientStops.push(
          <stop key={`end-${i}`} offset={`${endPercent}%`} stopColor={color} />
        );
        prevX = p.x;
        prevY = p.y;
      });
      previewDPath += ` L ${dimensions.width} ${prevY}`;
    } else {
      let prevX = dimensions.width * 0.5;
      let prevY = dimensions.height;

      points.forEach((p, i) => {
        const midY = (prevY + p.y) / 2;
        const d = `M ${prevX} ${prevY} C ${prevX} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
        
        // Depth logic for stroke width and opacity
        const avgY = (prevY + p.y) / 2;
        // normY goes from 0 at top to 1 at bottom
        const normY = Math.max(0, Math.min(1, avgY / dimensions.height));
        const strokeW = 1 + (normY * 5); // 1px at top, 6px at bottom
        const opacity = 0.15 + (normY * 0.85); // Faded at top

        const isGlow = p.status === "completed" || p.status === "in_progress";
        
        segments.push({
          id: `seg-${i}`,
          d,
          strokeW,
          opacity,
          isGlow
        });

        const startPercent = 100 - (prevY / dimensions.height) * 100;
        const endPercent = 100 - (p.y / dimensions.height) * 100;
        const color = getColor(p.status);
        gradientStops.push(
          <stop key={`start-${i}`} offset={`${startPercent}%`} stopColor={color} />
        );
        gradientStops.push(
          <stop key={`end-${i}`} offset={`${endPercent}%`} stopColor={color} />
        );
        prevX = p.x;
        prevY = p.y;
      });

      const futureExtend = -150;
      // Gently curve the tail upwards to the center, or just extend straight if at center
      const tailD = count <= 1 
        ? `M ${prevX} ${prevY} L ${prevX} ${futureExtend}`
        : `M ${prevX} ${prevY} C ${prevX} ${prevY - 100}, ${dimensions.width * 0.5} ${prevY - 100}, ${dimensions.width * 0.5} ${futureExtend}`;
      segments.push({
        id: `seg-tail`,
        d: tailD,
        strokeW: 1,
        opacity: 0.15,
        isGlow: false
      });
    }
    return { previewDPath, segments, gradientStops, gradientId };
  };

  const { previewDPath, segments, gradientStops, gradientId } = generateMasterPath();

  if (loading) {
    return (
      <div className="sui-timeline-skeleton">
        <div className="sui-skeleton-path"></div>
        <span className="sui-skeleton-text">Mapping Production History...</span>
      </div>
    );
  }

  if (!loading && milestones.length === 0) {
    return (
      <div
        className="sui-timeline-empty"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          minHeight: "200px",
          color: "rgba(255, 255, 255, 0.2)",
          fontSize: "0.9rem",
          fontWeight: "400",
          width: "100%",
          cursor: "default",
        }}
      >
        <Icon name="add_box" modifiers="lg" />
        <span>
          Your timeline is empty. Create a timeline by adding milestones
        </span>
      </div>
    );
  }

  return (
    <div
      className={`sui-timeline-wrapper sui-fade-in ${preview ? "sui-preview-mode sui-preview-clickable" : ""}`}
      ref={containerRef}
      style={{
        height: preview ? "100%" : `${dimensions.height}px`,
      }}
      onClick={preview && onClick ? onClick : undefined}
    >
      <svg
        className="sui-svg-container"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      >
        <defs>
          <filter id="glow-effect" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {gradientId && (
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1={preview ? "0" : dimensions.height}
              x2={preview ? dimensions.width : "0"}
              y2={preview ? "0" : "0"}
            >
              {gradientStops}
            </linearGradient>
          )}
        </defs>

        <g className="sui-svg-content">
          {preview ? (
            <path
              d={previewDPath}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="2"
              className="sui-path-base"
            />
          ) : (
            <>
              {segments.map((seg) => (
                <g key={seg.id}>
                  {seg.isGlow && (
                    <path
                      d={seg.d}
                      fill="none"
                      stroke={`url(#${gradientId})`}
                      strokeWidth={seg.strokeW + 2}
                      filter="url(#glow-effect)"
                      opacity={seg.opacity}
                      className="sui-path-glow"
                    />
                  )}
                  <path
                    d={seg.d}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth={seg.strokeW}
                    opacity={seg.opacity}
                    className="sui-path-base"
                  />
                </g>
              ))}
            </>
          )}
          
          {!preview && points.map((p, i) => (
            <line
              key={`drop-${i}`}
              x1={p.x}
              y1={p.y}
              x2={p.x}
              y2={p.textY}
              stroke={p.status === "completed" ? "#00c6e6" : p.status === "in_progress" ? "#e0f2fe" : "rgba(0, 198, 230, 0.2)"}
              strokeWidth="1"
              className="sui-drop-line"
            />
          ))}
        </g>
      </svg>

      <div className="sui-milestones-absolute">
        {points.map((p, i) => {
          const isLeft = p.isLeft;

          return (
            <div
              key={p.id}
              className={`sui-absolute-item sui-status-${p.status}`}
              style={{
                top: preview ? p.y : p.textY,
                left: p.x,
                position: 'absolute',
                "--dot-shadow":
                  p.status === "completed"
                    ? "#00c6e6"
                    : p.status === "in_progress"
                      ? "#e0f2fe"
                      : "#fff",
              }}
              onClick={() => openModal(p)}
            >
              {preview && <div className="sui-exact-dot"></div>}
              
              <div
                className={`sui-exact-content align-drop`}
                style={
                  preview
                    ? {
                        top: p.isTop ? "auto" : "20px",
                        bottom: p.isTop ? "20px" : "auto",
                        transform: `translateX(-50%)`,
                        transformOrigin: p.isTop
                          ? "bottom center"
                          : "top center",
                      }
                    : {
                        transform: isLeft ? `translate(calc(-100% - 15px), 0)` : `translate(15px, 0)`,
                        width: '320px',
                        textAlign: isLeft ? 'right' : 'left'
                      }
                }
              >
                <div className="sui-date">{formatDt(p.target_date)}</div>
                <div className="sui-title">
                  {p.title}
                  <span className="sui-vd-badge">
                    {p.is_visiondivision === 1 ? "VisionDivision" : "Client"}
                  </span>
                </div>
                {!preview && (
                  <>
                    <div className="sui-desc">{p.description}</div>
                    {p.client_note &&
                      (() => {
                        const noteStr = p.client_note;
                        let roleTag = null;
                        let text = noteStr;
                        const match = noteStr.match(
                          /^\[(Admin|Manager|Client|VisionDivision)\]\s*([\s\S]*)$/i,
                        );
                        if (match) {
                          const rawTag = match[1];
                          text = match[2];
                          roleTag =
                            rawTag.toLowerCase() === "admin" ||
                            rawTag.toLowerCase() === "manager" ||
                            rawTag.toLowerCase() === "visiondivision"
                              ? "Vdv"
                              : "Client";
                        }
                        return (
                          <div className="sui-note">
                            {roleTag && (
                              <span className="sui-client-badge sui-client-badge--note">
                                {roleTag}
                              </span>
                            )}
                            <span className="sui-note-text">{text}</span>
                          </div>
                        );
                      })()}
                  </>
                )}
              </div>
            </div>
          );
        })}
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
    </div>
  );
};

export default SuiTimeline;
