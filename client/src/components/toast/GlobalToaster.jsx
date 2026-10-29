import React from "react";
import { Toaster, toast } from "react-hot-toast";
import Toast from "./Toast";

export const SuccessIcon = ({ color = "#10b981", ...props }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const ErrorIcon = ({ color = "#ef4444", ...props }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export const InfoIcon = ({ color = "#00c6e6", ...props }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const THEMES = {
  success: { color: "#10b981", Icon: SuccessIcon },
  error: { color: "#ef4444", Icon: ErrorIcon },
  info: { color: "#00c6e6", Icon: InfoIcon },
  default: { color: "#f5a524", Icon: null },
};

const resolveToastTheme = (t) => {
  if (t.type === "success") return THEMES.success;
  if (t.type === "error") return THEMES.error;
  if (t.type === "info" || t.icon === "info") return THEMES.info;
  return THEMES.default;
};

const GlobalToaster = ({ defaultDuration = 10000 }) => {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: defaultDuration,
      }}
      containerStyle={{
        bottom: 24,
        right: 24,
        zIndex: 999999999,
      }}
      gutter={10}
    >
      {(t) => {
        const theme = resolveToastTheme(t);
        const rawMessage = typeof t.message === "function" ? t.message(t) : t.message;
        const title = typeof rawMessage === "string" ? rawMessage : "Notification";
        const icon = (t.icon && t.icon !== "info")
          ? t.icon
          : theme.Icon ? <theme.Icon /> : null;

        return (
          <Toast
            open={t.visible}
            onClose={() => toast.dismiss(t.id)}
            title={title}
            description={t.description || ""}
            icon={icon}
            fuseColor={t.fuseColor || theme.color}
            duration={t.duration || defaultDuration}
            closeButton={true}
            inline={true}
          />
        );
      }}
    </Toaster>
  );
};

export default GlobalToaster;
