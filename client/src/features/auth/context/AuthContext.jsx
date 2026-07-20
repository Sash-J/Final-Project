import React, { createContext, useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { setupInterceptors } from "../../../services/api";
import { authService } from "../../../services/authService";
import SessionTimeoutModal from "../../../components/common/SessionTimeoutModal";

const AuthContext = createContext();

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
      const data = await authService.checkAuth();
      if (data && data.logged_in) {
        console.log("checkAuth success, user:", data.user);
        setUser(data.user);
        applyTheme(data.user.theme_mode);
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

    const cleanupInterceptor = setupInterceptors(() => {
      if (initialised && !sessionExpired) {
        setSessionExpired(true);
        setUser(null);
      }
    });

    checkAuth().finally(() => {
      initialised = true;
    });

    return cleanupInterceptor;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username, password) => {
    try {
      const loggedInUser = await authService.login(username, password);
      setUser(loggedInUser);

      const localTheme = localStorage.getItem("theme_mode");
      const serverTheme = loggedInUser.theme_mode || "dark";
      const themeToApply = localTheme || serverTheme;

      applyTheme(themeToApply);

      if (localTheme && localTheme !== serverTheme) {
        try {
          await authService.updateTheme(localTheme);
          setUser((prev) => (prev ? { ...prev, theme_mode: localTheme } : null));
        } catch (_) {}
      }

      return { success: true, user: loggedInUser };
    } catch (err) {
      return {
        success: false,
        error: err.message || "Login failed",
      };
    }
  };

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
      navigate("/", { replace: true });
      setTimeout(() => {
        setUser(null);
      }, 0);
    }
  }, [navigate]);

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
        await authService.updateTheme(newTheme);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
