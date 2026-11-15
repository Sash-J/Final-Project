import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import "./styles/Forms.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { sendWebVitalMetric } from "./utils/webVitalsReporter";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <App />
);

// Defer non-critical Web Vitals listener registration until browser is idle (Tricks #7 & #12)
const scheduleVitals =
  typeof window !== "undefined" && typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback
    : (cb) => setTimeout(cb, 200);

scheduleVitals(() => {
  reportWebVitals(sendWebVitalMetric);
});
