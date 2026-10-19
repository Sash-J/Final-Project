import React, { useMemo } from "react";
import CompositeBentoCard from "../../../components/common/CompositeBentoCard";
import GlassSurface from "../../../components/effects/GlassSurface";
import CountUp from "../../../components/effects/CountUp";
import Icon from "../../../components/common/Icon";
import "./UserMetricsGaugeWidget.css";

const SingleGauge = ({ value, label, colorClass }) => {
  // Semi-circle gauge calculation:
  // Radius = 38, circumference of full circle = 2 * PI * 38 ≈ 238.76
  // Half circumference = ~119.38
  const halfCirc = 119.38;
  const progressLength = (Math.min(Math.max(value, 0), 100) / 100) * halfCirc;

  return (
    <div className={`metric-gauge-item ${colorClass}`}>
      <div className="gauge-svg-wrap">
        <svg className="gauge-svg" viewBox="0 0 100 54">
          {/* Background Arc */}
          <path
            className="gauge-track-arc"
            d="M 12 46 A 38 38 0 0 1 88 46"
          />

          {/* Value Progress Arc */}
          <path
            className="gauge-val-arc"
            d="M 12 46 A 38 38 0 0 1 88 46"
            strokeDasharray={`${progressLength} 200`}
          />
        </svg>

        <div className="gauge-center-reading">
          <CountUp
            from={0}
            to={Number(value) || 0}
            suffix="%"
            duration={1.5}
            className="gauge-readout-value"
            mode="roll"
            trigger="view"
            replayOnHover
          />
        </div>
      </div>
      <span className="gauge-item-label">{label}</span>
    </div>
  );
};

const UserMetricsGaugeWidget = ({ allUsers = [], pendingUsers = [] }) => {
  const metrics = useMemo(() => {
    const totalUsers = allUsers.length || 1;
    const approvedCount = allUsers.filter((u) => u.is_approved).length;
    const activeRate = Math.round((approvedCount / totalUsers) * 100);

    // Profile verification completion (users with verified_level or skill)
    const verifiedCount = allUsers.filter(
      (u) => Boolean(u.verified_level) || Boolean(u.skill)
    ).length;
    const verificationRate = Math.round((verifiedCount / totalUsers) * 100);

    // Approval speed/health (inversely affected if pending users backlog is high)
    const pendingCount = pendingUsers.length;
    const backlogRatio = Math.min((pendingCount / (totalUsers + pendingCount)) * 100, 100);
    const healthScore = Math.max(100 - Math.round(backlogRatio * 2), 0);

    return {
      activeRate,
      verificationRate,
      healthScore,
    };
  }, [allUsers, pendingUsers]);

  return (
    <div className="um-composite-bento-wrapper metrics-composite-wrapper">
      <CompositeBentoCard
        className="user-metrics-bento"
        pillContent={
          <div className="summary-lead-container">
            <GlassSurface
              className="summary-avatar metrics-lead-avatar"
              width="44px"
              height="44px"
              borderRadius={22}
              blur={6}
              opacity={0}
              backgroundOpacity={0}
            >
              <Icon name="speed" modifiers="sm" />
            </GlassSurface>
            <div className="summary-lead-text">
              <span className="summary-lead-name">User Metrics</span>
              <span className="summary-lead-role">System Health</span>
            </div>
          </div>
        }
        bottomContent={
          <div className="metrics-composite-body">
            <SingleGauge
              value={metrics.activeRate}
              label="Active Ratio"
              colorClass="gauge-cyan"
              displayValue={`${metrics.activeRate}%`}
            />

            <SingleGauge
              value={metrics.healthScore}
              label="Approval Health"
              colorClass="gauge-amber"
              displayValue={`${metrics.healthScore}%`}
            />

            <SingleGauge
              value={metrics.verificationRate}
              label="Verified Profiles"
              colorClass="gauge-emerald"
              displayValue={`${metrics.verificationRate}%`}
            />
          </div>
        }
        rightContent={
          <div className="summary-bento-top-right">
            <GlassSurface
              className="summary-selector"
              width="max-content"
              height="auto"
              borderRadius={30}
              blur={10}
              opacity={0.4}
              backgroundOpacity={0.2}
            >
              <div className="summary-selector-icon metrics-selector-icon">
                <Icon name="insights" modifiers="sm" />
              </div>
              <span>3 Gauges</span>
              <Icon
                name="expand_more"
                modifiers="sm"
                className="summary-selector-caret"
              />
            </GlassSurface>
          </div>
        }
      />
    </div>
  );
};

export default UserMetricsGaugeWidget;
