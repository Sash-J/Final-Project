/**
 * Real-User Monitoring (RUM) Web Vitals reporter (Trick #12: Measure Real Users).
 * Streams CLS, FID, FCP, LCP, TTFB and custom route timing marks to /api/telemetry/web-vitals
 * using navigator.sendBeacon so reporting never blocks page unload or UI frames.
 */

import { API } from "../config";

const TELEMETRY_ENDPOINT = `${API}/api/telemetry/web-vitals`;

export const sendWebVitalMetric = (metric) => {
  if (!metric || !metric.name || typeof metric.value !== "number") {
    return;
  }

  const route =
    typeof window !== "undefined" && window.location
      ? window.location.pathname
      : "/";

  const payload = JSON.stringify({
    id: metric.id || "",
    name: metric.name,
    value: metric.value,
    delta: typeof metric.delta === "number" ? metric.delta : metric.value,
    rating: metric.rating || "unknown",
    navigationType: metric.navigationType || "navigate",
    route,
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      const queued = navigator.sendBeacon(TELEMETRY_ENDPOINT, blob);
      if (queued) return;
    }

    if (typeof fetch === "function") {
      fetch(TELEMETRY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
        credentials: "same-origin",
      }).catch(() => {
        // Swallow network errors cleanly so RUM telemetry never breaks UX
      });
    }
  } catch {
    // Telemetry failures must stay silent in production
  }
};

export default sendWebVitalMetric;

