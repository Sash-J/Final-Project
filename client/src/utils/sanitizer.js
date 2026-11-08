/**
 * Application Input Sanitization Utility
 * Provides defense-in-depth sanitization against XSS, HTML injection,
 * malicious protocol execution, null-byte attacks, and formatting inconsistencies.
 */

const DANGEROUS_PROTOCOLS = /(?:javascript|vbscript|data:(?!image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,)):?/gi;
const SCRIPT_TAGS = /<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const DANGEROUS_TAGS = /<\s*(?:iframe|object|embed|applet|meta|link|style)[^>]*>[\s\S]*?<\s*\/\s*(?:iframe|object|embed|applet|meta|link|style)\s*>/gi;
const HTML_TAGS = /<[^>]*>/g;
const EVENT_HANDLERS = /\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi;

const PASSWORD_KEY_REGEX = /password|current_password|new_password|confirm_password|pwd|token|secret|signature/i;
const SAFE_DATA_IMAGE_REGEX = /^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/i;

/**
 * Lightweight real-time sanitizer for active typing (onChange).
 * Strips immediate execution vectors (null bytes, active scripts, javascript: URI)
 * without interfering with natural keystrokes or intermediate symbols.
 */
export const sanitizeRealtime = (val, type = "text") => {
  if (typeof val !== "string") return val;
  if (PASSWORD_KEY_REGEX.test(type)) return val;
  if (SAFE_DATA_IMAGE_REGEX.test(val.trim())) return val.trim();

  let clean = val.replace(/\0/g, "");
  clean = clean.replace(DANGEROUS_PROTOCOLS, "");
  clean = clean.replace(SCRIPT_TAGS, "");
  clean = clean.replace(DANGEROUS_TAGS, "");
  clean = clean.replace(EVENT_HANDLERS, "");

  if (type === "number") {
    // Only allow digits, decimal point, minus sign
    clean = clean.replace(/[^0-9.-]/g, "");
    // Ensure only one decimal point
    const parts = clean.split(".");
    if (parts.length > 2) {
      clean = parts[0] + "." + parts.slice(1).join("");
    }
  }

  return clean;
};

const IMAGE_KEY_REGEX = /image|photo|avatar|logo|cover|picture|poster|icon/i;

/**
 * Full sanitization on field blur (onBlur) and pre-submission.
 * Strips all HTML tags, dangerous schemes, control characters, and trims whitespace.
 */
export const sanitizeOnBlur = (val, type = "text") => {
  if (typeof val !== "string") return val;
  if (PASSWORD_KEY_REGEX.test(type)) return val;
  if (SAFE_DATA_IMAGE_REGEX.test(val.trim())) return val.trim();

  let clean = val.replace(/\0/g, "");
  clean = clean.replace(DANGEROUS_PROTOCOLS, "");
  clean = clean.replace(SCRIPT_TAGS, "");
  clean = clean.replace(DANGEROUS_TAGS, "");
  clean = clean.replace(EVENT_HANDLERS, "");
  clean = clean.replace(HTML_TAGS, "");

  if (type === "email") {
    clean = clean.toLowerCase();
  }

  return clean.trim();
};

/**
 * Recursively sanitizes any form payload object or array prior to API dispatch.
 * Preserves binary data, dates, and password keys intact while sanitizing all other string values.
 */
export const sanitizePayload = (obj) => {
  if (obj === null || typeof obj !== "object") {
    return typeof obj === "string" ? sanitizeOnBlur(obj) : obj;
  }

  if (
    obj instanceof Date ||
    obj instanceof RegExp ||
    (typeof File !== "undefined" && obj instanceof File) ||
    (typeof Blob !== "undefined" && obj instanceof Blob) ||
    (typeof FormData !== "undefined" && obj instanceof FormData)
  ) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizePayload);
  }

  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    if (PASSWORD_KEY_REGEX.test(key)) {
      result[key] = val; // Sensitive credentials preserved unmodified
    } else if (
      IMAGE_KEY_REGEX.test(key) &&
      typeof val === "string" &&
      (SAFE_DATA_IMAGE_REGEX.test(val.trim()) ||
        val.trim().startsWith("http://") ||
        val.trim().startsWith("https://") ||
        val.trim().startsWith("/"))
    ) {
      result[key] = val.trim(); // Image data URIs and URLs preserved unmodified
    } else {
      result[key] = sanitizePayload(val);
    }
  }
  return result;
};

const sanitizer = {
  sanitizeRealtime,
  sanitizeOnBlur,
  sanitizePayload,
};

export default sanitizer;
