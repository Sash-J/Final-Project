import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  validateAddress,
  validateConfirmPassword,
  validatePassword,
  validateTelephone,
  validateUsername,
} from "../../../utils/validators";
import "./RegisterPage.css";

import { authService } from "../../../services/authService";
import Icon from "../../../components/common/Icon";

const RegisterPage = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { startTransition } = useAuth();

  // Field States
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    gender: "male",
    full_name: "",
    telephone: "",
    address: "",
    // 3-Tier Filter state
    mainCategory: "client", // "client" | "crew"
    clientTier: "full", // "full" | "half"
    clientFullSkill: "Artist",
    clientHalfSkill: "Cast",
    crewType: "external", // "external" | "internal"
    internalRole: "Director",
    externalRole: "Crew", // "Department Head" | "Crew"
    deptHeadSkill: "Art",
    customDept: "",
  });

  const [fieldErrors, setFieldErrors] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    full_name: "",
    telephone: "",
    address: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateField = (name, value, currentPassword = formData.password) => {
    let err = "";
    switch (name) {
      case "username":
        err = validateUsername(value);
        break;
      case "password":
        err = validatePassword(value);
        break;
      case "confirmPassword":
        err = validateConfirmPassword(value, currentPassword);
        break;
      case "address":
        err = validateAddress(value);
        break;
      default:
        break;
    }
    setFieldErrors((prev) => ({ ...prev, [name]: err }));
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value.replace(/[^a-zA-Z_]/g, "");
    setFormData((prev) => ({ ...prev, username: value }));
    setFieldErrors((prev) => ({ ...prev, username: "" }));
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value.replace(/\s/g, "");
    const passError = validatePassword(value);

    setFormData((prev) => {
      const newData = { ...prev, password: value };
      if (!value || passError) {
        newData.confirmPassword = "";
      }
      return newData;
    });

    validateField("password", value);

    if (!value || passError) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
    } else if (formData.confirmPassword) {
      validateField("confirmPassword", formData.confirmPassword, value);
    }
  };

  const handleConfirmChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, confirmPassword: value }));
    validateField("confirmPassword", value);
  };

  const handleAddressChange = (e) => {
    const value = e.target.value.replace(/[<>{}[\]]/g, "");
    setFormData((prev) => ({ ...prev, address: value }));
    setFieldErrors((prev) => ({ ...prev, address: "" }));
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    const filteredValue = value.replace(/(?!^\+)\D/g, "");
    setFormData((prev) => ({ ...prev, telephone: filteredValue }));
    setFieldErrors((prev) => ({
      ...prev,
      telephone: validateTelephone(filteredValue),
    }));
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    const filteredValue = value.replace(/[^a-zA-Z\s]/g, "");
    setFormData((prev) => ({ ...prev, full_name: filteredValue }));
  };

  // Helper to calculate the final Role and Skill for submission and preview
  const getResolvedRoleAndSkill = () => {
    if (formData.mainCategory === "client") {
      if (formData.clientTier === "full") {
        return {
          role: "Client (Full Access)",
          skill: formData.clientFullSkill,
        };
      }
      return {
        role: "Client (Half Access)",
        skill: formData.clientHalfSkill,
      };
    }
    // Production Crew
    if (formData.crewType === "internal") {
      return {
        role: formData.internalRole,
        skill: formData.internalRole,
      };
    }
    // External Crew
    if (formData.externalRole === "Department Head") {
      const skillName =
        formData.deptHeadSkill === "Other"
          ? formData.customDept.trim() || "Department Head"
          : formData.deptHeadSkill;
      return {
        role: "Department Head",
        skill: skillName,
      };
    }
    return {
      role: "Crew",
      skill: "General Crew",
    };
  };

  const nextStep = () => {
    if (step === 1) {
      const { username, password, confirmPassword } = formData;
      if (!username || !password || !confirmPassword) {
        setError("Please fill all required account fields in Step 1.");
        return;
      }

      if (
        fieldErrors.username ||
        fieldErrors.password ||
        fieldErrors.confirmPassword
      ) {
        setError("Please fix the errors in Step 1 first.");
        return;
      }
    } else if (step === 2) {
      if (!formData.full_name || !formData.telephone || !formData.address) {
        setError("Full Name, Telephone, and Address are required.");
        return;
      }

      if (fieldErrors.full_name || fieldErrors.telephone || fieldErrors.address) {
        setError("Please fix the errors in Step 2 first.");
        return;
      }
    }
    setError("");
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setError("");
    setStep((prev) => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const { role, skill } = getResolvedRoleAndSkill();

    const payload = {
      username: formData.username,
      password: formData.password,
      role,
      skill,
      gender: formData.gender,
      full_name: formData.full_name,
      telephone: formData.telephone,
      address: formData.address,
    };

    try {
      const data = await authService.register(payload);
      setMessage(data.message || "Registration successful. Pending admin approval.");
      setTimeout(() => startTransition("/login"), 2500);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const { role: resolvedRole, skill: resolvedSkill } = getResolvedRoleAndSkill();

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <h3>Step 1: Account & Credentials</h3>
            <div className="neo-form-group">
              <label className="neo-label">Username</label>
              <input
                className="neo-input"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleUsernameChange}
                required
                maxLength={30}
                placeholder="Choose a username"
              />
              {fieldErrors.username && (
                <span className="neo-field-error-msg">
                  {fieldErrors.username}
                </span>
              )}
            </div>
            <div className="neo-form-group password-group">
              <label className="neo-label">Password</label>
              <div className="password-input-wrapper">
                <input
                  className="neo-input"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handlePasswordChange}
                  required
                  placeholder="Choose a password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide Password" : "Show Password"}
                >
                  <Icon name={showPassword ? "visibility" : "visibility_off"} modifiers="sm" />
                </button>
              </div>
              {fieldErrors.password && (
                <span className="neo-field-error-msg">
                  {fieldErrors.password}
                </span>
              )}
            </div>

            {formData.password && !fieldErrors.password && (
              <div className="neo-form-group password-group animate-in">
                <label className="neo-label">Confirm Password</label>
                <div className="password-input-wrapper">
                  <input
                    className="neo-input"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleConfirmChange}
                    required
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    title={
                      showConfirmPassword ? "Hide Password" : "Show Password"
                    }
                  >
                    <Icon name={showConfirmPassword ? "visibility" : "visibility_off"} modifiers="sm" />
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <span className="neo-field-error-msg">
                    {fieldErrors.confirmPassword}
                  </span>
                )}
              </div>
            )}

            {/* Gender Selection */}
            <div className="neo-form-group">
              <label className="neo-label">Gender</label>
              <div className="register-gender-selector">
                {[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                  { value: "prefer_not_to_say", label: "Prefer not to say" },
                ].map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    className={`register-gender-btn ${formData.gender === g.value ? "active" : ""}`}
                    onClick={() => setFormData((prev) => ({ ...prev, gender: g.value }))}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn-neo btn-neo-solid next-btn register-btn-full"
              onClick={nextStep}
              disabled={
                !formData.username ||
                !formData.password ||
                !formData.confirmPassword ||
                fieldErrors.username ||
                fieldErrors.password ||
                fieldErrors.confirmPassword
              }
            >
              Next: Personal Details
            </button>
          </div>
        );
      case 2:
        return (
          <div className="step-content animate-in">
            <h3>Step 2: Personal & Contact Info</h3>
            <div className="neo-form-group">
              <label className="neo-label">Full Name</label>
              <input
                className="neo-input"
                name="full_name"
                type="text"
                value={formData.full_name}
                onChange={handleNameChange}
                required
                maxLength={100}
                placeholder="Enter your full name"
              />
            </div>
            <div className="neo-form-group">
              <label className="neo-label">Telephone</label>
              <input
                className="neo-input"
                name="telephone"
                type="tel"
                value={formData.telephone}
                onChange={handlePhoneChange}
                required
                maxLength={20}
                placeholder="07XXXXXXXX"
              />
              {fieldErrors.telephone && (
                <span className="neo-field-error-msg">
                  {fieldErrors.telephone}
                </span>
              )}
            </div>
            <div className="neo-form-group">
              <label className="neo-label">Physical Address</label>
              <textarea
                className="neo-input"
                name="address"
                value={formData.address}
                onChange={handleAddressChange}
                required
                maxLength={500}
                placeholder="Enter your residential or studio address"
                rows="3"
              ></textarea>
              {fieldErrors.address && (
                <span className="neo-field-error-msg">
                  {fieldErrors.address}
                </span>
              )}
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn-neo-cancel prev-btn register-btn-icon"
                onClick={prevStep}
              >
                <Icon name="arrow_back" modifiers="sm" />
              </button>
              <button
                type="button"
                className="btn-neo btn-neo-solid next-btn register-btn-flex"
                onClick={nextStep}
                disabled={
                  !formData.full_name ||
                  !formData.telephone ||
                  !formData.address ||
                  fieldErrors.telephone ||
                  fieldErrors.address
                }
              >
                Next: Role & Classification
              </button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="step-content animate-in">
            <h3>Step 3: Role & Classification</h3>

            {/* Filter 1: Main Category */}
            <div className="filter-tier-group">
              <label className="filter-tier-label">
                <Icon name="category" modifiers="xs" /> Filter 1: Organization Role
              </label>
              <div className="filter-pills-row">
                <button
                  type="button"
                  className={`filter-pill ${formData.mainCategory === "client" ? "active" : ""}`}
                  onClick={() => setFormData((prev) => ({ ...prev, mainCategory: "client" }))}
                >
                  <Icon name="person" modifiers="sm" />
                  <span>Client / Artist</span>
                </button>
                <button
                  type="button"
                  className={`filter-pill ${formData.mainCategory === "crew" ? "active" : ""}`}
                  onClick={() => setFormData((prev) => ({ ...prev, mainCategory: "crew" }))}
                >
                  <Icon name="movie" modifiers="sm" />
                  <span>Production Crew</span>
                </button>
              </div>
            </div>

            {/* Filter 2 & 3 for CLIENT */}
            {formData.mainCategory === "client" && (
              <>
                <div className="filter-tier-group animate-in">
                  <label className="filter-tier-label">
                    <Icon name="tune" modifiers="xs" /> Filter 2: Client Access Level
                  </label>
                  <div className="filter-pills-row">
                    <button
                      type="button"
                      className={`filter-pill ${formData.clientTier === "full" ? "active" : ""}`}
                      onClick={() => setFormData((prev) => ({ ...prev, clientTier: "full" }))}
                    >
                      <Icon name="verified" modifiers="sm" />
                      <span>Full Access</span>
                    </button>
                    <button
                      type="button"
                      className={`filter-pill ${formData.clientTier === "half" ? "active" : ""}`}
                      onClick={() => setFormData((prev) => ({ ...prev, clientTier: "half" }))}
                    >
                      <Icon name="shield" modifiers="sm" />
                      <span>Half Access</span>
                    </button>
                  </div>
                </div>

                <div className="filter-tier-group animate-in">
                  <label className="filter-tier-label">
                    <Icon name="workspace_premium" modifiers="xs" /> Filter 3: Category / Skill
                  </label>
                  {formData.clientTier === "full" ? (
                    <div className="filter-skills-grid">
                      {[
                        "Artist",
                        "Producer",
                        "Director",
                        "Corporate client",
                        "Colloborated production house",
                      ].map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          className={`filter-skill-pill ${formData.clientFullSkill === skill ? "active" : ""}`}
                          onClick={() => setFormData((prev) => ({ ...prev, clientFullSkill: skill }))}
                        >
                          {skill}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="filter-skills-grid">
                      {[
                        "Cast",
                        "Actor / Actress",
                        "Model",
                        "Child Actor",
                        "Extras",
                      ].map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          className={`filter-skill-pill ${formData.clientHalfSkill === skill ? "active" : ""}`}
                          onClick={() => setFormData((prev) => ({ ...prev, clientHalfSkill: skill }))}
                        >
                          {skill}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Filter 2 & 3 for PRODUCTION CREW */}
            {formData.mainCategory === "crew" && (
              <>
                <div className="filter-tier-group animate-in">
                  <label className="filter-tier-label">
                    <Icon name="tune" modifiers="xs" /> Filter 2: Crew Category
                  </label>
                  <div className="filter-pills-row">
                    <button
                      type="button"
                      className={`filter-pill ${formData.crewType === "external" ? "active" : ""}`}
                      onClick={() => setFormData((prev) => ({ ...prev, crewType: "external" }))}
                    >
                      <Icon name="groups" modifiers="sm" />
                      <span>External Crew</span>
                    </button>
                    <button
                      type="button"
                      className={`filter-pill ${formData.crewType === "internal" ? "active" : ""}`}
                      onClick={() => setFormData((prev) => ({ ...prev, crewType: "internal" }))}
                    >
                      <Icon name="badge" modifiers="sm" />
                      <span>Internal Team</span>
                    </button>
                  </div>
                </div>

                {formData.crewType === "internal" ? (
                  <div className="filter-tier-group animate-in">
                    <label className="filter-tier-label">
                      <Icon name="workspace_premium" modifiers="xs" /> Filter 3: Internal Designation
                    </label>
                    <div className="filter-skills-grid">
                      {[
                        "Director",
                        "Manager",
                        "Accountant",
                        "Coordinator",
                        "Viewer",
                      ].map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={`filter-skill-pill ${formData.internalRole === r ? "active" : ""}`}
                          onClick={() => setFormData((prev) => ({ ...prev, internalRole: r }))}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="filter-tier-group animate-in">
                      <label className="filter-tier-label">
                        <Icon name="manage_accounts" modifiers="xs" /> Filter 3: External Role
                      </label>
                      <div className="filter-pills-row">
                        <button
                          type="button"
                          className={`filter-pill ${formData.externalRole === "Department Head" ? "active" : ""}`}
                          onClick={() => setFormData((prev) => ({ ...prev, externalRole: "Department Head" }))}
                        >
                          <Icon name="engineering" modifiers="sm" />
                          <span>Dept Head</span>
                        </button>
                        <button
                          type="button"
                          className={`filter-pill ${formData.externalRole === "Crew" ? "active" : ""}`}
                          onClick={() => setFormData((prev) => ({ ...prev, externalRole: "Crew" }))}
                        >
                          <Icon name="group" modifiers="sm" />
                          <span>General Crew</span>
                        </button>
                      </div>
                    </div>

                    {formData.externalRole === "Department Head" && (
                      <div className="filter-tier-group animate-in">
                        <label className="filter-tier-label">
                          <Icon name="construction" modifiers="xs" /> Department Assignment
                        </label>
                        <div className="filter-skills-grid">
                          {[
                            "Art",
                            "Light",
                            "Camera",
                            "Sound",
                            "Technical Advisor",
                            "Gaffer",
                            "Costume",
                            "Other",
                          ].map((d) => (
                            <button
                              key={d}
                              type="button"
                              className={`filter-skill-pill ${formData.deptHeadSkill === d ? "active" : ""}`}
                              onClick={() => setFormData((prev) => ({ ...prev, deptHeadSkill: d }))}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                        {formData.deptHeadSkill === "Other" && (
                          <div className="neo-form-group animate-in">
                            <input
                              className="neo-input"
                              type="text"
                              value={formData.customDept}
                              onChange={(e) => setFormData((prev) => ({ ...prev, customDept: e.target.value }))}
                              placeholder="Specify department name..."
                              maxLength={50}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Resolved Role Summary Banner */}
            <div className="role-summary-banner">
              <span>Selected Role:</span>
              <span className="role-summary-highlight">
                {resolvedRole} {resolvedSkill && `(${resolvedSkill})`}
              </span>
            </div>

            <div className="btn-row">
              <button
                type="button"
                className="btn-neo-cancel prev-btn register-btn-icon"
                onClick={prevStep}
              >
                <Icon name="arrow_back" modifiers="sm" />
              </button>
              <button
                type="submit"
                className="btn-neo btn-neo-solid submit-btn register-btn-flex"
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Finish Registration"}
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="progress-bar-container">
          <div
            className="progress-bar"
            style={{ width: `${(step / 3) * 100}%` }}
          ></div>
        </div>
        <h2>{step === 3 ? "CLASSIFICATION" : step === 2 ? "DETAILS" : "JOIN US"}</h2>
        <div className="step-indicator">Step {step} of 3</div>

        <form onSubmit={handleSubmit}>
          {renderStep()}
          <div className="neo-status-messages register-status-wrapper">
            <div className={`neo-status error ${error ? "show" : ""}`}>
              <Icon name="error" modifiers="sm" /> <span>{error}</span>
            </div>
            <div className={`neo-status success ${message ? "show" : ""}`}>
              <Icon name="check_circle" modifiers="sm" /> <span>{message}</span>
            </div>
          </div>
        </form>

        <div className="register-footer">
          <p>
            Already have an account? <Link to="/login">Login here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
