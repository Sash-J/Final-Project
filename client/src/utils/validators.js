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

// ─── Payment validators ────────────────────────────────────────────────────

/**
 * Validates a monetary payment amount.
 * @param {string|number} value
 * @param {{ required?: boolean, max?: number }} [opts]
 * @returns {string} error message or ""
 */
export function validatePaymentAmount(value, { required = true, max = 1000000000 } = {}) {
  const strVal = String(value ?? "").trim();
  if (!strVal) {
    return required ? "Payment amount is required." : "";
  }
  const num = parseFloat(strVal);
  if (isNaN(num) || !isFinite(num)) {
    return "Please enter a valid numeric amount.";
  }
  if (num <= 0) {
    return "Payment amount must be greater than 0.";
  }
  if (num > max) {
    return `Amount cannot exceed ${max.toLocaleString()}.`;
  }
  // Check decimal places (max 2 decimals)
  if (strVal.includes(".")) {
    const decimals = strVal.split(".")[1];
    if (decimals && decimals.length > 2) {
      return "Amount cannot have more than 2 decimal places.";
    }
  }
  return "";
}

/**
 * Validates a payment description or milestone reference.
 * @param {string} value
 * @param {{ required?: boolean, min?: number, max?: number }} [opts]
 * @returns {string} error message or ""
 */
export function validatePaymentDescription(
  value,
  { required = true, min = 2, max = 150 } = {}
) {
  const strVal = String(value ?? "").trim();
  if (!strVal) {
    return required ? "Payment description is required." : "";
  }
  if (strVal.length < min) {
    return `Description must be at least ${min} characters.`;
  }
  if (strVal.length > max) {
    return `Description cannot exceed ${max} characters.`;
  }
  if (/[<>{}[\]]/.test(strVal)) {
    return "Special characters < > { } [ ] are prohibited for security.";
  }
  return "";
}

/**
 * Validates a bank transfer or slip reference code.
 * @param {string} value
 * @returns {string} error message or ""
 */
export function validateBankRef(value) {
  const strVal = String(value ?? "").trim();
  if (!strVal) return "";
  if (strVal.length > 50) {
    return "Reference code cannot exceed 50 characters.";
  }
  if (!/^[a-zA-Z0-9_\-/#\s]+$/.test(strVal)) {
    return "Reference may only contain letters, numbers, hyphens, and slashes.";
  }
  return "";
}

/**
 * Validates a payment date string (YYYY-MM-DD).
 * @param {string} value
 * @param {{ required?: boolean }} [opts]
 * @returns {string} error message or ""
 */
export function validatePaymentDate(value, { required = true } = {}) {
  const strVal = String(value ?? "").trim();
  if (!strVal) {
    return required ? "Payment date is required." : "";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
    return "Date must be in YYYY-MM-DD format.";
  }
  const d = new Date(strVal);
  if (isNaN(d.getTime())) {
    return "Invalid calendar date.";
  }
  return "";
}

/**
 * Batch validator for payment form.
 * @param {{ amount: any, description: string, payment_date: string, bank_ref?: string }} form
 * @returns {{ amount: string, description: string, payment_date: string, bank_ref: string }}
 */
export function validatePaymentForm(form) {
  return {
    amount: validatePaymentAmount(form?.amount, { required: true }),
    description: validatePaymentDescription(form?.description, { required: true }),
    payment_date: validatePaymentDate(form?.payment_date, { required: true }),
    bank_ref: validateBankRef(form?.bank_ref),
  };
}

// ─── Project validators ────────────────────────────────────────────────────

/**
 * Validates a project title/name.
 * @param {string} value
 * @param {{ required?: boolean, min?: number, max?: number }} [opts]
 * @returns {string} error message or ""
 */
export function validateProjectName(
  value,
  { required = true, min = 2, max = 100 } = {}
) {
  const strVal = String(value ?? "").trim();
  if (!strVal) {
    return required ? "Project name is required." : "";
  }
  if (strVal.length < min) {
    return `Project name must be at least ${min} characters.`;
  }
  if (strVal.length > max) {
    return `Project name cannot exceed ${max} characters.`;
  }
  if (/[<>{}[\]]/.test(strVal)) {
    return "Special characters < > { } [ ] are prohibited for security.";
  }
  return "";
}

/**
 * Validates an internal project code name (e.g. MIRROR-2026).
 * @param {string} value
 * @returns {string} error message or ""
 */
export function validateProjectCodeName(value) {
  const strVal = String(value ?? "").trim();
  if (!strVal) return "";
  if (strVal.length < 2 || strVal.length > 30) {
    return "Code name must be between 2 and 30 characters.";
  }
  if (!/^[a-zA-Z0-9_\-\s]+$/.test(strVal)) {
    return "Code name may only contain letters, numbers, hyphens, and underscores.";
  }
  return "";
}

/**
 * Validates logical ordering between start date and target delivery date.
 * @param {string} startDate
 * @param {string} endDate
 * @returns {{ startDate: string, endDate: string }}
 */
export function validateProjectDates(startDate, endDate) {
  const errors = { startDate: "", endDate: "" };
  const s = String(startDate ?? "").trim();
  const e = String(endDate ?? "").trim();

  if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    errors.startDate = "Start date must be in YYYY-MM-DD format.";
  }
  if (e && !/^\d{4}-\d{2}-\d{2}$/.test(e)) {
    errors.endDate = "Target delivery date must be in YYYY-MM-DD format.";
  }

  if (!errors.startDate && !errors.endDate && s && e) {
    if (new Date(e) < new Date(s)) {
      errors.endDate = "Target delivery date cannot precede project start date.";
    }
  }

  return errors;
}

