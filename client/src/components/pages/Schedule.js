import React, { useState, useEffect, useCallback } from "react";
import { useBlocker } from "react-router-dom";
import PageHeader from "../common/PageHeader";
import "./Schedule.css";
import ModalPortal from "../common/ModalPortal";
import Icon from "../common/Icon";
import html2pdf from "html2pdf.js";
import { API } from "../../config";

// Sri Lankan Public Holidays 2026 (Hardcoded for simplicity)
const SRI_LANKA_HOLIDAYS_2026 = [
  { date: "2026-01-03", name: "Duruthu Full Moon Poya Day (M)" },
  { date: "2026-01-15", name: "Tamil Thai Pongal Day (M)" },
  { date: "2026-02-01", name: "Navam Full Moon Poya Day (M)" },
  { date: "2026-02-04", name: "Independence Day (M)" },
  { date: "2026-02-15", name: "Mahasivarathri Day (Bank Holiday)" },
  { date: "2026-03-02", name: "Medin Full Moon Poya Day (M)" },
  { date: "2026-03-21", name: "Id-Ul-Fitr (Ramazan)" },
  { date: "2026-04-01", name: "Bak Full Moon Poya Day (M)" },
  { date: "2026-04-03", name: "Good Friday (Bank Holiday)" },
  { date: "2026-04-13", name: "Day prior to Sinhala & Tamil New Year (M)" },
  { date: "2026-04-14", name: "Sinhala & Tamil New Year Day (M)" },
  { date: "2026-05-01", name: "May Day / Vesak Full Moon Poya Day (M)" },
  { date: "2026-05-02", name: "Day following Vesak Poya (M)" },
  { date: "2026-05-29", name: "Id-Ul-Allah (Hadji)" },
  { date: "2026-05-30", name: "Adhi Poson Full Moon Poya Day (M)" },
  { date: "2026-06-29", name: "Poson Full Moon Poya Day (M)" },
  { date: "2026-07-29", name: "Esala Full Moon Poya Day (M)" },
  { date: "2026-08-26", name: "Milad-un-Nabi (Holy Prophet's Birthday) (M)" },
  { date: "2026-08-27", name: "Nikini Full Moon Poya Day (M)" },
  { date: "2026-09-26", name: "Binara Full Moon Poya Day (M)" },
  { date: "2026-10-25", name: "Vap Full Moon Poya Day (M)" },
  { date: "2026-11-08", name: "Deepavali Festival Day (M)" },
  { date: "2026-11-24", name: "Ill Full Moon Poya Day (M)" },
  { date: "2026-12-23", name: "Unduwap Full Moon Poya Day (M)" },
  { date: "2026-12-25", name: "Christmas Day (M)" },
];

const DEFAULT_TASK_COLOR = "#a78bfa";

