/**
 * validators.js
 * Shared field validation utilities.
 * Used by RegisterPage and EditProfile (and any future form that needs the same rules).
 */

// ─── Individual field validators ────────────────────────────────────────────

/**
 * Validates a username value.
 * Rules: only letters and underscores, no spaces, required when flagged.
 * @param {string} value
 * @param {{ required?: boolean }} [opts]
 * @returns {string} error message or ""
 */
export function validateUsername(value, { required = false } = {}) {
  if (!value || !value.trim()) {
    return required ? "Username is required." : "";
  }
  if (!/^[a-zA-Z_]+$/.test(value)) {
    return "Only letters and underscores allowed (no spaces).";
  }
  return "";
}

/**
 * Validates a password value.
 * Rules: no spaces, 8–20 chars, upper + lower case, exactly 1 special character.
 * @param {string} value
 * @param {{ required?: boolean }} [opts]
 * @returns {string} error message or ""
 */
export function validatePassword(value, { required = false } = {}) {
  if (!value) {
    return required ? "Password is required." : "";
  }
  if (value.includes(" ")) return "Password cannot contain spaces.";
  if (value.length < 8 || value.length > 20)
    return "Must be between 8 and 20 characters.";
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value))
    return "Must contain both uppercase and lowercase letters.";
  const specialCount = (value.match(/[^a-zA-Z0-9]/g) || []).length;
  if (specialCount !== 1) return "Must contain exactly one special character.";
  return "";
}

/**
 * Validates that confirmPassword matches password.
 * @param {string} value  - confirm password field value
 * @param {string} password - the original password to compare against
 * @returns {string} error message or ""
 */
export function validateConfirmPassword(value, password) {
  if (!value) return "";
  if (value !== password) return "Passwords do not match.";
  return "";
}

/**
 * Validates an email address.
 * @param {string} value
 * @param {{ required?: boolean }} [opts]
 * @returns {string} error message or ""
 */
export function validateEmail(value, { required = false } = {}) {
  if (!value || !value.trim()) {
    return required ? "Email is required." : "";
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) return "Please enter a valid email address.";
  return "";
}

/**
 * Validates a telephone number.
 * Allows an optional leading '+', then digits only. Total digits must be 10–15.
 * @param {string} value
 * @returns {string} error message or ""
 */
export function validateTelephone(value) {
  if (!value) return "";
  const cleanDigits = value.replace(/\D/g, "");
  if (cleanDigits.length > 0 && (cleanDigits.length < 10 || cleanDigits.length > 15)) {
    return "Invalid phone number (10–15 digits required).";
  }
  return "";
}

/**
 * Validates an address field — rejects dangerous HTML/script characters.
 * @param {string} value
 * @returns {string} error message or ""
 */
export function validateAddress(value) {
  if (!value) return "";
  if (/[<>{}[\]]/.test(value)) {
    return "Special characters < > { } [ ] are prohibited for security.";
  }
  return "";
}

/**
 * Validates a full name — letters and spaces only.
 * @param {string} value
 * @returns {string} error message or ""
 */
export function validateFullName(value) {
  if (!value) return "";
  if (!/^[a-zA-Z\s]+$/.test(value)) {
    return "Full name may only contain letters and spaces.";
  }
  return "";
}

// ─── Batch validators ────────────────────────────────────────────────────────

/**
 * Validates all registration form fields at once.
 * Returns an errors object with a key per field (empty string = no error).
 * @param {object} formData
 * @param {string} formData.username
 * @param {string} formData.password
 * @param {string} formData.confirmPassword
 * @param {string} formData.full_name
 * @param {string} formData.telephone
 * @param {string} formData.address
 * @returns {{ username: string, password: string, confirmPassword: string, full_name: string, telephone: string, address: string }}
 */
export function validateRegistrationForm(formData) {
  return {
    username: validateUsername(formData.username, { required: true }),
    password: validatePassword(formData.password, { required: true }),
    confirmPassword: validateConfirmPassword(formData.confirmPassword, formData.password),
    full_name: validateFullName(formData.full_name),
    telephone: validateTelephone(formData.telephone),
    address: validateAddress(formData.address),
  };
}

/**
 * Validates edit-profile form fields.
 * Password is optional — only validated if a value is provided.
 * @param {{ username: string, email: string }} profile
 * @param {string} password
 * @param {string} confirmPassword
 * @returns {{ username: string, email: string, password: string, confirmPassword: string }}
 */
export function validateEditProfileForm(profile, password, confirmPassword) {
  return {
    username: validateUsername(profile.username, { required: true }),
    email: validateEmail(profile.email),
    password: validatePassword(password),          // optional — empty value = no error
    confirmPassword: validateConfirmPassword(confirmPassword, password),
  };
}

// ─── Milestone validators ──────────────────────────────────────────────────

export function validateMilestoneTitle(value) {
  if (!value || !value.trim()) return "Title is required.";
  if (!/^[a-zA-Z0-9\s]+$/.test(value)) {
    return "Title can only contain letters and numbers.";
  }
  return "";
}

export function validateMilestoneDate(value) {
  if (!value) return "Target Date is required.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "Date must be in yyyy-mm-dd format (numbers and hyphens only).";
  }
  return "";
}

export function validateMilestoneDescription(value) {
  if (!value) return "";
  if (!/^[a-zA-Z0-9\s]*$/.test(value)) {
    return "Description can only contain text and numbers. No special characters allowed.";
  }
  return "";
}

export function validateMilestoneNote(value) {
  if (!value) return "";
  // Block common SQL injection characters (quotes, semicolons, dashes) while allowing basic punctuation
  if (!/^[a-zA-Z0-9\s.,!?]*$/.test(value)) {
    return "Notes can only contain text, numbers, and basic punctuation. No special characters allowed.";
  }
  return "";
}

export function validateAddMilestoneForm(title, date, desc) {
  return {
    title: validateMilestoneTitle(title),
    target_date: validateMilestoneDate(date),
    description: validateMilestoneDescription(desc),
  };
}