/**
 * Batch validator for project creation and edit profile form.
 * @param {object} formData
 * @returns {{ project_name: string, code_name: string, start_date: string, end_date: string }}
 */
export function validateProjectForm(formData) {
  const dateErrors = validateProjectDates(formData?.start_date, formData?.end_date);
  return {
    project_name: validateProjectName(formData?.project_name, { required: true }),
    code_name: validateProjectCodeName(formData?.code_name),
    start_date: dateErrors.startDate,
    end_date: dateErrors.endDate,
  };
}

// ─── Equipment and itemization validators ──────────────────────────────────

/**
 * Validates equipment or camera item name.
 * @param {string} value
 * @returns {string} error message or ""
 */
export function validateEquipmentName(value) {
  const strVal = String(value ?? "").trim();
  if (!strVal) return "Camera/equipment name is required.";
  if (strVal.length < 2 || strVal.length > 80) {
    return "Name must be between 2 and 80 characters.";
  }
  if (/[<>{}[\]]/.test(strVal)) {
    return "Prohibited characters < > { } [ ] detected.";
  }
  return "";
}

/**
 * Validates a positive quantity value.
 * @param {any} value
 * @returns {string} error message or ""
 */
export function validateQuantity(value) {
  const strVal = String(value ?? "").trim();
  if (!strVal) return "";
  const num = parseInt(strVal, 10);
  if (isNaN(num) || num < 0) {
    return "Quantity must be 0 or greater.";
  }
  if (num > 10000) {
    return "Quantity exceeds allowable threshold (max 10,000).";
  }
  return "";
}

/**
 * Validates a positive rate or price value.
 * @param {any} value
 * @returns {string} error message or ""
 */
export function validateRate(value) {
  const strVal = String(value ?? "").trim();
  if (!strVal) return "";
  const num = parseFloat(strVal);
  if (isNaN(num) || num < 0) {
    return "Rate must be 0 or greater.";
  }
  if (num > 100000000) {
    return "Rate cannot exceed 100,000,000.";
  }
  return "";
}

/**
 * Validates a department name.
 * @param {string} value
 * @returns {string} error message or ""
 */
export function validateDepartmentName(value) {
  const strVal = String(value ?? "").trim();
  if (!strVal) return "Department name is required.";
  if (strVal.length < 2 || strVal.length > 60) {
    return "Department name must be between 2 and 60 characters.";
  }
  if (/[<>{}[\]]/.test(strVal)) {
    return "Special characters < > { } [ ] are prohibited for security.";
  }
  return "";
}

/**
 * Validates a category name.
 * @param {string} value
 * @returns {string} error message or ""
 */
export function validateCategoryName(value) {
  const strVal = String(value ?? "").trim();
  if (!strVal) return "Category name is required.";
  if (strVal.length < 2 || strVal.length > 60) {
    return "Category name must be between 2 and 60 characters.";
  }
  if (/[<>{}[\]]/.test(strVal)) {
    return "Special characters < > { } [ ] are prohibited for security.";
  }
  return "";
}

/**
 * Validates a budget item description.
 * @param {string} value
 * @returns {string} error message or ""
 */
