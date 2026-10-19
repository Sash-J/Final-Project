// verificationUtils.js - Verification and Rank Tier metadata and styling tokens

export const VERIFICATION_TIERS = {
  diamond: {
    key: "diamond",
    label: "Diamond",
    shortLabel: "Diamond",
    icon: "crown",
    badgeClass: "badge-tier-diamond",
    glowClass: "glow-diamond",
    description: "System Administrator",
    glareColor: "#00f0ff",
    bgDisc: "rgba(0, 240, 255, 0.08)",
    borderDisc: "rgba(0, 240, 255, 0.3)",
    stars: 0,
    priority: 6,
  },
  golden3: {
    key: "golden-3",
    label: "Golden Level 3",
    shortLabel: "Gold L3",
    icon: "workspace_premium",
    badgeClass: "badge-tier-golden-3",
    glowClass: "glow-golden-3",
    description: "Executive Leadership",
    glareColor: "#fbbf24",
    bgDisc: "rgba(245, 158, 11, 0.1)",
    borderDisc: "rgba(251, 191, 36, 0.35)",
    stars: 3,
    priority: 5,
  },
  golden2: {
    key: "golden-2",
    label: "Golden Level 2",
    shortLabel: "Gold L2",
    icon: "editor_choice",
    badgeClass: "badge-tier-golden-2",
    glowClass: "glow-golden-2",
    description: "Operational Management",
    glareColor: "#f59e0b",
    bgDisc: "rgba(234, 179, 8, 0.08)",
    borderDisc: "rgba(245, 158, 11, 0.3)",
    stars: 2,
    priority: 4,
  },
  golden1: {
    key: "golden-1",
    label: "Gold Level 1",
    shortLabel: "Gold L1",
    icon: "stars",
    badgeClass: "badge-tier-golden-1",
    glowClass: "glow-golden-1",
    description: "Principal Client",
    glareColor: "#fde047",
    bgDisc: "rgba(234, 179, 8, 0.07)",
    borderDisc: "rgba(245, 158, 11, 0.25)",
    stars: 1,
    priority: 3,
  },
  silver: {
    key: "silver",
    label: "Silver",
    shortLabel: "Silver",
    icon: "star_rate_half",
    badgeClass: "badge-tier-silver",
    glowClass: "glow-silver",
    description: "Verified Operations",
    glareColor: "#ffffff",
    bgDisc: "rgba(148, 163, 184, 0.08)",
    borderDisc: "rgba(203, 213, 225, 0.25)",
    stars: 0,
    priority: 2,
  },
  crystal: {
    key: "crystal",
    label: "Frosted Crystal",
    shortLabel: "Crystal",
    icon: "auto_awesome",
    badgeClass: "badge-tier-crystal",
    glowClass: "glow-crystal",
    description: "Verified Viewer",
    glareColor: "#ffffff",
    bgDisc: "rgba(255, 255, 255, 0.06)",
    borderDisc: "rgba(255, 255, 255, 0.2)",
    stars: 0,
    priority: 1,
  },
};

export const getTierDetails = (levelOrRole) => {
  if (!levelOrRole) {
    return VERIFICATION_TIERS.crystal;
  }
  const s = String(levelOrRole).trim().toLowerCase();
  if (s.includes("diamond") || s === "admin") return VERIFICATION_TIERS.diamond;
  if (s.includes("level 3") || s.includes("director")) return VERIFICATION_TIERS.golden3;
  if (s.includes("level 2") || s.includes("manager")) return VERIFICATION_TIERS.golden2;
  if (s.includes("level 1") || (s.includes("client") && s.includes("full"))) return VERIFICATION_TIERS.golden1;
  if (s.includes("crystal") || s.includes("white") || s.includes("viewer")) return VERIFICATION_TIERS.crystal;
  if (
    s.includes("silver") ||
    s.includes("crew") ||
    s.includes("head") ||
    s.includes("coordinator") ||
    s.includes("accountant") ||
    s.includes("client")
  ) {
    return VERIFICATION_TIERS.silver;
  }

  return VERIFICATION_TIERS.silver;
};
