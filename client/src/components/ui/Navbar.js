import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import NotificationBell from "./NotificationBell";
import UserProfile from "./UserProfile";
import Icon from "../common/Icon";
import "./Navbar.css";

const Navbar = () => {
  const { user } = useAuth();
  const [useImageLogo, setUseImageLogo] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setUseImageLogo((prev) => !prev);
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className="navbar">
      <Link
        to="/"
        className={`logo ${useImageLogo ? "is-image-mode" : "is-text-mode"}`}
      >
        <div className="logo-text-wrapper">
          <span className="logo-text">VISION DIVISION</span>
        </div>
        <div className="logo-img-wrapper">
          <img src="/logo.png" alt="VISION DIVISION" className="logo-img" />
        </div>
      </Link>

      <ul className={`nav-links ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        {user && user.role === "client" && (
          <li>
            <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
              <Icon name="dashboard" modifiers="sm" />
              <span>Dashboard</span>
            </Link>
          </li>
        )}

        {user && user.role === "production_crew" && (
          <li>
            <Link
              to="/crew-dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Icon name="dashboard" modifiers="sm" />
              <span>Dashboard</span>
            </Link>
          </li>
        )}

        {user && (user.role === "admin" || user.role === "manager") && (
          <>
            <li>
              <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)}>
                <Icon name="dashboard" modifiers="md" />
                <span>Dashboard</span>
              </Link>
            </li>
            <li>
              <Link
                to="/admin-budget"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Icon name="payments" modifiers="md" />
                <span>Budget</span>
              </Link>
            </li>
            <li>
              <Link
                to="/budget-predictor"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Icon name="auto_graph" modifiers="md" />
                <span>Predictor</span>
              </Link>
            </li>
          </>
        )}

        {user && user.role === "admin" && (
          <li>
            <Link to="/users" onClick={() => setIsMobileMenuOpen(false)}>
              <Icon name="groups" modifiers="md" />
              <span>Users</span>
            </Link>
          </li>
        )}

        {user && (user.role === "admin" || user.role === "manager") && (
          <li>
            <Link to="/finance" onClick={() => setIsMobileMenuOpen(false)}>
              <Icon name="assessment" modifiers="md" />
              <span>Finance</span>
            </Link>
          </li>
        )}

        {user && (
          <li>
            <Link to="/schedule" onClick={() => setIsMobileMenuOpen(false)}>
              <Icon name="calendar_month" modifiers="md" />
              <span>Schedule</span>
            </Link>
          </li>
        )}
      </ul>

      <div className="navbar-controls">
        <div className="nav-item-flex">
          {user ? (
            <>
              <NotificationBell />
              <UserProfile />
            </>
          ) : (
            <>
              <Link to="/" className="nav-link-right desktop-only">
                Home
              </Link>
              <Link to="/login" className="login-link">
                Login
              </Link>
            </>
          )}
        </div>

        <button
          className={`hamburger ${isMobileMenuOpen ? "active" : ""}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle Menu"
        >
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