export function validateBudgetItemName(value) {
  const strVal = String(value ?? "").trim();
  if (!strVal) return "Item description is required.";
  if (strVal.length < 2 || strVal.length > 80) {
    return "Item description must be between 2 and 80 characters.";
  }
  if (/[<>{}[\]]/.test(strVal)) {
    return "Special characters < > { } [ ] are prohibited for security.";
  }
  return "";
}

// ─── Finance Workspace validators ──────────────────────────────────────────

const ALLOWED_DOC_TYPES = new Set([
  "expense",
  "income",
  "drawing",
  "capital",
  "invoice_ar",
  "bill_ap",
  "credit_note",
  "debit_note",
  "settlement",
  "transfer",
  "payroll",
  "depreciation",
  "journal",
]);

const ALLOWED_SCOPES = new Set(["project", "company", "personal"]);
const ALLOWED_ACCOUNT_CLASSES = new Set([
  "asset",
  "liability",
  "equity",
  "income",
  "cogs",
  "expense",
  "drawings",
]);

/**
 * Validates a finance monetary voucher amount.
 * @param {string|number} value
 * @param {{ required?: boolean, max?: number }} [opts]
 * @returns {string} error message or ""
 */
export function validateVoucherAmount(
  value,
  { required = true, max = 1000000000 } = {}
) {
  return validatePaymentAmount(value, { required, max });
}

/**
 * Validates a finance ISO date (YYYY-MM-DD) with strict calendar-rollover guard.
 * @param {string} value
 * @param {{ required?: boolean, label?: string }} [opts]
 * @returns {string} error message or ""
 */
export function validateVoucherDate(
  value,
  { required = true, label = "Transaction date" } = {}
) {
  const strVal = String(value ?? "").trim();
  if (!strVal) {
    return required ? `${label} is required.` : "";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
    return `${label} must be in YYYY-MM-DD format.`;
  }
  const [y, m, d] = strVal.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return `${label} is not a valid calendar date.`;
  }
  return "";
}

/**
 * Validates a voucher description / memo.
 * @param {string} value
 * @param {{ required?: boolean, min?: number, max?: number }} [opts]
 * @returns {string} error message or ""
 */
export function validateVoucherDescription(
  value,
  { required = true, min = 2, max = 255 } = {}
) {
  return validatePaymentDescription(value, { required, min, max });
}

/**
 * Validates a Chart of Accounts code (e.g., 5010, 6100-A).
 * @param {string} value
 * @param {{ required?: boolean }} [opts]
 * @returns {string} error message or ""
 */
export function validateAccountCode(value, { required = true } = {}) {
  const strVal = String(value ?? "").trim();
  if (!strVal) {
    return required ? "Account code is required." : "";
  }
  if (strVal.length < 2 || strVal.length > 24) {
    return "Account code must be 2–24 characters.";
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(strVal)) {
    return "Account code may only contain letters, digits, dots, hyphens, and underscores.";
  }
  return "";
}

/**
 * Validates a Chart of Accounts name.
 * @param {string} value
 * @param {{ required?: boolean }} [opts]
 * @returns {string} error message or ""
 */
export function validateAccountName(value, { required = true } = {}) {
  const strVal = String(value ?? "").trim();
  if (!strVal) {
    return required ? "Account name is required." : "";
  }
  if (strVal.length < 2 || strVal.length > 120) {
    return "Account name must be 2–120 characters.";
  }
  if (/[<>{}[\]]/.test(strVal)) {
    return "Special characters < > { } [ ] are prohibited for security.";
  }
  return "";
}

/**
 * Validates a debtor/creditor counterparty name.
 * @param {string} value
 * @param {{ required?: boolean }} [opts]
 * @returns {string} error message or ""
 */
export function validateCounterpartyName(value, { required = true } = {}) {
  const strVal = String(value ?? "").trim();
  if (!strVal) {
    return required ? "Counterparty name is required." : "";
  }
  if (strVal.length < 2 || strVal.length > 120) {
    return "Name must be 2–120 characters.";
  }
  if (/[<>{}[\]]/.test(strVal)) {
    return "Special characters < > { } [ ] are prohibited for security.";
  }
  return "";
}

/**
 * Batch validator for double-entry voucher creation/editing.
 * @param {object} form
 * @returns {{ doc_type: string, scope: string, primary_project_id: string, primary_user_id: string, tx_date: string, due_date: string, amount: string, description: string, bank_ref: string, lines: string }}
 */
