import { useEffect, useState } from "react";
import { userService } from "../../../services/userService";
import { useAuth } from "../../auth/context/AuthContext";
import { validateEditProfileForm } from "../../../utils/validators";
import HoverTooltip from "../../../components/common/HoverTooltip";
import Icon from "../../../components/common/Icon";
import FloatingInput from "../../../components/common/FloatingInput";
import NeoButton from "../../../components/common/NeoButton";
import "./EditProfile.css";

const EditProfile = ({ onClose }) => {
  const { user, checkAuth } = useAuth();
  const [profile, setProfile] = useState({
    username: "",
    full_name: "",
    email: "",
    profile_image: "",
    theme_mode: user?.theme_mode || "dark",
    email_notifications: true,
    pause_notifications: false,
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [touched, setTouched] = useState({
    username: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  const validationErrors = validateEditProfileForm(profile, password, confirmPassword);

  const hasErrors = !!(
    validationErrors.username ||
    validationErrors.email ||
    validationErrors.password ||
    validationErrors.confirmPassword
  );


  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await userService.getProfile();
        if (data) {
          setProfile({
            username: data.username || "",
            full_name: data.full_name || "",
            email: data.email || "",
            profile_image: data.profile_image || "",
            theme_mode: user?.theme_mode || data.theme_mode || "dark",
            email_notifications: data.email_notifications === 1 || data.email_notifications === true,
            pause_notifications: data.pause_notifications === 1 || data.pause_notifications === true,
          });
        }
      } catch (err) {
        setErrorMsg(err.message || "Failed to load profile settings.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (field, val) => {
    setProfile((prev) => {
      const next = { ...prev, [field]: val };
      return next;
    });
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("Image size should be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      handleChange("profile_image", reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({
      username: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    setErrorMsg("");
    setSuccessMsg("");

    if (hasErrors) {
      setErrorMsg("Please fix the validation errors before submitting.");
      return;
    }

    if (password && password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        ...profile,
        theme_mode: user?.theme_mode || profile.theme_mode,
        password: password || undefined,
      };

      await userService.updateProfile(payload);
      setSuccessMsg("Profile updated successfully!");
      setPassword("");
      setConfirmPassword("");
      setTouched({ username: false, email: false, password: false, confirmPassword: false });
      await checkAuth(); // Refresh global auth state (like changed username)
    } catch (err) {
      setErrorMsg(err.message || "Failed to submit profile changes.");
    } finally {
      setSubmitting(false);
    }
  };

  const initial = profile.full_name ? profile.full_name.charAt(0).toUpperCase() : (profile.username ? profile.username.charAt(0).toUpperCase() : "?");

  return (
    <div className={onClose ? "edit-profile-modal-wrapper" : "edit-profile-container"}>
      <div className={onClose ? "edit-profile-modal-content" : "edit-profile-card glass-sandblasted"}>
        {loading ? (
          <div className="profile-skeleton-wrapper">
            {/* Header Section Skeleton */}
            <div className="modal-header-section profile-skeleton-header">
              <div className="skeleton-line skeleton-header-title"></div>
              <div className="skeleton-line skeleton-header-sub"></div>
            </div>
            <div className="profile-modal-split">
              {/* Left Side Panel Skeleton */}
              <div className="profile-modal-side skeleton-card">
                <div className="skeleton-line skeleton-title"></div>
                <div className="skeleton-avatar"></div>
                <div className="skeleton-line skeleton-text"></div>
              </div>

              {/* Right Main Content Skeleton */}
              <div className="profile-modal-main">
                <div className="form-grid">
                  <div className="profile-form-group">
                    <div className="skeleton-line skeleton-label"></div>
                    <div className="skeleton-input"></div>
                  </div>
                  <div className="profile-form-group">
                    <div className="skeleton-line skeleton-label"></div>
                    <div className="skeleton-input"></div>
                  </div>
                  <div className="profile-form-group skeleton-email-group">
                    <div className="skeleton-line skeleton-label"></div>
                    <div className="skeleton-input"></div>
                  </div>
                  <div className="profile-form-group password-group">
                    <div className="password-fields-grid">
                      <div className="password-field-item">
                        <div className="skeleton-line skeleton-label"></div>
                        <div className="skeleton-input"></div>
                      </div>
                      <div className="password-field-item">
                        <div className="skeleton-line skeleton-label"></div>
                        <div className="skeleton-input"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="notifications-section skeleton-notifications">
                  <div className="skeleton-line skeleton-subtitle"></div>
                  <div className="skeleton-toggle-item"></div>
                  <div className="skeleton-toggle-item"></div>
                </div>

                <div className="profile-form-actions skeleton-actions">
                  <div className="skeleton-button"></div>
                  <div className="skeleton-button"></div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="modal-header-section">
              <h2>Edit Profile</h2>
              <p>Manage your account settings, theme, and notifications</p>
            </div>

            <div className="neo-status-messages">
              <div className={`neo-status error ${errorMsg ? "show" : ""}`}>
                <Icon name="error" modifiers="sm" /> <span>{errorMsg}</span>
              </div>
              <div className={`neo-status success ${successMsg ? "show" : ""}`}>
                <Icon name="check_circle" modifiers="sm" /> <span>{successMsg}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="edit-profile-form">
          <div className="profile-modal-split">
            {/* Left Side Panel */}
            <div className="profile-modal-side">
              <label className="side-panel-label">Profile Visual</label>
              
              {/* Avatar Section */}
              <div className="avatar-upload-section">
                <div className="avatar-preview-container">
                  {profile.profile_image ? (
                    <img src={profile.profile_image} alt="Profile" className="avatar-img-preview" />
                  ) : (
                    <div className="avatar-text-preview">{initial}</div>
                  )}
                  <HoverTooltip 
                    text="Upload New Photo" 
                    wrapperClassName="avatar-tooltip-wrapper"
                  >
                    <label 
                      htmlFor="avatar-file-input" 
                      className="avatar-edit-badge avatar-badge-static"
                    >
                      <Icon name="edit" modifiers="sm" />
                    </label>
                  </HoverTooltip>
                </div>
                <input
                  id="avatar-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="avatar-hidden-file-input"
                />
                <span className="avatar-upload-label">Max 2MB</span>
              </div>
            </div>

            {/* Right Main Content */}
            <div className="profile-modal-main">
              <div className="form-grid">
                {/* Change Name */}
                <FloatingInput
                  label="Full Name"
                  placeholder="Your full name"
                  value={profile.full_name}
                  onChange={(e) => handleChange("full_name", e.target.value)}
                />

                {/* Change Username */}
                <FloatingInput
                  label="Username"
                  required
                  value={profile.username}
                  onChange={(e) => handleChange("username", e.target.value)}
                  error={touched.username && validationErrors.username ? validationErrors.username : ""}
                />

                {/* Change Email */}
                <FloatingInput
                  className="email-group"
                  type="email"
                  label="Email Address"
                  placeholder="name@example.com"
                  value={profile.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  error={touched.email && validationErrors.email ? validationErrors.email : ""}
                />

                <div className="profile-form-group password-group">
                  <div className="password-fields-grid">
                    <FloatingInput
                      type="password"
                      label="New Password (Optional)"
                      placeholder="Leave blank to keep current"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setTouched((prev) => ({ ...prev, password: true }));
                      }}
                      error={touched.password && validationErrors.password ? validationErrors.password : ""}
                    />

                    <FloatingInput
                      type="password"
                      label="Confirm Password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setTouched((prev) => ({ ...prev, confirmPassword: true }));
                      }}
                      error={touched.confirmPassword && validationErrors.confirmPassword ? validationErrors.confirmPassword : ""}
                    />
                  </div>
                </div>
              </div>

              {/* Notifications Section */}
              <div className="notifications-section">
                <h3>Notification Settings</h3>
                
                <div className="notification-toggle-item">
                  <label className="toggle-label-wrapper">
                    <input
                      type="checkbox"
                      checked={profile.email_notifications}
                      onChange={(e) => handleChange("email_notifications", e.target.checked)}
                    />
                    <span className="toggle-custom-checkbox"></span>
                    <div className="toggle-text-info">
                      <span className="toggle-title">Email Notifications</span>
                      <span className="toggle-desc">Receive project updates and payment receipts via email</span>
                    </div>
                  </label>
                </div>

                <div className="notification-toggle-item">
                  <label className="toggle-label-wrapper">
                    <input
                      type="checkbox"
                      checked={profile.pause_notifications}
                      onChange={(e) => handleChange("pause_notifications", e.target.checked)}
                    />
                    <span className="toggle-custom-checkbox"></span>
                    <div className="toggle-text-info">
                      <span className="toggle-title">Pause Notifications</span>
                      <span className="toggle-desc">Temporarily mute all notification alerts</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="profile-form-actions">
                {onClose && (
                  <NeoButton type="button" variant="cancel" onClick={onClose} disabled={submitting}>
                    Cancel
                  </NeoButton>
                )}
                <NeoButton 
                  type="submit" 
                  variant="solid" 
                  loading={submitting}
                  disabled={hasErrors || !profile.username.trim()}
                  disabledReason={
                    !profile.username.trim()
                      ? "Username is required"
                      : hasErrors
                      ? "Please resolve form validation errors"
                      : ""
                  }
                >
                  Save Profile
                </NeoButton>
              </div>
            </div>
          </div>
        </form>
      </>
    )}
      </div>
    </div>
  );
};

export default EditProfile;
