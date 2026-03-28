import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./SuiTimeline.css";
import GlassDropdown from "../common/GlassDropdown";
import ModalPortal from "../common/ModalPortal";
import ConfirmationModal from "../common/ConfirmationModal";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const SuiTimeline = ({
  projectId,
  userRole,
  preview = false,
  updateTrigger = 0,
  onMilestonesChange,
  onClick,
}) => {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [status, setStatus] = useState("pending");
  const [clientNote, setClientNote] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [isVisionDivision, setIsVisionDivision] = useState(1);

  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const fetchMilestones = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API}/api/projects/${projectId}/milestones`,
        { withCredentials: true },
      );
      setMilestones(res.data);
    } catch (err) {
      console.error("Error fetching milestones", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      console.log("DEBUG: SuiTimeline initialized for project", projectId);
      fetchMilestones();
    }
  }, [projectId, updateTrigger]);

  useEffect(() => {
    const updateDims = () => {
      if (containerRef.current) {
        let { clientWidth, clientHeight } = containerRef.current;
        // If clientHeight is 0 (parent has flex:1 but no set height),
        // fallback to a reasonable percentage of viewport or fixed value
        if (clientHeight < 100) clientHeight = window.innerHeight * 0.6;
        if (clientWidth < 100) clientWidth = 800;

        console.log(
          `DEBUG: Dimensions updated to ${clientWidth}x${clientHeight}`,
        );
        setDimensions({ width: clientWidth, height: clientHeight });
      }
    };
    updateDims();
    // Use a small delay to ensure flex layout has settled
    const timer = setTimeout(updateDims, 300);
    window.addEventListener("resize", updateDims);
    return () => {
      window.removeEventListener("resize", updateDims);
      clearTimeout(timer);
    };
  }, [milestones]);

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
      let finalNote = clientNote || "";
      if (finalNote.trim()) {
        let originalNote = selectedMilestone.client_note || "";
        let origStripped = originalNote;
        const origMatch = originalNote.match(
          /^\[(Admin|Manager|Client|VisionDivision)\]\s*([\s\S]*)$/i,
        );
        if (origMatch) origStripped = origMatch[2];

        // If the user actually changed the text, aggressively stamp it with their role tag
        if (finalNote !== origStripped) {
          const roleTag = userRole === "client" ? "Client" : "VisionDivision";
          finalNote = `[${roleTag}] ${finalNote}`;
        } else {
          // Otherwise securely preserve the original author tag intact during a generic status save
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
      fetchMilestones();
      if (onMilestonesChange) onMilestonesChange();
    } catch (err) {
      alert("Failed to save. Please try again.");
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`${API}/api/milestones/${selectedMilestone.id}`, {
        withCredentials: true,
      });
      setShowDeleteConfirm(false);
      closeModal();
      fetchMilestones();
      if (onMilestonesChange) onMilestonesChange();
    } catch (err) {
      console.error(err);
      alert("Failed to delete. Please try again.");
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

  const points = milestones.map((m, i) => {
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

    const y =
      count === 1
        ? (startY + endY) / 2
        : startY + (i / (count - 1)) * (endY - startY);

    const xOffset = 80; // The curve amplitude
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

  const renderPaths = () => {
    if (points.length === 0) return null;

    const totalDuration = 8; // 12s slower sweep animation

    // Generate continuous D string and percentage stops for the linear gradient
    let dPath = "";
    const gradientStops = [];
    const gradientId = preview
      ? `timeline-gradient-hz-${projectId}`
      : `timeline-gradient-vt-${projectId}`;

    const getColor = (status) => {
      if (status === "completed") return "#00c6e6"; // Blue accent for completed
      if (status === "in_progress") return "#60a5fa"; // Brighter blue for in-progress
      return "transparent";
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

      // Tail
      dPath += ` L ${dimensions.width} ${prevY}`;
      const tailColor = getColor("pending");
      gradientStops.push(
        <stop
          key={`start-tail`}
          offset={`${(prevX / dimensions.width) * 100}%`}
          stopColor={tailColor}
        />,
      );
      gradientStops.push(
        <stop key={`end-tail`} offset={`100%`} stopColor={tailColor} />,
      );
    } else {
      let prevX = dimensions.width * 0.5;
      let prevY = 0;
      dPath += `M ${prevX} ${prevY}`;

      points.forEach((p, i) => {
        const midY = (prevY + p.y) / 2;
        dPath += ` C ${prevX} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
        const startPercent = (prevY / dimensions.height) * 100;
        const endPercent = (p.y / dimensions.height) * 100;
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

      // Tail
      dPath += ` C ${prevX} ${prevY + 50}, ${dimensions.width * 0.5} ${prevY + 50}, ${dimensions.width * 0.5} ${dimensions.height}`;
      const tailColor = getColor("pending");
      gradientStops.push(
        <stop
          key={`start-tail`}
          offset={`${(prevY / dimensions.height) * 100}%`}
          stopColor={tailColor}
        />,
      );
      gradientStops.push(
        <stop key={`end-tail`} offset={`100%`} stopColor={tailColor} />,
      );
    }

    return (
      <>
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2={preview ? dimensions.width : 0}
            y2={preview ? 0 : dimensions.height}
          >
            {gradientStops}
          </linearGradient>
        </defs>
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @keyframes drawMasterPath_${projectId} {
            0% { stroke-dashoffset: 100; opacity: 0; }
            1% { opacity: 1; }
            90% { stroke-dashoffset: 0; opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
          .sui-svg-container path {
            vector-effect: non-scaling-stroke;
          }
        `,
          }}
        />
        {/* Faint center guideline / base track */}
        <path
          className="sui-path-base"
          d={dPath}
          style={{
            fill: "none",
            stroke: "rgba(255, 255, 255, 0.15)",
            strokeWidth: "4px",
            strokeLinecap: "round",
          }}
        />

        {/* Sweeping Colorful Overlay - The glowing lightcycle tracing the road */}
        <path
          className="sui-path-master-glow"
          d={dPath}
          pathLength="100"
          style={{
            fill: "none",
            stroke: `url(#${gradientId})`,
            strokeWidth: "6px",
            strokeLinecap: "round",
            strokeDasharray: "100",
            strokeDashoffset: "100",
            filter: "drop-shadow(0 0 10px currentColor)",
            animation: `drawMasterPath_${projectId} ${totalDuration}s infinite linear`,
          }}
        />
      </>
    );
  };

  if (loading)
    return (
      <div style={{ color: "#fff", textAlign: "center", padding: "20px" }}>
        Mapping Timeline...
      </div>
    );
  if (milestones.length === 0)
    return (
      <div style={{ color: "#a0aec0", textAlign: "center", padding: "20px" }}>
        No milestones mapped.
      </div>
    );

  return (
    <div
      className={`sui-timeline-wrapper sui-fade-in ${preview ? "sui-preview-mode sui-preview-clickable" : ""}`}
      ref={containerRef}
      style={{
        height: "100%",
        minHeight: preview ? "250px" : "600px",
        width: "100%",
        position: "relative",
        background: "rgba(0,0,0,0.1)", // Slight bg to see the area
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
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="glowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff7b00" />
            <stop offset="50%" stopColor="#ffb347" />
            <stop offset="100%" stopColor="#ff7b00" />
          </linearGradient>
        </defs>
        {renderPaths()}
      </svg>

      <div className="sui-milestones-absolute">
        {points.map((p, i) => {
          const isLeft = p.isLeft;
          // Calculate exact pixel boundaries to ensure it never overflows the container
          // increased padding from 40 to 80 to ensure text sits further inside the window margin
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
                cursor: "pointer",
              }}
              onClick={() => openModal(p)}
            >
              <div
                className="sui-exact-dot"
                style={preview ? { width: "12px", height: "12px" } : {}}
              ></div>
              {preview && (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    width: "2px",
                    background:
                      p.status === "completed"
                        ? "#00c6e6"
                        : p.status === "in_progress"
                          ? "#60a5fa"
                          : "rgba(255,255,255,0.4)",
                    height: "35px",
                    [p.isTop ? "bottom" : "top"]: "10px",
                    transform: "translateX(-50%)",
                    opacity: 0.8,
                  }}
                ></div>
              )}
              <div
                className={`sui-exact-content ${!preview ? (p.isLeft ? "align-right" : "align-left") : ""}`}
                style={
                  preview
                    ? {
                        position: "absolute",
                        maxWidth: "150px",
                        whiteSpace: "normal",
                        wordWrap: "break-word",
                        left: "50%",
                        top: p.isTop ? "auto" : "50px",
                        bottom: p.isTop ? "50px" : "auto",
                        transform: `translateX(-50%) scale(${previewTextScale * 0.85})`,
                        transformOrigin: p.isTop
                          ? "bottom center"
                          : "top center",
                        textAlign: "center",
                        pointerEvents: "none",
                      }
                    : {
                        maxWidth: `${availableWidth / textScale}px`,
                        whiteSpace: "normal",
                        wordWrap: "break-word",
                        overflowWrap: "break-word",
                        transform: `translateY(-50%) scale(${textScale})`,
                        transformOrigin: p.isLeft
                          ? "right center"
                          : "left center",
                      }
                }
              >
                <div className="sui-date">[{formatDt(p.target_date)}]</div>
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
                            <span className="sui-note-text">
                              {text}
                            </span>
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
        <ModalPortal>
          <div className="sui-modal-overlay">
            <div className="sui-modal-content sui-modal-small">
              <h3>
                {userRole === "admin" || userRole === "manager"
                  ? "Edit Milestone"
                  : "Milestone Details"}
              </h3>

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
                  <strong className="sui-milestone-readonly-title">
                    {title}
                  </strong>
                  <p className="sui-milestone-readonly-desc">
                    {description}
                  </p>
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
                  <strong className="sui-milestone-readonly-title">
                    {title}
                  </strong>
                  <p className="sui-milestone-readonly-desc">
                    {description}
                  </p>
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
                              background: roleTag === "Client" ? "#2dd4bf" : "#6366f1",
                              color: "#fff",
                              padding: "2px 10px",
                              borderRadius: "4px"
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
                  >
                    Delete
                  </button>
                )}
                <button className="sui-btn sui-btn-cancel" onClick={closeModal}>
                  {userRole === "production_crew" ? "Close" : "Cancel"}
                </button>
                {userRole !== "production_crew" && (
                  <button className="sui-btn sui-btn-save" onClick={handleSave}>
                    Save Changes
                  </button>
                )}
              </div>
            </div>
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
