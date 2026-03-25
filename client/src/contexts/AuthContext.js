import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";

const AuthContext = createContext();

// Configure axios for credentials (sessions)
axios.defaults.withCredentials = true;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const res = await axios.get("/api/me");
      if (res.data.logged_in) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const res = await axios.post("/api/login", { username, password });
      setUser(res.data.user);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || "Login failed",
      };
    }
  };

  const logout = async () => {
    try {
      await axios.post("/api/logout");
      setUser(null);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  // ── Idle Timeout Logic ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let timeoutId;
    const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 mins session timeout

    const handleActivity = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
        alert("Session expired due to inactivity. Please log in again.");
      }, IDLE_TIMEOUT);
    };

    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];
    events.forEach((event) => window.addEventListener(event, handleActivity));

    // Start the initial timer
    handleActivity();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((event) =>
        window.removeEventListener(event, handleActivity),
      );
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
