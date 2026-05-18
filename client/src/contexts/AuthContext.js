import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API } from "../config";
import SessionTimeoutModal from "../components/common/SessionTimeoutModal";

const AuthContext = createContext();

//Configure axios sessions
axios.defaults.withCredentials = true;

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

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
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

    const failSafeId = setTimeout(() => setIsTransiting(false), 1500);

    setTimeout(() => {
      navigate(to);
      setTimeout(() => {
        setIsTransiting(false);
        clearTimeout(failSafeId);
      }, 500);
    }, 400);
  };

  useEffect(() => {
    if (!user) return;

    let timeoutId;
    const IDLE_TIMEOUT = 10 * 60 * 1000;

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
