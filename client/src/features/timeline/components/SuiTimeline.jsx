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
  viewMode = "detailed",
}) => {
  const { getProjectMilestones, milestonesCache, detailsCache } = useProjects();
  const milestones = milestonesCache[projectId] || [];
  const project = detailsCache ? (detailsCache[projectId] || {}) : {};
  const projectColor = project.color || "#00c6e6";
  const [loading, setLoading] = useState(true);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const containerRef = useRef(null);
  const hiddenPathRef = useRef(null);
  const [svgPathPoints, setSvgPathPoints] = useState([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [animProgress, setAnimProgress] = useState(0);

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
    setAnimProgress(0);
    let start = null;
    const duration = 2500;
    let animationFrameId;

    const animate = (timestamp) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const t = Math.min(elapsed / duration, 1.0);
      
      const easeOutQuart = 1 - Math.pow(1 - t, 4);
      setAnimProgress(easeOutQuart);

      if (t < 1.0) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [projectId]);

  useEffect(() => {
    if (hiddenPathRef.current) {
      try {
        const len = hiddenPathRef.current.getTotalLength();
        if (len > 0) {
          const points = [];
          const samples = 400;
          for (let i = 0; i <= samples; i++) {
            const pt = hiddenPathRef.current.getPointAtLength((i / samples) * len);
            points.push({ x: pt.x, y: pt.y });
          }
          setSvgPathPoints(points);
        }
      } catch (e) {
        console.error("Failed to extract path length", e);
      }
    }
  }, [dimensions]);

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

  const getCurvePoint = (t) => {
    if (!svgPathPoints || svgPathPoints.length === 0) {
      const y = dimensions.height * 0.95 - t * dimensions.height * 0.9;
      return { x: dimensions.width / 2, y, depthFactor: 1.0, yProgress: t };
    }

    const maxIdx = svgPathPoints.length - 1;
    const exactIdx = t * maxIdx;
    const idx1 = Math.floor(exactIdx);
    const idx2 = Math.min(maxIdx, idx1 + 1);
    const fraction = exactIdx - idx1;

    const p1 = svgPathPoints[idx1];
    const p2 = svgPathPoints[idx2];

    const rawX = p1.x + (p2.x - p1.x) * fraction;
    const rawY = p1.y + (p2.y - p1.y) * fraction;

    const scaleX = dimensions.width / 841.89;
    const scaleY = dimensions.height / 595.28;

    const x = rawX * scaleX;
    const y = rawY * scaleY;

    const depthFactor = 1.0 - Math.pow(t, 0.6) * 0.85; 

    return { x, y, depthFactor, yProgress: t };
  };

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

    // Drop line logic
    const t = count <= 1 ? 0 : i / (count - 1);
    const curve = getCurvePoint(t);
    
    const pt1 = getCurvePoint(Math.max(0, t - 0.01));
    const pt2 = getCurvePoint(Math.min(1, t + 0.01));
    let isLeft = pt2.x > pt1.x;

    // Bounds checking to prevent clipping
    const contentWidth = 340; // 320px width + padding
    if (curve.x < contentWidth) {
      isLeft = false; // Force right
    } else if (curve.x > dimensions.width - contentWidth) {
      isLeft = true; // Force left
    }

    const dropLength = 60 + (i % 3) * 20; 
    const textY = curve.y + dropLength;

    return { ...curve, textY, isLeft, dropLength, t, ...m };
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
    let previewDPath = "";
    let combinedPathD = "";
    let activeClipY = dimensions.height;
    const gradientStops = [];
    const gradientId = preview
      ? `timeline-gradient-hz-${projectId}`
      : `timeline-gradient-vt-${projectId}`;

    const getColor = (status) => {
      if (status === "completed") return projectColor;
      if (status === "in_progress") return "#e0f2fe"; // brighter glowing cyan
      return "rgba(0, 198, 230, 0.2)";
    };

    if (points.length === 0) {
      return { previewDPath, combinedPathD, gradientStops, gradientId, activeClipY };
    }

    if (preview) {
      const p0 = points[0];
      const pLast = points[points.length - 1];
      const c1x = p0.x + (pLast.x - p0.x) * 0.3;
      const c1y = p0.y - 40;
      const c2x = p0.x + (pLast.x - p0.x) * 0.7;
      const c2y = pLast.y + 40;
      previewDPath = `M ${p0.x} ${p0.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${pLast.x} ${pLast.y}`;
      gradientStops.push(<stop key="s" offset="0%" stopColor={projectColor} stopOpacity="0.8" />);
      gradientStops.push(<stop key="e" offset="100%" stopColor="#60a5fa" stopOpacity="0.8" />);
    } else {
      const activeTList = points.filter(p => p.status === 'completed' || p.status === 'in_progress').map(p => p.t);
      const activeT = activeTList.length > 0 ? Math.max(...activeTList) : -1;
      
      if (activeT >= 0) {
        const pt = getCurvePoint(activeT);
        activeClipY = pt.y;
      }

      combinedPathD = "M205.27,494.02c81.79-18.18,305.44-71.84,352.04-136.57c5.26-7.59,8.28-17.02,5.61-26.05c-6.07-18.38-22.58-31.13-38.83-40.6c-52.07-28.43-111.88-36.68-168.31-52.96c-25.59-7.78-76.46-21.62-40.79-53.9c10.63-10.36,23.09-18.81,36-26.03c30.39-16.52,63.78-26.85,97.42-34.29c19.26-4.17,38.74-7.48,58.36-9.44c-19.59,2.12-39.03,5.59-58.25,9.93c-33.51,7.72-66.7,18.28-96.86,35c-12.71,7.27-25.04,15.76-35.44,26.08c-7.24,6.81-16.33,17.71-8.68,27.41c9.74,12.14,34.11,18.41,48.93,22.84c56.81,15.84,117.02,23.68,169.61,51.88c19.52,10.72,47.55,33.51,41.57,58.61c-10.27,41.46-95.94,74.77-133.31,89.51c-74.03,27.85-150.34,48.74-227.37,66.41C206.94,501.85,205.27,494.02,205.27,494.02L205.27,494.02z";

      gradientStops.push(<stop key="start" offset="0%" stopColor={getColor("pending")} />);
      gradientStops.push(<stop key="mid" offset="50%" stopColor={getColor("in_progress")} />);
      gradientStops.push(<stop key="end" offset="100%" stopColor={getColor("completed")} />);
    }
    return { previewDPath, combinedPathD, gradientStops, gradientId, activeClipY };
  };

  const { previewDPath, combinedPathD, gradientStops, gradientId, activeClipY } = generateMasterPath();

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
            <feGaussianBlur stdDeviation="3" result="blur" />
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
              y1={preview ? "0" : "595.28"}
              x2={preview ? dimensions.width : "0"}
              y2={preview ? "0" : "0"}
            >
              {gradientStops}
            </linearGradient>
          )}

          <clipPath id={`active-clip-${projectId}`}>
            <rect 
              x="-500" 
              y={dimensions.height - (dimensions.height - (activeClipY - 50)) * animProgress} 
              width={dimensions.width + 1000} 
              height={(dimensions.height - activeClipY + 100) * animProgress} 
            />
          </clipPath>
        </defs>

        <path
          ref={hiddenPathRef}
          d="M205.27,494.02c81.79-18.18,305.44-71.84,352.04-136.57c5.26-7.59,8.28-17.02,5.61-26.05c-6.07-18.38-22.58-31.13-38.83-40.6c-52.07-28.43-111.88-36.68-168.31-52.96c-25.59-7.78-76.46-21.62-40.79-53.9c10.63-10.36,23.09-18.81,36-26.03c30.39-16.52,63.78-26.85,97.42-34.29c19.26-4.17,38.74-7.48,58.36-9.44"
          style={{ opacity: 0, pointerEvents: "none" }}
        />

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
              <g transform={`scale(${dimensions.width / 841.89}, ${dimensions.height / 595.28})`}>
                <path 
                  d={combinedPathD} 
                  fill={`url(#${gradientId})`} 
                  opacity={0.15} 
                  className="sui-path-base"
                />
              </g>
              
              {activeClipY < dimensions.height && (
                <g clipPath={`url(#active-clip-${projectId})`}>
                  <g transform={`scale(${dimensions.width / 841.89}, ${dimensions.height / 595.28})`}>
                    <path 
                      d={combinedPathD} 
                      fill={projectColor} 
                      filter="url(#glow-effect)" 
                      className="sui-path-glow"
                    />
                  </g>
                </g>
              )}
            </>
          )}
          
          {!preview && points.map((p, i) => (
            <line
              key={`drop-${i}`}
              x1={p.x}
              y1={p.y}
              x2={p.x}
              y2={p.textY}
              stroke={p.status === "completed" ? projectColor : p.status === "in_progress" ? "#e0f2fe" : "rgba(0, 198, 230, 0.2)"}
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
                    ? projectColor
                    : p.status === "in_progress"
                      ? "#e0f2fe"
                      : "#fff",
              }}
              onClick={() => openModal(p)}
            >
              {preview && <div className="sui-exact-dot"></div>}
              
              <div
                className={`sui-exact-content align-drop ${!preview ? 'sui-milestone-box' : ''}`}
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
                {!preview && viewMode === "detailed" && (
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
