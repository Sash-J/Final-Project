import { Toaster } from "react-hot-toast";

const GlobalToaster = () => {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        className: "global-toast",
        duration: 4000,
        success: {
          iconTheme: {
            primary: "#10b981",
            secondary: "#fff",
          },
        },
        error: {
          iconTheme: {
            primary: "#ef4444",
            secondary: "#fff",
          },
        },
      }}
    />
  );
};

export default GlobalToaster;
