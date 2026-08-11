//Detect if we are running in a local development environment
const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.includes("pinggy") ||
  window.location.hostname.includes("loca.lt");

export const API = isLocal
  ? ""
  : "https://api.visiondivision.lk";

console.log(
  "UNIFIED API MODE:",
  isLocal
    ? `Local Development (${API})`
    : `Production Subdomain (https://api.visiondivision.lk)`,
);
