import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./NotificationBell.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Handle outside clicks to close dropdown
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleOutsideClick);
      fetchNotifications();
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showDropdown]);

  const fetchUnreadCount = async () => {
    try {
      const res = await axios.get(`${API}/api/notifications/unread-count`, {
        withCredentials: true,
      });
      setUnreadCount(res.data.unread_count);
    } catch (err) {
      console.error("Error fetching unread count:", err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API}/api/notifications`, {
        withCredentials: true,
      });
      setNotifications(res.data);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  const handleMarkAsRead = async (id, isRead) => {
    if (isRead) return;
    try {
      await axios.put(`${API}/api/notifications/${id}/read`, {}, { withCredentials: true });
      fetchUnreadCount();
      fetchNotifications();
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.put(`${API}/api/notifications/read-all`, {}, { withCredentials: true });
      fetchUnreadCount();
      fetchNotifications();
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
  };

  // Bell SVG Component for reliability
  const BellIcon = ({ className }) => (
    <svg 
      viewBox="0 0 24 24" 
      width="24" 
      height="24" 
      className={className}
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
  );

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <div className="bell-icon" onClick={() => setShowDropdown(!showDropdown)}>
        <BellIcon className={unreadCount > 0 ? "has-unread" : ""} />
        {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
      </div>

      {showDropdown && (
        <div className="notifications-dropdown glass-panel">
          <div className="dropdown-header">
            <div className="dropdown-title-wrap">
              <BellIcon className="dropdown-header-icon" />
            </div>
            {unreadCount > 0 && (
              <button className="mark-all-btn" onClick={handleMarkAllRead}>
                Mark all as read
              </button>
            )}
          </div>
          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="empty-notifications">No notifications found</div>
            ) : (
              notifications.map((note) => (
                <div
                  key={note.id}
                  className={`notification-item ${!note.is_read ? "unread" : ""}`}
                  onClick={() => handleMarkAsRead(note.id, note.is_read)}
                >
                  <span className="notification-message">{note.message}</span>
                  <span className="notification-time">{formatTime(note.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
