import React from "react";
import { Toaster, toast } from "react-hot-toast";
import Toast from "./Toast";

const SuccessIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#10b981"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ErrorIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#ef4444"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

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
        const isError = t.type === "error";
        const isSuccess = t.type === "success";

        const fuseColor = isSuccess
          ? "#10b981"
          : isError
          ? "#ef4444"
          : "#f5a524";

        const rawMessage =
          typeof t.message === "function" ? t.message(t) : t.message;

        const title =
          typeof rawMessage === "string" ? rawMessage : "Notification";
        const description = t.description || "";
        const duration = t.duration || defaultDuration;

        return (
          <Toast
            open={t.visible}
            onClose={() => toast.dismiss(t.id)}
            title={title}
            description={description}
            icon={
              t.icon || (isSuccess ? <SuccessIcon /> : isError ? <ErrorIcon /> : null)
            }
            fuseColor={t.fuseColor || fuseColor}
            duration={duration}
            closeButton={true}
            inline={true}
          />
        );
      }}
    </Toaster>
  );
};

export default GlobalToaster;
