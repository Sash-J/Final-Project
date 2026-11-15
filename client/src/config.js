//Detect if we are running in a local development environment
const isLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.includes("pinggy") ||
    window.location.hostname.includes("loca.lt"));

export const API = isLocal
  ? ""
  : "https://api.visiondivision.lk";

// Optional CDN base URL (Trick #3: Serve static/media assets from nearest edge POP)
export const CDN_URL = (process.env.REACT_APP_CDN_URL || "").replace(/\/+$/, "");

/**
 * Resolve a static public asset path through REACT_APP_CDN_URL when configured.
 * Leaves external http(s)/data URLs untouched.
 */
export const assetUrl = (assetPath = "") => {
  if (!assetPath) return "";
  if (/^(https?:)?\/\//i.test(assetPath) || assetPath.startsWith("data:") || assetPath.startsWith("blob:")) {
    return assetPath;
  }
  const normalized = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
  return CDN_URL ? `${CDN_URL}${normalized}` : normalized;
};

if (process.env.NODE_ENV !== "test") {
  console.log(
    "UNIFIED API MODE:",
    isLocal
      ? `Local Development (${API})`
      : `Production Subdomain (https://api.visiondivision.lk)`,
  );
}
