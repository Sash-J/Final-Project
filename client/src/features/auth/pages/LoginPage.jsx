import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import Icon from "../../../components/common/Icon";
import FloatingInput from "../../../components/common/FloatingInput";
import NeoButton from "../../../components/common/NeoButton";
import "./LoginPage.css";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { user, login, logout, loading, startTransition } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await login(username, password);
    if (res.success) {
      startTransition(dashboardPath(res.user));
    } else {
      setError(res.error || "Login failed");
      setSubmitting(false);
    }
  };

  const dashboardPath = (resolvedUser) => {
    const u = resolvedUser || user;
    if (!u) return "/";
    const userRoles = [
      ...(u.roles || []),
      u.role,
    ]
      .filter(Boolean)
      .map((r) => String(r).trim().toLowerCase().replace(/_/g, " "));

    if (userRoles.some((r) => ["admin", "manager", "director", "accountant", "coordinator", "viewer"].includes(r))) {
      return "/admin";
    }
    if (userRoles.some((r) => ["crew", "department head"].includes(r))) {
      return "/crew-dashboard";
    }
    if (userRoles.some((r) => r.startsWith("client"))) {
      return "/dashboard";
    }
    return "/";
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
              className="btn-neo btn-neo-solid proceed-btn"
              onClick={() => startTransition(dashboardPath())}
            >
              Go to Dashboard
            </button>
            <button className="btn-neo-cancel" onClick={logout}>
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
        <form onSubmit={handleSubmit} className="neo-form">
          <FloatingInput
            label="Username"
            required
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <FloatingInput
            type={showPassword ? "text" : "password"}
            label="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            suffix={
              <button
                type="button"
                className="floating-suffix-action"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide Password" : "Show Password"}
              >
                <Icon
                  name={showPassword ? "visibility_off" : "visibility"}
                  modifiers="xs"
                />
              </button>
            }
          />

          <div className="login-status-msg-container">
            {error && <p className="error-msg">{error}</p>}
          </div>
          <NeoButton
            type="submit"
            variant="solid"
            fullWidth
            loading={submitting}
            disabled={!username.trim() || !password.trim()}
            disabledReason={!username.trim() ? "Enter username first" : !password.trim() ? "Enter password first" : ""}
            className="login-submit-btn"
          >
            Sign In
          </NeoButton>
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
