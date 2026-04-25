import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";
import Icon from "../common/Icon";
import "./LoginPage.css";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { user, login, logout, loading, startTransition } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const res = await login(username, password);
    if (res.success) {
      startTransition("/");
    } else {
      setError(res.error);
    }
  };

  const dashboardPath = () => {
    if (!user) return "/";
    if (user.role === "admin" || user.role === "manager") return "/admin";
    if (user.role === "production_crew") return "/crew-dashboard";
    return "/dashboard";
  };

  if (loading) {
    return (
      <div className="login-container">
        <div className="login-loading-glass">
          <div className="glass-loader"></div>
          <p>Verifying session...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="login-container">
        <div className="login-card already-logged-in-card fade-in">
          <div className="user-icon-hero">
            <Icon name="account_circle" modifiers="lg" />
          </div>
          <h2>Welcome Back</h2>
          <p className="logged-in-as">
            Signed in as <strong>{user.username}</strong>
          </p>
          
          <div className="auth-action-group">
            <button 
              className="login-btn proceed-btn" 
              onClick={() => startTransition(dashboardPath())}
            >
              Go to Dashboard
            </button>
            <button className="logout-direct-btn" onClick={logout}>
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>USER LOGIN</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group password-group">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide Password" : "Show Password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                )}
              </button>
            </div>
          </div>
          <div className="status-msg-container" style={{ minHeight: '24px', margin: '10px 0' }}>
            {error && <p className="error-msg">{error}</p>}
          </div>
          <button type="submit" className="login-btn">
            Sign In
          </button>
        </form>
        <div className="login-footer">
          <p>
            Don't have an account? <Link to="/register">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
