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
  const [theme, setTheme] = useState(localStorage.getItem("theme_mode") || "dark");
  const navigate = useNavigate();

  const applyTheme = (themeMode) => {
    const activeTheme = themeMode || "dark";
    console.log("applyTheme called with themeMode:", themeMode, "applying:", activeTheme);
    setTheme(activeTheme);
    if (activeTheme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      document.body.classList.add("light-theme");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.classList.remove("light-theme");
    }
  };

  const checkAuth = async () => {
    try {
      const res = await axios.get(`${API}/api/me`);
      if (res.data.logged_in) {
        console.log("checkAuth success, user:", res.data.user);
        setUser(res.data.user);
        applyTheme(res.data.user.theme_mode);
      } else {
        setUser(null);
        applyTheme(localStorage.getItem("theme_mode") || "dark");
      }
    } catch (err) {
      setUser(null);
      applyTheme(localStorage.getItem("theme_mode") || "dark");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let initialised = false;

    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          initialised &&
          error.response &&
          error.response.status === 401 &&
          window.location.pathname !== "/login" &&
          !sessionExpired
        ) {
          setSessionExpired(true);
          setUser(null);
        }
        return Promise.reject(error);
      },
    );

    // Mark as initialised after checkAuth completes so the interceptor
    // only triggers for genuine mid-session 401s, not the boot-time check.
    checkAuth().finally(() => {
      initialised = true;
    });

    return () => axios.interceptors.response.eject(interceptor);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username, password) => {
    try {
      const res = await axios.post(`${API}/api/login`, { username, password });
      const loggedInUser = res.data.user;
      setUser(loggedInUser);

      // The user may have toggled the theme on the login page before logging in.
      // localStorage holds that pre-login preference; the server holds the old saved one.
      // Pre-login choice wins — apply it and sync it to the server.
      const localTheme = localStorage.getItem("theme_mode");
      const serverTheme = loggedInUser.theme_mode || "dark";
      const themeToApply = localTheme || serverTheme;

      applyTheme(themeToApply);

      if (localTheme && localTheme !== serverTheme) {
        // Silently sync the pre-login theme preference to the user's profile
        try {
          await axios.put(`${API}/api/profile/theme`, { theme_mode: localTheme });
          setUser((prev) => (prev ? { ...prev, theme_mode: localTheme } : null));
        } catch (_) {
          // Non-critical — theme is already applied locally
        }
      }

      return { success: true, user: loggedInUser };
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
      navigate("/", { replace: true });
      setTimeout(() => {
        setUser(null);
      }, 0);
    } catch (err) {
      console.error("Logout failed", err);
      navigate("/", { replace: true });
      setTimeout(() => {
        setUser(null);
      }, 0);
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

  const updateUserTheme = async (newTheme) => {
    try {
      applyTheme(newTheme);
      localStorage.setItem("theme_mode", newTheme);
      if (user) {
        setUser((prev) => (prev ? { ...prev, theme_mode: newTheme } : null));
        await axios.put(`${API}/api/profile/theme`, { theme_mode: newTheme });
      }
    } catch (err) {
      console.error("Failed to update theme", err);
    }
  };


  useEffect(() => {
    if (!user) return;

    let timeoutId;
    const IDLE_TIMEOUT = 30 * 60 * 1000;

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
        applyTheme,
        updateUserTheme,
        theme,
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