const Schedule = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [originalTasks, setOriginalTasks] = useState([]);
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);

  // Selected state
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [notes, setNotes] = useState([]);

  // Forms
  const [taskForm, setTaskForm] = useState({
    id: null,
    title: "",
    description: "",
    project_id: "",
    task_color: DEFAULT_TASK_COLOR,
  });
  const [noteText, setNoteText] = useState("");

  const viewMonth = currentDate.getMonth();
  const viewYear = currentDate.getFullYear();

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMonth, viewYear]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      const proceed = window.confirm(
        "You have unsaved schedule edits. Are you sure you want to leave and discard changes?"
      );
      if (proceed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API}/api/me`, { credentials: "include" });
      const data = await res.json();
      if (data.logged_in) {
        setUser(data.user);
      }
    } catch (err) {
      console.error("Error fetching user:", err);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(
        `${API}/api/schedule/tasks?year=${viewYear}&month=${viewMonth + 1}`,
        { credentials: "include" }
      );
      const data = await res.json();
      const taskArray = Array.isArray(data) ? data : [];
      setTasks(taskArray);
      setOriginalTasks(taskArray);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch(`${API}/api/projects`, { credentials: "include" });
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const fetchNotes = async (taskId) => {
    try {
      const res = await fetch(`${API}/api/schedule/tasks/${taskId}/notes`, { credentials: "include" });
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching notes:", err);
    }
  };

  const handleSubmitTask = (e) => {
    e.preventDefault();
    const isEditing = !!taskForm.id;
    
    let updatedTasks;
    if (isEditing) {
      updatedTasks = tasks.map((t) =>
        t.id === taskForm.id ? { ...t, ...taskForm, task_date: selectedDate } : t
      );
    } else {
      const newTask = {
        ...taskForm,
        id: `temp-${Date.now()}`,
        task_date: selectedDate,
        creator_name: user?.username || "You",
        project_name: projects.find(p => String(p.id) === String(taskForm.project_id))?.project_name || ""
      };
      updatedTasks = [...tasks, newTask];
    }

    setTasks(updatedTasks);
    setHasUnsavedChanges(true);
    setTaskForm({
      id: null,
      title: "",
      description: "",
      project_id: "",
      task_color: DEFAULT_TASK_COLOR,
    });
    setShowTaskModal(false);
  };

  const handleDeleteTask = (taskId) => {
    if (!window.confirm("Remove this task from local schedule?")) return;
    const updatedTasks = tasks.filter((t) => t.id !== taskId);
    setTasks(updatedTasks);
    setHasUnsavedChanges(true);
    if (selectedTask && selectedTask.id === taskId) {
      setShowNotesModal(false);
    }
  };

  const handleMasterSave = async () => {
    setSubmitting(true);
    try {
      // Sanitize task_date to YYYY-MM-DD for all tasks before saving
      const sanitizedTasks = tasks.map(t => {
        const d = new Date(t.task_date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return { 
          ...t, 
          task_date: `${y}-${m}-${day}` 
        };
      });

      const response = await fetch(`${API}/api/schedule/bulk-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          year: viewYear,
          month: viewMonth + 1,
          tasks: sanitizedTasks,
        }),
      });
      if (response.ok) {
        fetchTasks();
      } else {
        const data = await response.json();
        alert(`Error saving: ${data.error}`);
      }
    } catch (err) {
      console.error("Master save error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscardChanges = () => {
    if (window.confirm("Discard all unsaved edits for this month?")) {
      setTasks(originalTasks);
      setHasUnsavedChanges(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/schedule/tasks/${selectedTask.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note_text: noteText }),
      });
      if (res.ok) {
        setNoteText("");
        fetchNotes(selectedTask.id);
      }
    } catch (err) {
      console.error("Error adding note:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenTaskModal = (dateStr, taskToEdit = null) => {
    if (user?.role !== "admin" && user?.role !== "manager") return;
    setSelectedDate(dateStr);
    if (taskToEdit) {
      setTaskForm({
        id: taskToEdit.id,
        title: taskToEdit.title,
        description: taskToEdit.description || "",
        project_id: taskToEdit.project_id || "",
        task_color: taskToEdit.task_color || "#00c6e6",
      });
    } else {
      setTaskForm({
        id: null,
        title: "",
        description: "",
        project_id: "",
        task_color: DEFAULT_TASK_COLOR,
      });
    }
    setShowTaskModal(true);
  };

  const openNotesModal = (task) => {
    if (String(task.id).startsWith("temp")) {
      alert("Please save the schedule before viewing or adding notes to new tasks.");
      return;
    }
    setSelectedTask(task);
    fetchNotes(task.id);
    setShowNotesModal(true);
  };

  // Get date in Sri Jayawardhenapura Kotte (Asia/Colombo)
  const getSJLTime = () => {
    const now = new Date();
    return new Date(now.toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
  };

  const today = getSJLTime();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  // Adjust to start from Monday (0: Mon, 1: Tue, ..., 6: Sun)
  const mondayFirstOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const isTaskUnsaved = useCallback((task) => {
    // Check if task is new (temp ID)
    if (String(task.id).startsWith("temp")) return true;
    
    // Check if task was modified (different from its version in originalTasks)
    const original = originalTasks.find(o => o.id === task.id);
    if (!original) return false;

    return (
      task.title !== original.title ||
      task.description !== (original.description || "") ||
      task.project_id !== original.project_id ||
      task.task_color !== original.task_color ||
      task.task_date !== original.task_date
    );
  }, [originalTasks]);

  const handleGoToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDownloadPDF = () => {
    const element = document.querySelector(".calendar-window");
    if (!element) return;

    // Create a clone to modify for PDF without affecting UI
    const clone = element.cloneNode(true);

    // Remove navigation buttons from clone
    const navButtons = clone.querySelectorAll(
      ".cal-nav-btn, .today-btn, .download-pdf-btn",
    );
    navButtons.forEach((btn) => btn.remove());

    const opt = {
      margin: 10,
      filename: `Schedule_${monthNames[viewMonth]}_${viewYear}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#0a0a0a", // Match the dark theme background
      },
      jsPDF: { unit: "mm", format: [400, 400], orientation: "landscape" },
      pagebreak: { mode: "avoid-all" },
    };

    html2pdf().set(opt).from(clone).save();
  };

  const renderCells = () => {
    const cells = [];
    const holidays = SRI_LANKA_HOLIDAYS_2026;

    // Empty cells for first week offset (Monday start)
    for (let i = 0; i < mondayFirstOffset; i++) {
      cells.push(
        <div key={`empty-${i}`} className="calendar-cell empty"></div>,
      );
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const holiday = holidays.find((h) => h.date === dateStr);
      const isToday = todayStr === dateStr;

      const dayTasks = tasks.filter((t) => {
        // Robustly parse the task date to YYYY-MM-DD format
        try {
          const d = new Date(t.task_date);
          if (isNaN(d.getTime())) return false;

          // Format as YYYY-MM-DD for comparison with dateStr
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const dayNum = String(d.getDate()).padStart(2, "0");
          const normalizedTaskDate = `${y}-${m}-${dayNum}`;

          return normalizedTaskDate === dateStr;
        } catch (e) {
          console.error("Date parsing error for task:", t, e);
          return false;
        }
      });

      // Calculate day of week (0=Mon, ..., 6=Sun)
      const dayOfWeek = (mondayFirstOffset + day - 1) % 7;
      const isSunday = dayOfWeek === 6;

      cells.push(
        <div
          key={day}
          className={`calendar-cell ${isToday ? "today" : ""} ${holiday ? "holiday" : ""} ${isSunday ? "sunday" : ""}`}
        >
          <div className="calendar-cell-header">
            <span className="day-number">{day}</span>
            {(user?.role === "admin" || user?.role === "manager") && (
              <button
                className="add-task-btn"
                onClick={() => handleOpenTaskModal(dateStr)}
                title="Add task to this date"
              >
                +
              </button>
            )}
          </div>

          {holiday && (
            <div className="holiday-strip" title={holiday.name}>
              {holiday.name}
            </div>
          )}

          <div className="calendar-tasks">
            {dayTasks.map((task) => (
              <div
                key={task.id}
                className={`task-item ${isTaskUnsaved(task) ? "is-unsaved" : ""}`}
                style={{
                  borderLeftColor: task.task_color || "#a78bfa",
                  backgroundColor: `${task.task_color || "#a78bfa"}33`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  openNotesModal(task);
                }}
              >
                <span className="task-item-title">{task.title}</span>
              </div>
            ))}
          </div>
        </div>,
      );
    }

    return cells;
  };

  return (
    <div className="schedule-container">
      <PageHeader title="Production Schedule" />

      {hasUnsavedChanges && (
        <div className="unsaved-changes-bar">
          <div className="unsaved-info">
            <Icon name="warning" modifiers="sm" />
            <span>You have unsaved schedule edits for this month.</span>
          </div>
          <div className="unsaved-actions">
            <button className="sui-btn discard-btn" onClick={handleDiscardChanges}>
              Discard Changes
            </button>
            <button className="sui-btn save-all-btn" onClick={handleMasterSave} disabled={submitting}>
              {submitting ? "Saving..." : "Save All Updates"}
            </button>
          </div>
        </div>
      )}

      <div className="schedule-content-animated">
        <div className="schedule-main-content">
        <div className="calendar-window grid-window">
          <div className="calendar-controls">
            <button onClick={handlePrevMonth} className="cal-nav-btn">
              {"<"}
            </button>
            <div className="current-month-display">
              {monthNames[viewMonth]} {viewYear}
            </div>
            <button onClick={handleNextMonth} className="cal-nav-btn">
              {">"}
            </button>
            <button onClick={handleGoToToday} className="today-btn">
              Today
            </button>
            {(user?.role === "admin" || user?.role === "manager") && (
              <button
                onClick={handleDownloadPDF}
                className="download-pdf-btn"
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Icon name="download" modifiers="sm" />
                Download PDF
              </button>
            )}
          </div>

          <div className="calendar-grid">
            <div className="calendar-day-label">Mon</div>
            <div className="calendar-day-label">Tue</div>
            <div className="calendar-day-label">Wed</div>
            <div className="calendar-day-label">Thu</div>
            <div className="calendar-day-label">Fri</div>
            <div className="calendar-day-label">Sat</div>
            <div className="calendar-day-label">Sun</div>
            {renderCells()}
          </div>
        </div>

        <div className="schedule-sidebar grid-window">
          <div className="sidebar-header">
            <h3>Monthly Tasks</h3>
            <span className="task-count">{tasks.length} Total</span>
          </div>
          <div className="sidebar-task-list">
            {[...tasks]
              .sort((a, b) => new Date(a.task_date) - new Date(b.task_date))
              .map((task) => {
                const date = new Date(task.task_date);
                return (
                  <div
                    className={`sidebar-task-card ${isTaskUnsaved(task) ? "is-unsaved" : ""}`}
                    key={task.id}
                    onClick={() => openNotesModal(task)}
                    style={{
                      borderLeft: `4px solid ${task.task_color || "#a78bfa"}`,
                    }}
                  >
                    <div
                      className="sidebar-task-date"
                      style={{
                        backgroundColor: `${task.task_color || DEFAULT_TASK_COLOR}22`,
                        color: task.task_color || DEFAULT_TASK_COLOR
                      }}
                    >
                      <span className="day">{date.getDate()}</span>
                      <span className="month">
                        {date.toLocaleString("default", { month: "short" })}
                      </span>
                    </div>
                    <div className="sidebar-task-info">
                      <h4 className="sidebar-task-title">{task.title}</h4>
                      {task.project_name && (
                        <span
                          className="sidebar-project-tag"
                          style={{ color: task.task_color }}
                        >
                          • {task.project_name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            {tasks.length === 0 && (
              <div className="no-tasks-sidebar">
                No tasks scheduled for this month.
              </div>
            )}
          </div>
        </div>
      </div>

      {viewYear === 2026 && (
        <div className="holidays-legend grid-window">
          <h3>
            Sri Lankan Public Holidays - {monthNames[viewMonth]} {viewYear}
          </h3>
          <ul className="holiday-list">
            {SRI_LANKA_HOLIDAYS_2026.filter((h) => {
              const d = new Date(h.date);
              return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
            }).map((h, i) => (
              <li key={i}>
                <span className="holiday-date">
                  {new Date(h.date).getDate()} {monthNames[viewMonth]}:
                </span>
                <span className="holiday-name">{h.name}</span>
              </li>
            ))}
            {SRI_LANKA_HOLIDAYS_2026.filter((h) => {
              const d = new Date(h.date);
              return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
            }).length === 0 && (
              <li className="no-holidays">No public holidays this month.</li>
            )}
          </ul>
        </div>
      )}

      </div>

      {showTaskModal && (
        <ModalPortal>
          <div className="sui-modal-overlay">
            <div className="sui-modal-content login-modal-window">
              <button
                className="modal-close-btn"
                onClick={() => setShowTaskModal(false)}
              >
                ✕
              </button>
              <h3 className="sui-modal-title">
                {taskForm.id ? "Edit Task" : "Add Task"}: {selectedDate}
              </h3>
              <form onSubmit={handleSubmitTask} className="sui-form">
                <div className="sui-form-group">
                  <label>Task Title</label>
                  <input
                    type="text"
                    className="sui-form-control"
                    required
                    value={taskForm.title}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, title: e.target.value })
                    }
                    placeholder="e.g. Video Shoot Location A"
                  />
                </div>
                <div className="sui-form-group">
                  <label>Description (Optional)</label>
                  <textarea
                    className="sui-form-control"
                    rows="3"
                    value={taskForm.description}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, description: e.target.value })
                    }
                    placeholder="Detailed task info..."
                  ></textarea>
                </div>

                <div className="sui-form-group">
                  <label>Assign to Project (Color identity inherited)</label>
                  <div className="glass-select-wrapper">
                    <select
                      className="sui-form-control glass-dropdown"
                      value={taskForm.project_id}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const selectedProject = projects.find((p) => String(p.id) === String(pid));
                        setTaskForm({ 
                          ...taskForm, 
                          project_id: pid,
                          task_color: selectedProject?.color || DEFAULT_TASK_COLOR 
                        });
                      }}
                    >
                      <option value="">No Project (General)</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.project_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Identity Preview Strip */}
                <div 
                  className="identity-preview-strip" 
                  style={{
                    height: "8px",
                    width: "100%",
                    backgroundColor: taskForm.task_color,
                    borderRadius: "4px",
                    marginBottom: "24px",
                    boxShadow: `0 0 15px ${taskForm.task_color}44`,
                    transition: "all 0.4s ease"
                  }}
                />

                <button
                  type="submit"
                  className="sui-btn sui-btn-save"
                  disabled={submitting}
                >
                  {submitting ? "Adding..." : "Add to Schedule"}
                </button>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Task Notes Modal */}
      {showNotesModal && selectedTask && (
        <ModalPortal>
          <div className="sui-modal-overlay">
            <div className="sui-modal-content login-modal-window">
              <button
                className="modal-close-btn"
                onClick={() => setShowNotesModal(false)}
              >
                ✕
              </button>

              <div className="task-details-header">
                <h3>{selectedTask.title}</h3>
                <div className="task-meta">
                  <span className="task-meta-item">
                    Date: {selectedTask.task_date.split("T")[0]}
                  </span>
                  <span
                    className="task-meta-item"
                    style={{
                      color: selectedTask.task_color || "var(--accent-color)",
                    }}
                  >
                    Project: {selectedTask.project_name || "General Task"}
                  </span>
                </div>
                {selectedTask.description && (
                  <p className="task-desc-text">{selectedTask.description}</p>
                )}
              </div>

              <div className="notes-section">
                <h4>Task Notes</h4>
                <div className="notes-list">
                  {notes.length > 0 ? (
                    notes.map((note) => (
                      <div key={note.id} className="note-card">
                        <div className="note-header">
                          <div className="note-author-info">
                            <span className="note-author">{note.username}</span>
                            <span className="note-role">{note.role}</span>
                          </div>
                        </div>
                        <div className="note-text">{note.note_text}</div>
                        <span className="note-date">
                          {new Date(note.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="no-notes">
                      No notes yet. Be the first to add one!
                    </div>
                  )}
                </div>

                <div className="add-note-section">
                  <h4>Add Note</h4>
                  <form onSubmit={handleAddNote} className="sui-form">
                    <div className="sui-form-group">
                      <textarea
                        className="sui-form-control"
                        rows="2"
                        required
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Write your note here..."
                      ></textarea>
                    </div>
                    <div
                      style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
                    >
                      <button
                        type="submit"
                        className="sui-btn sui-btn-save"
                        disabled={submitting}
                      >
                        {submitting ? "Adding..." : "Post Note"}
                      </button>
                      {(user?.role === "admin" || user?.role === "manager") && (
                        <>
                          <button
                            type="button"
                            className="sui-btn sui-btn-edit"
                            onClick={() => {
                              setShowNotesModal(false);
                              handleOpenTaskModal(
                                selectedTask.task_date.split("T")[0],
                                selectedTask,
                              );
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="sui-btn sui-btn-delete"
                            onClick={() => handleDeleteTask(selectedTask.id)}
                            style={{
                              background: "rgba(239, 68, 68, 0.2)",
                              border: "1px solid rgba(239, 68, 68, 0.4)",
                              color: "#f87171",
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default Schedule;
