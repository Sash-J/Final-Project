import { useEffect, useRef, useState } from "react";
import { projectService } from "../../../services/projectService";
import { validateAddMilestoneForm, validateMilestoneNote } from "../../../utils/validators";
import Icon from "../../../components/common/Icon";
import HoverTooltip from "../../../components/common/HoverTooltip";
import "./AddMilestonePanel.css";

const AddMilestonePanel = ({ 
  projectId, 
  onSuccess, 
  onClose, 
  mode = "add", 
  milestone = null, 
  userRole = "admin", 
  onDelete = null 
}) => {
  const roleNorm = String(userRole || "").trim().toLowerCase().replace(/_/g, " ");
  const isClient = roleNorm === "client";
  const isCrew = roleNorm === "production crew" || roleNorm === "crew";
  const isAdminOrManager = ["admin", "manager", "director", "accountant"].includes(roleNorm);

  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [milestoneAssignee, setMilestoneAssignee] = useState(1); // 1=VD, 0=Client
  const [milestoneStatus, setMilestoneStatus] = useState("pending");
  const [milestoneDesc, setMilestoneDesc] = useState("");
  const [clientNote, setClientNote] = useState("");
  const [pushToSchedule, setPushToSchedule] = useState(false);
  const [milestoneSaving, setMilestoneSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [touched, setTouched] = useState({
    title: false,
    target_date: false,
    description: false,
    note: false,
  });
  const dateRef = useRef(null);

  useEffect(() => {
    if (mode === "edit" && milestone) {
      let formattedDate = "";
      if (milestone.target_date) {
        try {
          const d = new Date(milestone.target_date);
          if (!isNaN(d.getTime())) {
            formattedDate = d.toISOString().split("T")[0];
          } else {
            formattedDate = milestone.target_date.substring(0, 10);
          }
        } catch (e) {
          formattedDate = milestone.target_date.substring(0, 10);
        }
      }

      setMilestoneTitle(milestone.title || "");
      setMilestoneDate(formattedDate);
      setMilestoneAssignee(milestone.is_visiondivision !== undefined ? milestone.is_visiondivision : 1);
      setMilestoneStatus(milestone.status || "pending");
      setMilestoneDesc(milestone.description || "");

      let displayNote = milestone.client_note || "";
      const noteMatch = displayNote.match(/^\[(Admin|Manager|Client|VisionDivision)\]\s*([\s\S]*)$/i);
      if (noteMatch) displayNote = noteMatch[2];
      setClientNote(displayNote);
    }
  }, [mode, milestone]);

  const validationErrors = {
    ...validateAddMilestoneForm(milestoneTitle, milestoneDate, milestoneDesc),
    note: mode === "edit" ? validateMilestoneNote(clientNote) : "",
  };

  const hasErrors = !!(
    validationErrors.title ||
    validationErrors.target_date ||
    validationErrors.description ||
    validationErrors.note
  );

  const handleSaveMilestone = async () => {
    setTouched({ title: true, target_date: true, description: true, note: true });
    setErrorMsg("");
    setSuccessMsg("");

    if (!isClient && hasErrors) {
      setErrorMsg("Please fix the validation errors before submitting.");
      return;
    }

    try {
      setMilestoneSaving(true);

      if (mode === "add") {
        await projectService.createMilestone(projectId, {
          title: milestoneTitle,
          description: milestoneDesc,
          target_date: milestoneDate,
          is_visiondivision: milestoneAssignee,
          status: milestoneStatus,
        });
        setSuccessMsg("Milestone added successfully!");
      } else {
        // Edit mode
        let finalNote = clientNote || "";
        if (finalNote.trim()) {
          let originalNote = milestone.client_note || "";
          let origStripped = originalNote;
          const origMatch = originalNote.match(/^\[(Admin|Manager|Client|VisionDivision)\]\s*([\s\S]*)$/i);
          if (origMatch) origStripped = origMatch[2];

          if (finalNote !== origStripped) {
            const roleTag = isClient ? "Client" : "VisionDivision";
            finalNote = `[${roleTag}] ${finalNote}`;
          } else {
            finalNote = originalNote;
          }
        }

        const payload = { status: milestoneStatus, client_note: finalNote };
        if (!isClient || milestone.is_visiondivision === 0) {
          payload.title = milestoneTitle;
          payload.description = milestoneDesc;
          payload.target_date = milestoneDate;
          payload.is_visiondivision = milestoneAssignee;
        }

        await projectService.updateMilestone(milestone.id, payload);
      }

      if (mode === "add") {
        setMilestoneTitle("");
        setMilestoneDate("");
        setMilestoneDesc("");
        setMilestoneAssignee(1);
        setMilestoneStatus("pending");
        setTouched({ title: false, target_date: false, description: false, note: false });
      }
      
      if (onSuccess) onSuccess();
    } catch (err) {
      setErrorMsg(mode === "add" ? "Failed to add milestone." : "Error saving milestone.");
    } finally {
      setMilestoneSaving(false);
    }
  };

  const renderProvenanceBadge = () => {
    const noteContent = milestone?.client_note || "";
    const origMatch = noteContent.match(/^\[(Admin|Manager|Client|VisionDivision)\]/i);
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
          className={`sui-client-badge sui-client-badge--no-margin provenance-badge role-${roleTag.toLowerCase()}`}
        >
          PROVENANCE: {roleTag}
        </span>
      );
    }
    return null;
  };

  return (
    <>
      <div className="modal-header-section add-milestone-header-row">
        <div className="add-milestone-header-title-block">
          <div>
            <h2>
              {mode === "add" 
                ? "Add Milestone" 
                : isAdminOrManager 
                  ? "Edit Milestone" 
                  : "Milestone Details"}
            </h2>
            <p>
              {mode === "add" 
                ? "Set a new milestone" 
                : "Update a milestone for the timeline"}
            </p>
          </div>
          {!isCrew && !isClient && (
            <HoverTooltip text="Push to schedule" icon="event" style={{ display: "inline-flex" }}>
              <button 
                type="button" 
                className={`btn-morph-sync ${pushToSchedule ? 'synced' : ''}`}
                onClick={() => setPushToSchedule(!pushToSchedule)}
              >
                <div className="sync-icon">
                  <Icon name={pushToSchedule ? "check_circle" : "event"} modifiers="md" />
                </div>
              </button>
            </HoverTooltip>
          )}
        </div>
      </div>
      
      <div className="neo-status-messages">
        <div className={`neo-status error ${errorMsg ? "show" : ""}`}>
          <Icon name="error" modifiers="sm" /> <span>{errorMsg}</span>
        </div>
        <div className={`neo-status success ${successMsg ? "show" : ""}`}>
          <Icon name="check_circle" modifiers="sm" /> <span>{successMsg}</span>
        </div>
      </div>

      {!isClient || mode === "add" ? (
        <>
          <div className="neo-form-group add-milestone-form-top">
            <div className="add-milestone-label-row">
              <label className="neo-label">Title</label>
              <span className="char-counter">{milestoneTitle.length}/25</span>
            </div>
            <input
              type="text"
              className="neo-input" 
              maxLength={25}
              placeholder="e.g. Pre-Production Complete"
              value={milestoneTitle}
              onChange={(e) => {
                setMilestoneTitle(e.target.value);
                setTouched((prev) => ({ ...prev, title: true }));
              }}
            />
            {touched.title && validationErrors.title && (
              <span className="neo-field-error-msg">
                {validationErrors.title}
              </span>
            )}
          </div>

          <div className="add-milestone-panel-row">
            <div className="neo-form-group">
              <label className="neo-label">Target Date</label>
              <div className="icon-field-wrapper">
                <Icon
                  name="calendar_month"
                  modifiers="md"
                  onClick={() => dateRef.current?.showPicker()}
                  style={{ cursor: "pointer", pointerEvents: "auto" }}
                />
                <input
                  type="date"
                  ref={dateRef}
                  className="neo-input"
                  value={milestoneDate}
                  onChange={(e) => {
                    setMilestoneDate(e.target.value);
                    setTouched((prev) => ({ ...prev, target_date: true }));
                  }}
                />
              </div>
              {touched.target_date && validationErrors.target_date && (
                <span className="neo-field-error-msg">
                  {validationErrors.target_date}
                </span>
              )}
            </div>
            <div className="neo-form-group">
              <label className="neo-label">Assignee</label>
              <select
                className="neo-input"
                value={milestoneAssignee}
                onChange={(e) => setMilestoneAssignee(Number(e.target.value))}
              >
                <option value={1}>VisionDivision</option>
                <option value={0}>Client</option>
              </select>
            </div>
            <div className="neo-form-group">
              <label className="neo-label">Status</label>
              <select
                className="neo-input"
                value={milestoneStatus}
                onChange={(e) => setMilestoneStatus(e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="neo-form-group">
            <div className="add-milestone-label-row">
              <label className="neo-label">Description (Optional)</label>
              <span className="char-counter">{milestoneDesc.length}/75</span>
            </div>
            <textarea
              className="neo-input"
              maxLength={75}
              rows="2"
              placeholder="Enter milestone details..."
              value={milestoneDesc}
              onChange={(e) => {
                setMilestoneDesc(e.target.value);
                setTouched((prev) => ({ ...prev, description: true }));
              }}
            />
            {touched.description && validationErrors.description && (
              <span className="neo-field-error-msg">
                {validationErrors.description}
              </span>
            )}
          </div>
        </>
      ) : isCrew ? (
        <div className="sui-milestone-readonly">
          <strong className="sui-milestone-readonly-title">{milestoneTitle}</strong>
          <p className="sui-milestone-readonly-desc">{milestoneDesc}</p>
          <div className="sui-milestone-readonly-status">
            Status: <strong>{milestoneStatus.replace("_", " ").toUpperCase()}</strong>
          </div>
          <div className="sui-milestone-readonly-date">
            Target Date: <strong>{milestoneDate}</strong>
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
          <strong className="sui-milestone-readonly-title">{milestoneTitle}</strong>
          <p className="sui-milestone-readonly-desc">{milestoneDesc}</p>
          <div className="sui-milestone-readonly-status">
            Status: <strong>{milestoneStatus.replace("_", " ").toUpperCase()}</strong>
          </div>
        </div>
      )}

      {mode === "edit" && !isCrew && (
        <div className="neo-form-group">
          <div className="add-milestone-label-row">
            <label className="neo-label add-milestone-label-with-badge">
              Timeline Notes (Optional)
              {renderProvenanceBadge()}
            </label>
            <span className="char-counter">{clientNote.length}/50</span>
          </div>
          <textarea
            className="neo-input"
            maxLength={50}
            rows="2"
            value={clientNote}
            onChange={(e) => {
              setClientNote(e.target.value);
              setTouched((prev) => ({ ...prev, note: true }));
            }}
            placeholder="Add latest update or feedback here..."
          ></textarea>
          {touched.note && validationErrors.note && (
            <span className="neo-field-error-msg">
              {validationErrors.note}
            </span>
          )}
        </div>
      )}

      <div className="add-milestone-panel-actions">
        {mode === "edit" && !isClient && !isCrew && onDelete && (
          <HoverTooltip text="Delete Milestone" style={{ marginRight: "auto" }}>
            <button
              type="button"
              className="btn-neo-cancel btn-milestone-delete"
              onClick={onDelete}
              disabled={milestoneSaving}
            >
              <Icon name="delete" modifiers="sm" />
            </button>
          </HoverTooltip>
        )}
        <button 
          type="button" 
          className="btn-neo-cancel" 
          onClick={onClose}
          disabled={milestoneSaving}
        >
          {mode === "edit" && isCrew ? "Close" : "Cancel"}
        </button>
        {!isCrew && (
          <button
            type="button"
            className="btn-neo btn-neo-solid"
            onClick={handleSaveMilestone}
            disabled={milestoneSaving}
          >
            {milestoneSaving 
              ? (mode === "add" ? "Adding..." : "Saving Changes...") 
              : (mode === "add" ? "Add Milestone" : "Save Changes")
            }
          </button>
        )}
      </div>
    </>
  );
};

export default AddMilestonePanel;
