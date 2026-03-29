/**
 * Centralized API configuration for the entire frontend.
 * This file replaces the local 'const API' definitions in every component.
 */

// Detect if running on a Vercel preview or production URL
const isVercel = window.location.hostname.includes("vercel.app");

// Fallback for local development
const localAPI = process.env.REACT_APP_API_URL || "http://localhost:5000";

// API URL logic: Use relative paths on Vercel for 100% reliability
export const API = isVercel ? "" : (localAPI.endsWith("/") ? localAPI.slice(0, -1) : localAPI);

console.log("UNIFIED API MODE:", isVercel ? "Vercel (Relative)" : API);
