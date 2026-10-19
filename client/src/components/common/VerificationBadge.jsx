import React from "react";
import Icon from "./Icon";
import GlareHover from "../effects/GlareHover";
import HoverTooltip from "./HoverTooltip";
import { getTierDetails } from "../../features/users/utils/verificationUtils";
import "./VerificationBadge.css";

const SIZES = {
  xs: { dim: "18px", iconModifier: "tier-size-xs" },
  sm: { dim: "22px", iconModifier: "tier-size-sm" },
  md: { dim: "28px", iconModifier: "tier-size-md" },
  lg: { dim: "34px", iconModifier: "tier-size-lg" },
};

const VerificationBadge = ({
  tier,
  size = "sm",
  showLabel = false,
  className = "",
  enableGlare = true,
  enableTooltip = true,
  mode = "loop",
  interval = 5,
  initialDelay,
}) => {
  const details = getTierDetails(tier);
  const sizeConfig = SIZES[size] || SIZES.sm;

  const badgeIcon = (
    <span
      className={`verification-icon-badge ${details.badgeClass} ${sizeConfig.iconModifier}`}
    >
      <Icon name={details.icon} className="tier-badge-icon" />
      {showLabel && (
        <span className="tier-badge-label">{details.shortLabel}</span>
      )}
    </span>
  );

  let badgeElement;

  if (!enableGlare) {
    badgeElement = (
      <span
        className={`badge-static-wrap ${className}`.trim()}
        aria-label={details.label}
      >
        {badgeIcon}
      </span>
    );
  } else {
    badgeElement = (
      <span
        className={`badge-interactive-container ${className}`.trim()}
        aria-label={details.label}
      >
        <GlareHover
          width={showLabel ? "auto" : sizeConfig.dim}
          height={sizeConfig.dim}
          borderRadius={showLabel ? "999px" : "50%"}
          borderColor={details.borderDisc || "transparent"}
          background={details.bgDisc || "transparent"}
          glareColor={details.glareColor || "#ffffff"}
          glareOpacity={0.7}
          glareSize={42}
          softness={0.5}
          glareAngle={-45}
          blendMode="screen"
          rimGlint={true}
          mode={mode}
          interval={interval}
          initialDelay={initialDelay}
          transitionDuration={1000}
          className="badge-glare-outer"
        >
          {badgeIcon}
        </GlareHover>
      </span>
    );
  }

  if (!enableTooltip) {
    return badgeElement;
  }

  return (
    <HoverTooltip
      title={details.label}
      description={details.description}
      icon={details.icon}
      iconClassName={details.badgeClass}
      wrapperClassName="badge-tooltip-wrapper"
    >
      {badgeElement}
    </HoverTooltip>
  );
};

export default VerificationBadge;

