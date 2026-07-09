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
    role: "client",
    full_name: "",
    telephone: "",
    address: "",
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
    let error = "";
    switch (name) {
      case "username":
        error = validateUsername(value);
        break;
      case "password":
        error = validatePassword(value);
        break;
      case "confirmPassword":
        error = validateConfirmPassword(value, currentPassword);
        break;
      case "address":
        error = validateAddress(value);
        break;
      default:
        break;
    }
    setFieldErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value.replace(/[^a-zA-Z_]/g, "");
    setFormData({ ...formData, username: value });
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
    setFormData({ ...formData, confirmPassword: value });
    validateField("confirmPassword", value);
  };

  const handleAddressChange = (e) => {
    const value = e.target.value.replace(/[<>{}[\]]/g, "");
    setFormData({ ...formData, address: value });
    setFieldErrors((prev) => ({ ...prev, address: "" }));
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    const filteredValue = value.replace(/(?!^\+)\D/g, "");
    setFormData({ ...formData, telephone: filteredValue });
    setFieldErrors((prev) => ({ ...prev, telephone: validateTelephone(filteredValue) }));
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    const filteredValue = value.replace(/[^a-zA-Z\s]/g, "");
    setFormData({ ...formData, full_name: filteredValue });
  };

  const nextStep = () => {
    if (step === 1) {
      const { username, password } = formData;
      if (!username || !password) {
        setError("Username and password are required.");
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
      if (!formData.full_name || !formData.telephone) {
        setError("Full Name and Telephone are required.");
        return;
      }

      if (fieldErrors.full_name || fieldErrors.telephone) {
        setError("Please fix the errors in Step 2 first.");
        return;
      }
    }
    setError("");
    setStep(step + 1);
  };

  const prevStep = () => {
    setError("");
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const data = await authService.register(formData);
      setMessage(data.message);
      setTimeout(() => startTransition("/login"), 2500);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <h3>Step 1: Account Credentials</h3>
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
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  )}
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
                    {showConfirmPassword ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    )}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <span className="neo-field-error-msg">
                    {fieldErrors.confirmPassword}
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              className="btn-neo btn-neo-solid next-btn"
              style={{ width: '100%', padding: '16px' }}
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
            <h3>Step 2: Personal Details</h3>
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
            <div className="btn-row">
              <button type="button" className="btn-neo-cancel prev-btn" onClick={prevStep} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <button
                type="button"
                className="btn-neo btn-neo-solid next-btn"
                style={{ flex: 1, padding: '16px' }}
                onClick={nextStep}
                disabled={
                  !formData.full_name ||
                  !formData.telephone ||
                  fieldErrors.telephone
                }
              >
                Next: Contact Info
              </button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="step-content animate-in">
            <h3>Step 3: Contact Information</h3>
            <div className="neo-form-group">
              <label className="neo-label">Physical Address</label>
              <textarea
                className="neo-input"
                name="address"
                value={formData.address}
                onChange={handleAddressChange}
                required
                maxLength={500}
                placeholder="Enter your full address"
                rows="4"
              ></textarea>
              {fieldErrors.address && (
                <span className="neo-field-error-msg">
                  {fieldErrors.address}
                </span>
              )}
            </div>
            <div className="btn-row">
              <button type="button" className="btn-neo-cancel prev-btn" onClick={prevStep} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <button
                type="submit"
                className="btn-neo btn-neo-solid submit-btn"
                style={{ flex: 1, padding: '16px' }}
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
        <h2>{step === 3 ? "FINALIZE" : "JOIN US"}</h2>
        <div className="step-indicator">Step {step} of 3</div>

        <form onSubmit={handleSubmit}>
          {renderStep()}
          <div className="neo-status-messages" style={{ marginTop: "10px", minHeight: "40px" }}>
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
