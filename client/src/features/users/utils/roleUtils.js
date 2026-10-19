/**
 * Dynamic role utilities for user management, role categorization, and option formatting.
 * Eliminates hardcoded role lists and ensures resilience to database updates.
 */

const CLIENT_KEYWORDS = ["client", "guest", "customer"];

const CREW_KEYWORDS = [
  "crew",
  "department head",
  "dept head",
  "operator",
  "technician",
  "camera",
  "sound",
  "lighting",
  "grip",
  "art",
  "wardrobe",
  "makeup",
  "vfx",
  "editor",
  "stunt",
  "gaffer",
  "boom",
];

const EXEC_KEYWORDS = [
  "admin",
  "director",
  "manager",
  "producer",
  "lead",
  "executive",
];

const STAFF_KEYWORDS = [
  "accountant",
  "coordinator",
  "viewer",
  "finance",
  "supervisor",
  "assistant",
];

/**
 * Categorizes a user's role(s) into one of 3 primary system pipelines:
 * 'internal' | 'crew' | 'client'
 */
export const categorizeRole = (roleOrRoles) => {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  const normalized = roles
    .filter(Boolean)
    .map((r) => String(r).trim().toLowerCase());

  if (normalized.length === 0) return "client";

  // 1. Executive and internal staff always take precedence (Internal Crew)
  if (
    normalized.some(
      (r) =>
        EXEC_KEYWORDS.some((kw) => r.includes(kw)) ||
        STAFF_KEYWORDS.some((kw) => r.includes(kw))
    )
  ) {
    return "internal";
  }

  // 2. Production crew takes precedence over client (Production Crew)
  if (normalized.some((r) => CREW_KEYWORDS.some((kw) => r.includes(kw)))) {
    return "crew";
  }

  // 3. Client accounts (Clients)
  if (normalized.some((r) => CLIENT_KEYWORDS.some((kw) => r.includes(kw)))) {
    return "client";
  }

  // Default fallback for any newly added non-client roles
  return "internal";
};

/**
 * Returns detailed visual CSS category class for role capsules / chips:
 * 'role-cat-pending' | 'role-cat-exec' | 'role-cat-staff' | 'role-cat-crew' | 'role-cat-client' | 'role-cat-default'
 */
export const getRoleCategoryClass = (role, isPending = false) => {
  if (isPending) return "role-cat-pending";
  const r = String(role || "").trim().toLowerCase();
  if (!r) return "role-cat-default";

  if (EXEC_KEYWORDS.some((kw) => r.includes(kw))) return "role-cat-exec";
  if (STAFF_KEYWORDS.some((kw) => r.includes(kw))) return "role-cat-staff";
  if (CREW_KEYWORDS.some((kw) => r.includes(kw))) return "role-cat-crew";
  if (CLIENT_KEYWORDS.some((kw) => r.includes(kw))) return "role-cat-client";

  return "role-cat-default";
};

/**
 * Computes a numeric permission rank weight for any role, user, or verification level.
 * Higher number = higher permission / rank.
 */
export const getRoleScore = (roleStr) => {
  if (!roleStr) return 0;
  const s = String(roleStr).trim().toLowerCase();
  if (s.includes("admin") || s.includes("diamond")) return 100;
  if (s.includes("director") || s.includes("level 3") || s.includes("golden-3")) return 90;
  if (s.includes("manager") || s.includes("producer") || s.includes("level 2") || s.includes("golden-2")) return 80;
  if (s.includes("accountant") || s.includes("finance")) return 65;
  if (s.includes("coordinator")) return 60;
  if (s.includes("head") || s.includes("supervisor") || s.includes("lead")) return 55;
  if (s.includes("level 1") || s.includes("golden-1") || (s.includes("client") && s.includes("full"))) return 50;
  if (s.includes("crew") || s.includes("operator") || s.includes("technician") || s.includes("camera") || s.includes("sound")) return 40;
  if (s.includes("silver")) return 38;
  if (s.includes("half")) return 35;
  if (s.includes("viewer") || s.includes("crystal") || s.includes("white")) return 25;
  if (s.includes("client") || s.includes("customer") || s.includes("guest")) return 20;
  return 10;
};

/**
 * Returns the highest permission weight for a user.
 * Inspects user.roles (array), user.role, and user.verified_level.
 */
export const getRolePermissionWeight = (userOrRoles, verifiedLevel = null) => {
  let roles = [];
  let vLevel = verifiedLevel;

  if (userOrRoles && typeof userOrRoles === "object" && !Array.isArray(userOrRoles)) {
    roles = [...(userOrRoles.roles || []), userOrRoles.role].filter(Boolean);
    if (!vLevel) vLevel = userOrRoles.verified_level;
  } else if (Array.isArray(userOrRoles)) {
    roles = userOrRoles.filter(Boolean);
  } else if (userOrRoles) {
    roles = [userOrRoles];
  }

  let maxWeight = 0;
  for (const r of roles) {
    maxWeight = Math.max(maxWeight, getRoleScore(r));
  }
  if (vLevel) {
    maxWeight = Math.max(maxWeight, getRoleScore(vLevel));
  }
  return maxWeight;
};

/**
 * Determines the primary (highest permissioned) role string for display on user capsules.
 */
export const getPrimaryUserRole = (user) => {
  if (!user) return "Client";
  const roles = [...(user.roles || []), user.role].filter(Boolean);
  if (roles.length === 0) {
    if (user.verified_level) {
      const vl = String(user.verified_level).toLowerCase();
      if (vl.includes("diamond")) return "Admin";
      if (vl.includes("level 3")) return "Director";
      if (vl.includes("level 2")) return "Manager";
      if (vl.includes("level 1")) return "Client";
    }
    return "Client";
  }

  // Sort candidate roles descending by score and pick the top one
  const sorted = [...roles].sort((a, b) => getRoleScore(b) - getRoleScore(a));
  return sorted[0];
};

/**
 * Comparator to sort users with highest permissioned roles first across all columns.
 * Tie-breaker 1: Alphabetical by full name or username.
 * Tie-breaker 2: User ID ascending.
 */
export const compareUsersByPermission = (userA, userB) => {
  const weightA = getRolePermissionWeight(userA);
  const weightB = getRolePermissionWeight(userB);

  if (weightB !== weightA) {
    return weightB - weightA; // Higher score comes first
  }

  const nameA = String(userA.full_name || userA.username || "").toLowerCase();
  const nameB = String(userB.full_name || userB.username || "").toLowerCase();
  const nameComp = nameA.localeCompare(nameB);
  if (nameComp !== 0) return nameComp;

  return (userA.id || 0) - (userB.id || 0);
};

/**
 * Transforms database roles into dropdown option objects.
 * Excludes 'Admin' from regular assignment options unless specifically requested.
 */
export const formatRoleOptions = (availableRoles = [], excludeAdmin = true) => {
  if (!Array.isArray(availableRoles) || availableRoles.length === 0) {
    return [];
  }

  return availableRoles
    .filter((r) => {
      if (!r || !r.name) return false;
      if (excludeAdmin && String(r.name).trim().toLowerCase() === "admin") {
        return false;
      }
      return true;
    })
    .map((r) => ({
      value: r.name,
      label: String(r.name).toUpperCase(),
    }));
};

/**
 * Safely determines the default selectable role from formatted options.
 */
export const getDefaultRole = (roleOptions = []) => {
  if (Array.isArray(roleOptions) && roleOptions.length > 0) {
    return roleOptions[0].value;
  }
  return "";
};
