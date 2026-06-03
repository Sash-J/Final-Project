import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import ModalPortal from "../common/ModalPortal";
import Icon from "../common/Icon";
import EditProfile from "../pages/EditProfile";
import "./UserProfile.css";

const UserProfile = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const timeoutRef = useRef(null);
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    const handleClose = (event) => {
      if (triggerRef.current && triggerRef.current.contains(event.target)) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleAction = () => {
      if (isOpen) setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClose);
      window.addEventListener("resize", handleAction);
      window.addEventListener("scroll", handleAction, { passive: true });
    }

    return () => {
      document.removeEventListener("mousedown", handleClose);
      window.removeEventListener("resize", handleAction);
      window.removeEventListener("scroll", handleAction);
    };
  }, [isOpen]);

  useEffect(() => {
    // Clear timeout on unmount
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (triggerRef.current) {
      setAnchorRect(triggerRef.current.getBoundingClientRect());
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  const handleMenuMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleMenuMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  const toggleMenu = (e) => {
    if (!isOpen) {
      setAnchorRect(e.currentTarget.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    navigate("/login");
  };

  if (!user) return null;

  const displayName = user.username || "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="user-profile-container">
      <div
        ref={triggerRef}
        className={`profile-trigger ${isOpen ? "active" : ""}`}
        onClick={toggleMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={displayName}
      >
        <div className="avatar-circle">
          {user.profile_image ? (
            <img
              src={user.profile_image}
              alt="Profile"
              className="avatar-img-circle"
            />
          ) : (
            initial
          )}
        </div>
      </div>

      {isOpen &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            className="glass-profile-menu fade-in"
            onMouseEnter={handleMenuMouseEnter}
            onMouseLeave={handleMenuMouseLeave}
            style={{
              top: anchorRect ? anchorRect.bottom + 8 : 0,
              right: anchorRect
                ? Math.max(10, window.innerWidth - anchorRect.right)
                : 20,
            }}
          >
            <div className="profile-header">
              <div className="avatar-large">
                {user.profile_image ? (
                  <img
                    src={user.profile_image}
                    alt="Profile"
                    className="avatar-img-circle"
                  />
                ) : (
                  initial
                )}
              </div>
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
                  <span className="material-symbols-outlined">home</span>
                </div>
                <span>Home</span>
              </Link>


              <button
                className="menu-item"
                onClick={() => {
                  setIsOpen(false);
                  setShowProfileModal(true);
                }}
              >
                <div className="menu-icon">
                  <span className="material-symbols-outlined">settings</span>
                </div>
                <span>Settings</span>
              </button>

              {user.role === "admin" && (
                <Link
                  to="/users"
                  className="menu-item"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="menu-icon">
                    <span className="material-symbols-outlined">group</span>
                  </div>
                  <span>User Management</span>
                </Link>
              )}
            </div>

            <div className="menu-divider" />

            <button className="menu-item logout-item" onClick={handleLogout}>
              <div className="menu-icon">
                <Icon name="logout" />
              </div>
              <span>Log Out</span>
            </button>
          </div>,
          document.body,
        )}

      {showProfileModal && (
        <ModalPortal
          onClose={() => setShowProfileModal(false)}
          size="large"
          className="profile-modal-glass"
        >
          <EditProfile onClose={() => setShowProfileModal(false)} />
        </ModalPortal>
      )}
    </div>
  );
};

export default UserProfile;
