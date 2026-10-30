import React, { useState, useEffect, useMemo, useCallback } from "react";
import ModalPortal from "../../../components/common/ModalPortal";
import Icon from "../../../components/common/Icon";
import VerificationBadge from "../../../components/common/VerificationBadge";
import { userService } from "../../../services/userService";
import toast from "react-hot-toast";
import "./UserPermissionsModal.css";

const UserPermissionsModal = ({
  user,
  isOpen,
  onClose,
  onPermissionsUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permData, setPermData] = useState(null);
  const [localGrants, setLocalGrants] = useState(new Set());
  const [localRevokes, setLocalRevokes] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [imgError, setImgError] = useState(false);
  const [error, setError] = useState(null);

  // Fetch user permissions details from backend
  const loadPermissions = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getUserPermissions(user.id);
      if (data) {
        setPermData(data);
        const grants = new Set();
        const revokes = new Set();
        if (data.overrides) {
          Object.entries(data.overrides).forEach(([key, isGranted]) => {
            const lowerKey = key.toLowerCase();
            if (isGranted) {
              grants.add(lowerKey);
            } else {
              revokes.add(lowerKey);
            }
          });
        }
        setLocalGrants(grants);
        setLocalRevokes(revokes);
      } else {
        throw new Error("No permission data returned from server.");
      }
    } catch (err) {
      console.error("Failed to load permissions:", err);
      const errMsg = err?.message || "Failed to load user permissions.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isOpen && user?.id) {
      setError(null);
      loadPermissions();
      setSearchQuery("");
      setSelectedCategory("all");
      setImgError(false);
    }
  }, [isOpen, user?.id, loadPermissions]);

  const displayName = user?.full_name || user?.username || "User";
  const userRolesList = useMemo(() => {
    if (!user) return ["User"];
    return user.roles && user.roles.length > 0
      ? user.roles
      : user.role
      ? [user.role]
      : ["User"];
  }, [user]);

  const primaryRole = userRolesList[0] || "User";
  const isAdmin = Boolean(
    permData?.is_admin || primaryRole.toLowerCase() === "admin"
  );

  const rolePermissionsSet = useMemo(() => {
    return new Set(
      (permData?.role_permissions || []).map((p) => p.toLowerCase())
    );
  }, [permData?.role_permissions]);

  // Check if a permission is currently active for this user
  const checkIsActive = useCallback(
    (permKey) => {
      if (isAdmin) return true;
      const lowerKey = permKey.toLowerCase();
      if (localGrants.has(lowerKey)) return true;
      if (localRevokes.has(lowerKey)) return false;
      return rolePermissionsSet.has(lowerKey);
    },
    [isAdmin, localGrants, localRevokes, rolePermissionsSet]
  );

  // Determine the status label & styling class for a permission
  const getPermissionStatus = useCallback(
    (permKey) => {
      if (isAdmin) {
        return { label: "Admin Master", badgeClass: "badge-admin", type: "admin" };
      }
      const lowerKey = permKey.toLowerCase();
      if (localGrants.has(lowerKey)) {
        return { label: "Custom Grant", badgeClass: "badge-grant", type: "grant" };
      }
      if (localRevokes.has(lowerKey)) {
        return { label: "Custom Revoked", badgeClass: "badge-revoke", type: "revoke" };
      }
      if (rolePermissionsSet.has(lowerKey)) {
        return { label: "Role Default", badgeClass: "badge-default", type: "default" };
      }
      return { label: "Disabled", badgeClass: "badge-disabled", type: "disabled" };
    },
    [isAdmin, localGrants, localRevokes, rolePermissionsSet]
  );

  // Toggle individual permission state
  const handleToggle = (permKey) => {
    if (isAdmin) return;
    const lowerKey = permKey.toLowerCase();
    const isCurrentlyActive = checkIsActive(lowerKey);
    const isDefaultRolePerm = rolePermissionsSet.has(lowerKey);

    const nextGrants = new Set(localGrants);
    const nextRevokes = new Set(localRevokes);

    if (isCurrentlyActive) {
      // Transition from active -> inactive
      if (isDefaultRolePerm) {
        nextRevokes.add(lowerKey);
      }
      nextGrants.delete(lowerKey);
    } else {
      // Transition from inactive -> active
      if (!isDefaultRolePerm) {
        nextGrants.add(lowerKey);
      }
      nextRevokes.delete(lowerKey);
    }

    setLocalGrants(nextGrants);
    setLocalRevokes(nextRevokes);
  };

  // Reset to role defaults
  const handleResetDefaults = async () => {
    if (isAdmin || !user?.id) return;
    try {
      await userService.resetUserPermissions(user.id);
      setLocalGrants(new Set());
      setLocalRevokes(new Set());
      toast.success("Reset to role default permissions.");
      loadPermissions();
    } catch (err) {
      toast.error(err.message || "Failed to reset permissions.");
    }
  };

  // Save changes
  const handleSave = async () => {
    if (isAdmin) {
      onClose();
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    try {
      const grantsList = Array.from(localGrants);
      const revokesList = Array.from(localRevokes);
      await userService.updateUserPermissions(user.id, grantsList, revokesList);
      toast.success("User permissions updated successfully.");
      if (onPermissionsUpdated) {
        onPermissionsUpdated();
      }
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  // Filtered catalog calculation
  const catalog = useMemo(() => {
    return permData?.catalog || [];
  }, [permData?.catalog]);

  const categories = useMemo(() => {
    return ["all", ...catalog.map((c) => c.category)];
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalog
      .map((cat) => {
        if (selectedCategory !== "all" && cat.category !== selectedCategory) {
          return null;
        }
        const filteredPerms = cat.permissions.filter((p) => {
          if (!q) return true;
          return (
            p.label.toLowerCase().includes(q) ||
            p.key.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q)
          );
        });
        if (filteredPerms.length === 0) return null;
        return {
          ...cat,
          permissions: filteredPerms,
        };
      })
      .filter(Boolean);
  }, [catalog, selectedCategory, searchQuery]);

  // Total and active counters
  const totalPermissionsCount = useMemo(() => {
    return catalog.reduce((acc, cat) => acc + cat.permissions.length, 0);
  }, [catalog]);

  const activePermissionsCount = useMemo(() => {
    if (isAdmin) return totalPermissionsCount;
    let count = 0;
    catalog.forEach((cat) => {
      cat.permissions.forEach((p) => {
        if (checkIsActive(p.key)) count++;
      });
    });
    return count;
  }, [catalog, isAdmin, totalPermissionsCount, checkIsActive]);

  const totalOverridesCount = localGrants.size + localRevokes.size;

  if (!isOpen || !user) return null;

  const initial = displayName.charAt(0).toUpperCase();

  return (
    <ModalPortal
      onClose={onClose}
      size="large"
      className="global-modal-glass user-permissions-modal-glass"
    >
      <div className="user-permissions-modal-content">
        {/* Modal Header: Profile visual header for desktop & mobile */}
        <div className="upm-header">
          <div className="upm-user-profile">
            <div className="upm-avatar-wrap">
              {user.profile_image && !imgError ? (
                <img
                  src={user.profile_image}
                  alt={displayName}
                  className="upm-avatar-img"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="upm-avatar-fallback">
                  {initial}
                </span>
              )}
              <div className="upm-avatar-badge" title={primaryRole}>
                <VerificationBadge
                  tier={user.verified_level || primaryRole}
                  size="sm"
                />
              </div>
            </div>

            <div className="upm-user-meta">
              <div className="upm-title-row">
                <h3 className="upm-user-name">{displayName}</h3>
              </div>
              <span className="upm-user-handle">@{user.username}</span>

              <div className="upm-badges-row">
                <span
                  className={`status-badge ${
                    user.is_approved !== false
                      ? "status-approved"
                      : "status-pending"
                  }`}
                >
                  {user.is_approved !== false ? "Active Profile" : "Pending"}
                </span>
                <span className={`upm-role-chip ${isAdmin ? "admin" : ""}`}>
                  {isAdmin ? "ADMIN" : primaryRole.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="upm-header-stats">
            <div className="upm-stat-pill">
              <span>Scope:</span>
              <strong>
                {permData
                  ? `${activePermissionsCount} of ${totalPermissionsCount} Active`
                  : "--"}
              </strong>
            </div>
            {totalOverridesCount > 0 && !isAdmin && permData && (
              <div className="upm-stat-pill has-overrides">
                <span>Overrides:</span>
                <strong>{totalOverridesCount}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="upm-controls-bar">
          <div className="upm-search-box">
            <span className="upm-search-icon">
              <Icon name="search" modifiers="sm" />
            </span>
            <input
              type="text"
              className="upm-search-input"
              placeholder="Search permissions by name, key, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {!isAdmin && (
            <button
              type="button"
              className="btn-neo upm-reset-btn"
              onClick={handleResetDefaults}
              disabled={totalOverridesCount === 0 || loading}
              title="Reset all customized permissions back to standard role defaults"
              aria-label="Reset to Defaults"
            >
              <Icon name="restart_alt" modifiers="sm" />
              <span>Reset to Defaults</span>
            </button>
          )}
        </div>

        {/* Category Filter Tabs */}
        <div className="upm-categories-nav">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`upm-category-pill ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat === "all" ? "All Activities" : cat}
            </button>
          ))}
        </div>

        {/* Scrollable Permissions Body */}
        <div className="upm-body-scroll">
          {loading ? (
            <div className="upm-loading-state">
              <Icon name="sync" modifiers="spin lg" />
              <span>Loading permission matrix...</span>
            </div>
          ) : error || !permData ? (
            <div className="upm-error-state">
              <Icon name="error" modifiers="xl" />
              <p className="upm-error-message">
                {error || "Unable to retrieve permission catalog from server."}
              </p>
              <button
                type="button"
                className="btn-neo btn-neo-solid upm-retry-btn"
                onClick={loadPermissions}
              >
                <Icon name="refresh" modifiers="sm" />
                <span>Retry Loading</span>
              </button>
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="upm-empty-state">
              <Icon name="search_off" modifiers="lg" />
              <span>No permissions match your filter criteria.</span>
            </div>
          ) : (
            filteredCatalog.map((cat) => (
              <div key={cat.category} className="upm-category-section">
                <div className="upm-category-header">
                  <h4 className="upm-category-title">{cat.category}</h4>
                  {cat.description && (
                    <span className="upm-category-desc">{cat.description}</span>
                  )}
                </div>

                <div className="upm-cards-grid">
                  {cat.permissions.map((perm) => {
                    const isActive = checkIsActive(perm.key);
                    const status = getPermissionStatus(perm.key);
                    const isGrant = status.type === "grant";
                    const isRevoke = status.type === "revoke";

                    let cardModifier = "";
                    if (isActive) cardModifier = "is-active";
                    if (isGrant) cardModifier += " is-override-grant";
                    if (isRevoke) cardModifier += " is-override-revoke";

                    return (
                      <div
                        key={perm.key}
                        className={`upm-perm-card ${cardModifier}`}
                      >
                        <div className="upm-perm-info">
                          <div className="upm-perm-top-row">
                            <span className="upm-perm-label">{perm.label}</span>
                            <span className="upm-perm-key">{perm.key}</span>
                          </div>
                          <p className="upm-perm-desc">{perm.description}</p>
                          <span className={`upm-perm-badge ${status.badgeClass}`}>
                            {status.label}
                          </span>
                        </div>

                        <button
                          type="button"
                          className={`upm-toggle-switch ${isActive ? "active" : ""} ${isGrant ? "is-grant" : ""}`}
                          onClick={() => handleToggle(perm.key)}
                          disabled={isAdmin}
                          title={
                            isAdmin
                              ? "Admin accounts possess full system permissions."
                              : isActive
                              ? "Click to revoke this permission"
                              : "Click to grant this permission"
                          }
                          aria-label={`Toggle ${perm.label}`}
                        >
                          <span className="upm-toggle-slider" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="upm-footer">
          <div className="upm-footer-left">
            <span>
              {isAdmin
                ? "Admin role has universal access across all modules."
                : "Toggling custom overrides modifies real-time access for this user."}
            </span>
          </div>
          <div className="upm-footer-actions">
            <button
              type="button"
              className="btn-neo-cancel upm-btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              <span>Cancel</span>
            </button>
            <button
              type="button"
              className="btn-neo btn-neo-solid upm-btn-save"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? (
                <>
                  <Icon name="sync" modifiers="spin sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Icon name="check" modifiers="sm" />
                  <span>Save Permissions</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default UserPermissionsModal;
