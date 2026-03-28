import React, { useState, useEffect } from "react";
import "./Schedule.css";
import ModalPortal from "../common/ModalPortal";
import html2pdf from "html2pdf.js";

// Sri Lankan Public Holidays 2026 (Hardcoded for simplicity)
const SRI_LANKA_HOLIDAYS_2026 = [
  { date: "2026-01-03", name: "Duruthu Full Moon Poya Day" },
  { date: "2026-01-15", name: "Tamil Thai Pongal Day" },
  { date: "2026-02-01", name: "Navam Full Moon Poya Day" },
  { date: "2026-02-04", name: "Independence Day" },
  { date: "2026-02-15", name: "Mahasivarathri Day" },
  { date: "2026-03-02", name: "Medin Full Moon Poya Day" },
  { date: "2026-03-21", name: "Id-Ul-Fitr (Ramazan)" },
  { date: "2026-04-01", name: "Bak Full Moon Poya Day" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-13", name: "Day prior to Sinhala & Tamil New Year" },
  { date: "2026-04-14", name: "Sinhala & Tamil New Year Day" },
  { date: "2026-05-01", name: "Vesak Full Moon Poya Day" },
  { date: "2026-05-02", name: "Day following Vesak Poya" },
  { date: "2026-05-29", name: "Id-Ul-Allah (Hadji)" },
  { date: "2026-05-30", name: "Adhi Poson Full Moon Poya Day" },
  { date: "2026-06-29", name: "Poson Full Moon Poya Day" },
  { date: "2026-07-29", name: "Esala Full Moon Poya Day" },
  { date: "2026-08-26", name: "Milad-un-Nabi (Holy Prophet's Birthday)" },
  { date: "2026-09-26", name: "Nikini Full Moon Poya Day" },
  { date: "2026-10-25", name: "Binara Full Moon Poya Day" },
  { date: "2026-10-26", name: "Vap Full Moon Poya Day" },
  { date: "2026-11-13", name: "Deepawali Festival Day" },
  { date: "2026-11-24", name: "Ill Full Moon Poya Day" },
  { date: "2026-12-24", name: "Unduwap Full Moon Poya Day" },
  { date: "2026-12-25", name: "Christmas Day" },
];

const PREDEFINED_COLORS = [
  "#00c6e6", // Blue
  "#60a5fa", // Sky Blue
  "#2dd4bf", // Teal
  "#4ade80", // Green
  "#fbbf24", // Amber
  "#a855f7", // Purple (replaced rose/red)
  "#f472b6", // Pink
  "#818cf8", // Indigo
  "#c084fc", // Violet
  "#a78bfa", // Lavender
];

const Schedule = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
    task_color: "#00c6e6",
  });
  const [noteText, setNoteText] = useState("");

  const viewMonth = currentDate.getMonth();
  const viewYear = currentDate.getFullYear();

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchProjects();
  }, [viewMonth, viewYear]);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/me");
      const data = await res.json();
      if (data.logged_in) {
        setUser(data.user);
      }
    } catch (err) {
      console.error("Error fetching user:", err);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schedule/tasks?year=${viewYear}&month=${viewMonth + 1}`,
      );
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const fetchNotes = async (taskId) => {
    try {
      const res = await fetch(`/api/schedule/tasks/${taskId}/notes`);
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching notes:", err);
    }
  };

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const isEditing = !!taskForm.id;
    const url = isEditing
      ? `/api/schedule/tasks/${taskForm.id}`
      : "/api/schedule/tasks";
    const method = isEditing ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...taskForm,
          task_date: selectedDate,
        }),
      });
      if (response.ok) {
        setTaskForm({
          id: null,
          title: "",
          description: "",
          project_id: "",
          task_color: "#00c6e6",
        });
        setShowTaskModal(false);
        fetchTasks();
      }
    } catch (err) {
      console.error("Error adding task:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      const res = await fetch(`/api/schedule/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (selectedTask && selectedTask.id === taskId) {
          setShowNotesModal(false);
        }
        fetchTasks();
      }
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/schedule/tasks/${selectedTask.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        task_color: "#00c6e6",
      });
    }
    setShowTaskModal(true);
  };

  const openNotesModal = (task) => {
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
                className="task-item"
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
    <div className="schedule-container sui-fade-in">
      <div className="schedule-header">
        <h2>Production Schedule</h2>
      </div>

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
              <button onClick={handleDownloadPDF} className="download-pdf-btn">
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
                    className="sidebar-task-card"
                    key={task.id}
                    onClick={() => openNotesModal(task)}
                    style={{
                      borderLeft: `4px solid ${task.task_color || "#a78bfa"}`,
                    }}
                  >
                    <div
                      className="sidebar-task-date"
                      style={{
                        backgroundColor: `${task.task_color || "#a78bfa"}22`,
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
                  <label>Project (Optional)</label>
                  <div className="glass-select-wrapper">
                    <select
                      className="sui-form-control glass-dropdown"
                      value={taskForm.project_id}
                      onChange={(e) =>
                        setTaskForm({ ...taskForm, project_id: e.target.value })
                      }
                    >
                      <option value="">No Project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.project_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="sui-form-group">
                  <label>Task Highlight Color</label>
                  <div className="color-palette">
                    {PREDEFINED_COLORS.map((color) => (
                      <div
                        key={color}
                        className={`color-swatch ${taskForm.task_color === color ? "active" : ""}`}
                        style={{ backgroundColor: color }}
                        onClick={() =>
                          setTaskForm({ ...taskForm, task_color: color })
                        }
                        title={color}
                      />
                    ))}
                  </div>
                </div>
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
