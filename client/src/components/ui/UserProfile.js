import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import "./UserProfile.css";

const UserProfile = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const navigate = useNavigate();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // If we clicked the trigger, isOpen state is handled by the onClick
      if (triggerRef.current && triggerRef.current.contains(event.target)) {
        return;
      }
      // Since menu is portalled, we check menuRef specifically
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleMenu = (e) => {
    setAnchorRect(e.currentTarget.getBoundingClientRect());
    setIsOpen(!isOpen);
  };

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    navigate("/login");
  };

  if (!user) return null;

  // Get display name and role
  const displayName = user.username || "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="user-profile-container">
      <div
        ref={triggerRef}
        className={`profile-trigger ${isOpen ? "active" : ""}`}
        onClick={toggleMenu}
        title={displayName}
      >
        <div className="avatar-circle">{initial}</div>
      </div>

      {isOpen &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            className="glass-profile-menu fade-in"
            style={{
              top: anchorRect ? anchorRect.bottom + 12 : 0,
              right: anchorRect
                ? window.innerWidth - anchorRect.right
                : 20,
            }}
          >
            <div className="profile-header">
              <div className="avatar-large">{initial}</div>
              <div className="profile-info">
                <h3 className="profile-name">{displayName}</h3>
                <p className="profile-subtitle">My Account</p>
              </div>
            </div>

            <div className="menu-divider" />

            <div className="menu-section">
              <Link
                to="/"
                className="menu-item"
                onClick={() => setIsOpen(false)}
              >
                <div className="menu-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <span>Home</span>
              </Link>

              <Link
                to="/edit-profile"
                className="menu-item"
                onClick={() => setIsOpen(false)}
              >
                <div className="menu-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
                <span>Edit Profile</span>
              </Link>

              <Link
                to="/settings"
                className="menu-item"
                onClick={() => setIsOpen(false)}
              >
                <div className="menu-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </div>
                <span>Settings</span>
              </Link>

              {user.role === "admin" && (
                <Link
                  to="/users"
                  className="menu-item"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="menu-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <span>User Management</span>
                </Link>
              )}
            </div>

            <div className="menu-divider" />

            <button className="menu-item logout-item" onClick={handleLogout}>
              <div className="menu-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <span>Log Out</span>
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default UserProfile;