export function validateVoucherForm(form) {
  const docType = String(form?.doc_type ?? "").trim().toLowerCase();
  const scope = String(form?.scope ?? "").trim().toLowerCase();
  const lines = Array.isArray(form?.lines) ? form.lines : [];

  const errors = {
    doc_type: ALLOWED_DOC_TYPES.has(docType)
      ? ""
      : "Please select a valid document type.",
    scope: ALLOWED_SCOPES.has(scope)
      ? ""
      : "Scope must be project, company, or personal.",
    primary_project_id: "",
    primary_user_id: "",
    tx_date: validateVoucherDate(form?.tx_date, {
      required: true,
      label: "Transaction date",
    }),
    due_date: validateVoucherDate(form?.due_date, {
      required: false,
      label: "Due date",
    }),
    amount: "",
    description: validateVoucherDescription(form?.description, {
      required: true,
    }),
    bank_ref: validateBankRef(form?.bank_ref),
    lines: "",
  };

  if (scope === "project" && !form?.primary_project_id) {
    errors.primary_project_id =
      "A project must be selected for project-scoped entries.";
  } else if (scope === "company" && form?.primary_project_id) {
    errors.primary_project_id =
      "Company-scoped entries cannot be attached to a specific project.";
  }

  if (docType === "drawing" && !form?.primary_user_id) {
    errors.primary_user_id =
      "Select the director or owner associated with this drawing.";
  }

  if (docType === "journal") {
    if (lines.length < 2) {
      errors.lines = "Manual journal entries require at least 2 balanced lines.";
    } else {
      let sumDr = 0;
      let sumCr = 0;
      for (let i = 0; i < lines.length; i += 1) {
        const ln = lines[i] || {};
        const dr = parseFloat(ln.debit || 0) || 0;
        const cr = parseFloat(ln.credit || 0) || 0;
        if (!ln.account_id) {
          errors.lines = `Journal line #${i + 1} requires an account.`;
          break;
        }
        if ((dr <= 0 && cr <= 0) || (dr > 0 && cr > 0)) {
          errors.lines = `Journal line #${i + 1} must carry either a Debit or Credit amount (not both).`;
          break;
        }
        sumDr += dr;
        sumCr += cr;
      }
      if (!errors.lines && Math.abs(sumDr - sumCr) > 0.009) {
        errors.lines = `Debits (${sumDr.toFixed(2)}) must equal Credits (${sumCr.toFixed(2)}).`;
      }
    }
  } else if (lines.length === 0) {
    errors.amount = validateVoucherAmount(form?.amount, { required: true });
  }

  if (!errors.tx_date && !errors.due_date && form?.due_date && form?.tx_date) {
    if (String(form.due_date) < String(form.tx_date)) {
      errors.due_date = "Due date cannot be earlier than the transaction date.";
    }
  }

  return errors;
}

/**
 * Batch validator for creating/editing Chart of Accounts records.
 * @param {object} form
 * @returns {{ code: string, name: string, account_class: string, normal_balance: string }}
 */
export function validateAccountForm(form) {
  const cls = String(form?.account_class ?? "").trim().toLowerCase();
  const nb = String(form?.normal_balance ?? "").trim().toLowerCase();
  return {
    code: validateAccountCode(form?.code, { required: true }),
    name: validateAccountName(form?.name, { required: true }),
    account_class: ALLOWED_ACCOUNT_CLASSES.has(cls)
      ? ""
      : "Select a valid account classification.",
    normal_balance:
      nb === "debit" || nb === "credit"
        ? ""
        : "Normal balance must be debit or credit.",
  };
}

/**
 * Batch validator for Debtors / Creditors settlement allocation.
 * @param {object} form
 * @param {number} [maxRemaining]
 * @returns {{ target_tx_id: string, amount: string, settlement_date: string, bank_ref: string }}
 */
export function validateSettlementForm(form, maxRemaining = null) {
  const amtError = validateVoucherAmount(form?.amount, { required: true });
  let boundError = amtError;
  if (!boundError && maxRemaining !== null && maxRemaining !== undefined) {
    const val = parseFloat(form?.amount);
    if (!isNaN(val) && val > Number(maxRemaining) + 0.001) {
      boundError = `Settlement cannot exceed remaining balance (${Number(maxRemaining).toLocaleString()}).`;
    }
  }

  return {
    target_tx_id: form?.target_tx_id ? "" : "Target invoice or bill is required.",
    amount: boundError,
    settlement_date: validateVoucherDate(form?.settlement_date, {
      required: true,
      label: "Settlement date",
    }),
    bank_ref: validateBankRef(form?.bank_ref),
  };
}
