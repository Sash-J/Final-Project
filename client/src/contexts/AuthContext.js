import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import SessionTimeoutModal from "../components/common/SessionTimeoutModal";

const AuthContext = createContext();

// Configure axios for credentials (sessions)
axios.defaults.withCredentials = true;

const rawAPI = process.env.REACT_APP_API_URL || "http://localhost:5000";
const API = rawAPI.endsWith("/") ? rawAPI.slice(0, -1) : rawAPI;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isTransiting, setIsTransiting] = useState(false);
  const navigate = useNavigate();

  const checkAuth = async () => {
    try {
      const res = await axios.get(`${API}/api/me`);
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

  // 1. Axios Interceptor for seamless 401 handling
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          // If not already handling or on login
          if (window.location.pathname !== "/login" && !sessionExpired) {
            setSessionExpired(true);
            setUser(null);
          }
        }
        return Promise.reject(error);
      },
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [sessionExpired]);

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const res = await axios.post(`${API}/api/login`, { username, password });
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
      await axios.post(`${API}/api/logout`);
      setUser(null);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const startTransition = (to) => {
    setIsTransiting(true);

    // Fail-safe: Always hide overlay after 1.5s max
    const failSafeId = setTimeout(() => setIsTransiting(false), 1500);

    setTimeout(() => {
      navigate(to);
      setTimeout(() => {
        setIsTransiting(false);
        clearTimeout(failSafeId);
      }, 500);
    }, 400); // Wait for fade-out
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
        setSessionExpired(true);
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
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        checkAuth,
        sessionExpired,
        isTransiting,
        startTransition,
      }}
    >
      {children}
      {sessionExpired && (
        <SessionTimeoutModal
          onLogin={() => {
            setSessionExpired(false);
            startTransition("/login");
          }}
        />
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
