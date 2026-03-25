import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        VISION DIVISION STUDIOS
      </Link>
      <ul className="nav-links">
        {(!user || (user.role !== "admin" && user.role !== "manager" && user.role !== "production_crew")) && (
          <li>
            <Link to="/">Home</Link>
          </li>
        )}

        {user && user.role === "client" && (
          <li>
            <Link to="/dashboard">Dashboard</Link>
          </li>
        )}

        {user && user.role === "production_crew" && (
          <li>
            <Link to="/crew-dashboard">Dashboard</Link>
          </li>
        )}

        {user && (user.role === "admin" || user.role === "manager") && (
          <>
            <li>
              <Link to="/admin">Admin Dashboard</Link>
            </li>
            <li>
              <Link to="/admin-budget">Admin Budget</Link>
            </li>
          </>
        )}

        {user && user.role === "admin" && (
          <li>
            <Link to="/users">Users</Link>
          </li>
        )}

        {user && (
          <li>
            <Link to="/schedule">Schedule</Link>
          </li>
        )}

        {user ? (
          <>
            <li className="user-welcome">Hi, {user.username}</li>
            <li>
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </li>
          </>
        ) : (
          <li>
            <Link to="/login" className="login-link">
              Login
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;
