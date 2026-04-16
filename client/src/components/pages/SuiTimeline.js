import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./SuiTimeline.css";
import Icon from "../common/Icon";
import GlassDropdown from "../common/GlassDropdown";
import ModalPortal from "../common/ModalPortal";
import ConfirmationModal from "../common/ConfirmationModal";

import { API } from "../../config";
import { useProjects } from "../../contexts/ProjectContext";

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
  const [saving, setSaving] = useState(false);

  // Form state
  const [status, setStatus] = useState("pending");
  const [clientNote, setClientNote] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [isVisionDivision, setIsVisionDivision] = useState(1);

  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const fetchMilestones = async (force = false) => {
    setLoading(true);
    await getProjectMilestones(projectId, force);
    setLoading(false);
  };

  useEffect(() => {
    if (projectId) {
      console.log("DEBUG: SuiTimeline initialized for project", projectId);
      // Only force fetch if updateTrigger is > 0 (meaning something external triggered an update)
      // Otherwise rely on the context's internal caching logic via getProjectMilestones(projectId, false)
      fetchMilestones(updateTrigger > 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, updateTrigger]);

  useEffect(() => {
    const updateDims = () => {
      if (containerRef.current) {
        let { clientWidth } = containerRef.current;
        if (clientWidth < 100) clientWidth = 800;

        // Sourced from openAI
        // Proportional height calculation: 3 milestones per 540px viewport (~180px per milestone)
        // This ensures the timeline always has vertical "room" to scroll
        const itemHeight = 180;
        const totalHeight = Math.max(540, milestones.length * itemHeight);

        console.log(
          `DEBUG: Proportional Dimensions updated to ${clientWidth}x${totalHeight} (${milestones.length} nodes)`,
        );
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
  }, [milestones]);

  // Auto-scroll to bottom (inception point) on load
  useEffect(() => {
    if (!loading && containerRef.current && !preview) {
      // Small delay to ensure browser layout is stable
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
    let formattedDate = "";
    if (m.target_date) {
      try {
        const d = new Date(m.target_date);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toISOString().split("T")[0];
        } else {
          formattedDate = m.target_date.substring(0, 10);
        }
      } catch (e) {
        formattedDate = m.target_date.substring(0, 10);
      }
    }

    setSelectedMilestone(m);
    setStatus(m.status);

    // Strip out internal attribution tag when editing so the user only sees their raw text
    let displayNote = m.client_note || "";
    const noteMatch = displayNote.match(
      /^\[(Admin|Manager|Client|VisionDivision)\]\s*([\s\S]*)$/i,
    );
    if (noteMatch) displayNote = noteMatch[2];
    setClientNote(displayNote);

    setTitle(m.title || "");
    setDescription(m.description || "");
    setTargetDate(formattedDate);
    setIsVisionDivision(
      m.is_visiondivision !== undefined ? m.is_visiondivision : 1,
    );
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedMilestone(null);
    setIsModalOpen(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !targetDate) {
      alert("Title and Target Date are required.");
      return;
    }
    try {
      setSaving(true);
      let finalNote = clientNote || "";
      if (finalNote.trim()) {
        let originalNote = selectedMilestone.client_note || "";
        let origStripped = originalNote;
        const origMatch = originalNote.match(
          /^\[(Admin|Manager|Client|VisionDivision)\]\s*([\s\S]*)$/i,
        );
        if (origMatch) origStripped = origMatch[2];

        if (finalNote !== origStripped) {
          const roleTag = userRole === "client" ? "Client" : "VisionDivision";
          finalNote = `[${roleTag}] ${finalNote}`;
        } else {
          finalNote = originalNote;
        }
      }

      const payload = { status, client_note: finalNote };
      if (userRole !== "client" || selectedMilestone.is_visiondivision === 0) {
        payload.title = title;
        payload.description = description;
        payload.target_date = targetDate;
        payload.is_visiondivision = isVisionDivision;
      }

      await axios.put(
        `${API}/api/milestones/${selectedMilestone.id}`,
        payload,
        { withCredentials: true },
      );
      closeModal();
      fetchMilestones(true); // Force re-fetch on save
      if (onMilestonesChange) onMilestonesChange();
    } catch (err) {
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      setSaving(true);
      await axios.delete(`${API}/api/milestones/${selectedMilestone.id}`, {
        withCredentials: true,
      });
      setShowDeleteConfirm(false);
      closeModal();
      fetchMilestones(true); // Force re-fetch on delete
      if (onMilestonesChange) onMilestonesChange();
    } catch (err) {
      console.error(err);
      alert("Failed to delete. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Prepare point coordinates
  const count = milestones.length;
  const startY = 80; // Increased padding to prevent first milestone overflow
  const endY = dimensions.height - 100; // Increased padding to prevent last milestone overflow
  const totalVerticalSpace = Math.max(0, endY - startY);
  // Determine strict scaling factor so text boxes do not push into each other vertically
  const spacePerNode =
    count > 1 ? totalVerticalSpace / (count - 1) : totalVerticalSpace;
  const textScale = Math.min(1, spacePerNode / 120);

  const hSpacePerNode =
    count > 1 ? (dimensions.width - 120) / (count - 1) : dimensions.width;
  const previewTextScale = Math.min(1, hSpacePerNode / 120);

  // Sort milestones chronologically (Oldest first) to ensure consistent Story flow
  const sortedMilestones = [...milestones].sort((a, b) => {
    const dateA = new Date(a.target_date || 0);
    const dateB = new Date(b.target_date || 0);
    return dateA - dateB;
  });
  const points = sortedMilestones.map((m, i) => {
    if (preview) {
      const startX = 60;
      const endX = dimensions.width - 60;
      const x =
        count === 1
          ? (startX + endX) / 2
          : startX + (i / (count - 1)) * (endX - startX);
      const y = dimensions.height / 2;
      return { x, y, isTop: i % 2 === 0, ...m };
    }

    // Correct vertical mapping for Bottom-to-Top Story flow:
    // i=0 (First Milestone) maps to endY (Bottom)
    // i=N-1 (Last Milestone) maps to startY (Top)
    const y =
      count === 1
        ? (startY + endY) / 2
        : endY - (i / (count - 1)) * (endY - startY);

    const xOffset = 120; // Increased curve amplitude for a more dramatic Story flow
    const isLeft = i % 2 === 0;
    const x = isLeft
      ? dimensions.width * 0.5 - xOffset
      : dimensions.width * 0.5 + xOffset;

    return { x, y, isLeft, ...m };
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

  // Prepare Master Path and Gradient data for the SVG
  const generateMasterPath = () => {
    if (points.length === 0)
      return { dPath: "", gradientStops: [], gradientId: "" };

    let dPath = "";
    let glowDPath = "";
    const gradientStops = [];
    const gradientId = preview
      ? `timeline-gradient-hz-${projectId}`
      : `timeline-gradient-vt-${projectId}`;

    const getColor = (status) => {
      if (status === "completed") return "#00c6e6";
      if (status === "in_progress") return "#60a5fa";
      return "rgba(96, 165, 250, 0.4)";
    };

    if (preview) {
      let prevX = 0;
      let prevY = dimensions.height / 2;
      dPath += `M ${prevX} ${prevY}`;

      points.forEach((p, i) => {
        dPath += ` L ${p.x} ${p.y}`;
        const startPercent = (prevX / dimensions.width) * 100;
        const endPercent = (p.x / dimensions.width) * 100;
        const color = getColor(p.status);
        gradientStops.push(
          <stop
            key={`start-${i}`}
            offset={`${startPercent}%`}
            stopColor={color}
          />,
        );
        gradientStops.push(
          <stop key={`end-${i}`} offset={`${endPercent}%`} stopColor={color} />,
        );
        prevX = p.x;
        prevY = p.y;
      });
      dPath += ` L ${dimensions.width} ${prevY}`;
      gradientStops.push(
        <stop
          key={`start-tail`}
          offset={`${(prevX / dimensions.width) * 100}%`}
          stopColor={getColor("pending")}
        />,
      );
      gradientStops.push(
        <stop
          key={`end-tail`}
          offset={`100%`}
          stopColor={getColor("pending")}
        />,
      );
    } else {
      let prevX = dimensions.width * 0.5;
      let prevY = dimensions.height;
      dPath += `M ${prevX} ${prevY}`;

      points.forEach((p, i) => {
        const midY = (prevY + p.y) / 2;
        const segment = ` C ${prevX} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
        dPath += segment;

        // Only add to the glowing path if it's not a future/pending milestone
        // We allow the glow to reach the latest active milestone
        if (p.status === "completed" || p.status === "in_progress") {
          glowDPath = dPath;
        }

        const startPercent = 100 - (prevY / dimensions.height) * 100;
        const endPercent = 100 - (p.y / dimensions.height) * 100;
        const color = getColor(p.status);
        gradientStops.push(
          <stop
            key={`start-${i}`}
            offset={`${startPercent}%`}
            stopColor={color}
          />,
        );
        gradientStops.push(
          <stop key={`end-${i}`} offset={`${endPercent}%`} stopColor={color} />,
        );
        prevX = p.x;
        prevY = p.y;
      });

      // Tail (pointing to the future/top) - Extends the path toward infinity
      const futureExtend = -300;
      dPath += ` C ${prevX} ${prevY - 100}, ${dimensions.width * 0.5} ${prevY - 100}, ${dimensions.width * 0.5} ${futureExtend}`;

      const tailColor = getColor("pending");
      gradientStops.push(
        <stop
          key={`start-tail`}
          offset={`${100 - (prevY / dimensions.height) * 100}%`}
          stopColor={tailColor}
        />,
      );
      gradientStops.push(
        <stop key={`end-tail`} offset={`100%`} stopColor={tailColor} />,
      );
    }
    return { dPath, glowDPath, gradientStops, gradientId };
  };

  const { dPath, glowDPath, gradientStops, gradientId } = generateMasterPath();
  const totalDuration = 4.5;

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
      {preview && (
        <div className="sui-preview-overlay">
          <span>View full timeline</span>
        </div>
      )}
      <svg
        className="sui-svg-container"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      >
        <defs>
          <filter id="glow-effect" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
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
              y1={preview ? 0 : dimensions.height}
              x2={preview ? dimensions.width : 0}
              y2={0}
            >
              {gradientStops}
            </linearGradient>
          )}
        </defs>
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @keyframes drawMasterPath_${projectId} {
            0% { stroke-dashoffset: 100; opacity: 0; }
            5% { opacity: 1; }
            95% { opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
          .sui-svg-container path {
            vector-effect: none;
          }
        `,
          }}
        />
        <path className="sui-path-base" d={dPath} />

        {glowDPath && (
          <path
            className="sui-path-master-glow"
            d={glowDPath}
            pathLength="100"
            style={{
              stroke: `url(#${gradientId})`,
              animation: `drawMasterPath_${projectId} ${totalDuration}s infinite ease-in-out`,
            }}
          />
        )}
      </svg>

      <div className="sui-milestones-absolute">
        {points.map((p, i) => {
          const isLeft = p.isLeft;
          // Calculate exact pixel boundaries to ensure it never overflows the container
          const availableWidth = isLeft
            ? p.x - 100
            : dimensions.width - p.x - 100;

          return (
            <div
              key={p.id}
              className={`sui-absolute-item sui-status-${p.status}`}
              style={{
                top: p.y,
                left: p.x,
                "--dot-shadow":
                  p.status === "completed"
                    ? "#00c6e6"
                    : p.status === "in_progress"
                      ? "#60a5fa"
                      : "#fff",
              }}
              onClick={() => openModal(p)}
            >
              <div className="sui-exact-dot"></div>
              {preview && (
                <div
                  className="sui-preview-connector"
                  style={{
                    background:
                      p.status === "completed"
                        ? "#00c6e6"
                        : p.status === "in_progress"
                          ? "#60a5fa"
                          : "rgba(255,255,255,0.4)",
                    [p.isTop ? "bottom" : "top"]: "10px",
                  }}
                ></div>
              )}
              <div
                className={`sui-exact-content ${!preview ? (p.isLeft ? "align-right" : "align-left") : ""}`}
                style={
                  preview
                    ? {
                        top: p.isTop ? "auto" : "50px",
                        bottom: p.isTop ? "50px" : "auto",
                        transform: `translateX(-50%) scale(${previewTextScale * 0.85})`,
                        transformOrigin: p.isTop
                          ? "bottom center"
                          : "top center",
                      }
                    : {
                        maxWidth: `${availableWidth / textScale}px`,
                        transform: `translateY(-50%) scale(${textScale})`,
                        transformOrigin: p.isLeft
                          ? "right center"
                          : "left center",
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
                          // Map Admin/Manager to VisionDivision for the badge text
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
        <ModalPortal onClose={closeModal}>
          <div className="modal-header-section">
            <h3>
              {userRole === "admin" || userRole === "manager"
                ? "Edit Milestone"
                : "Milestone Details"}
            </h3>
          </div>

          {userRole !== "client" ? (
            <>
              <div className="sui-form-group">
                <label>Title</label>
                <input
                  type="text"
                  className="sui-form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  required
                />
              </div>
              <div className="sui-form-group">
                <label>Description (Optional)</label>
                <textarea
                  className="sui-form-control"
                  rows="2"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter milestone details..."
                ></textarea>
              </div>

              <div className="sui-form-row">
                <div className="sui-form-col">
                  <div className="sui-form-group">
                    <label>Target Date</label>
                    <input
                      type="date"
                      className="sui-form-control"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      required
                    />
                  </div>
                </div>
                <div className="sui-form-col">
                  <div className="sui-form-group">
                    <label>Assignee</label>
                    <GlassDropdown
                      options={[
                        { value: 1, label: "VisionDivision" },
                        { value: 0, label: "Client" },
                      ]}
                      value={isVisionDivision}
                      onChange={(val) => setIsVisionDivision(val)}
                      placeholder="Select..."
                    />
                  </div>
                </div>
              </div>

              <div className="sui-form-group">
                <label>Status</label>
                <GlassDropdown
                  options={[
                    { value: "pending", label: "Pending" },
                    { value: "in_progress", label: "In Progress" },
                    { value: "completed", label: "Completed" },
                  ]}
                  value={status}
                  onChange={(val) => setStatus(val)}
                  placeholder="Select Status..."
                />
              </div>
            </>
          ) : userRole === "production_crew" ? (
            <div className="sui-milestone-readonly">
              <strong className="sui-milestone-readonly-title">{title}</strong>
              <p className="sui-milestone-readonly-desc">{description}</p>
              <div className="sui-milestone-readonly-status">
                Status:{" "}
                <strong>{status.replace("_", " ").toUpperCase()}</strong>
              </div>
              <div className="sui-milestone-readonly-date">
                Target Date: <strong>{targetDate}</strong>
              </div>
              {clientNote && (
                <div className="sui-milestone-readonly-notes">
                  <span className="sui-milestone-notes-label">Notes: </span>
                  {clientNote}
                </div>
              )}
            </div>
          ) : (
            <div className="sui-milestone-readonly">
              <strong className="sui-milestone-readonly-title">{title}</strong>
              <p className="sui-milestone-readonly-desc">{description}</p>
              <div className="sui-milestone-readonly-status">
                Status:{" "}
                <strong>{status.replace("_", " ").toUpperCase()}</strong>
              </div>
            </div>
          )}
          {userRole !== "production_crew" && (
            <div className="sui-form-group">
              <label className="sui-label-flex">
                Timeline Notes (Optional)
                {(() => {
                  const noteContent = selectedMilestone?.client_note || "";
                  const origMatch = noteContent.match(
                    /^\[(Admin|Manager|Client|VisionDivision)\]/i,
                  );
                  if (origMatch) {
                    const rawTag = origMatch[1];
                    const roleTag =
                      rawTag.toLowerCase() === "admin" ||
                      rawTag.toLowerCase() === "manager" ||
                      rawTag.toLowerCase() === "visiondivision"
                        ? "VisionDivision"
                        : "Client";
                    return (
                      <span
                        className="sui-client-badge sui-client-badge--no-margin"
                        style={{
                          background:
                            roleTag === "Client" ? "#2dd4bf" : "#6366f1",
                          color: "#fff",
                          padding: "2px 10px",
                          borderRadius: "4px",
                        }}
                      >
                        PROVENANCE: {roleTag}
                      </span>
                    );
                  }
                  return null;
                })()}
              </label>
              <textarea
                className="sui-form-control"
                rows="3"
                value={clientNote}
                onChange={(e) => setClientNote(e.target.value)}
                placeholder="Add latest update or feedback here..."
              ></textarea>
            </div>
          )}
          <div className="sui-modal-actions">
            {userRole !== "client" && userRole !== "production_crew" && (
              <button
                className="sui-btn sui-btn-delete"
                onClick={handleDelete}
                disabled={saving}
              >
                Delete
              </button>
            )}
            <button
              className="sui-btn sui-btn-cancel"
              onClick={closeModal}
              disabled={saving}
            >
              {userRole === "production_crew" ? "Close" : "Cancel"}
            </button>
            {userRole !== "production_crew" && (
              <button
                className="sui-btn sui-btn-save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving Changes..." : "Save Changes"}
              </button>
            )}
          </div>
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
