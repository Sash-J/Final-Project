import React, { useMemo } from "react";
import CompositeBentoCard from "../../../components/common/CompositeBentoCard";
import GlassSurface from "../../../components/effects/GlassSurface";
import CountUp from "../../../components/effects/CountUp";
import Icon from "../../../components/common/Icon";
import { categorizeRole } from "../utils/roleUtils";
import "./UserRoleDonutWidget.css";

const UserRoleDonutWidget = ({ allUsers = [] }) => {
  const stats = useMemo(() => {
    let internalCount = 0;
    let crewCount = 0;
    let clientCount = 0;

    allUsers.forEach((u) => {
      const userRoles = [...(u.roles || []), u.role].filter(Boolean);
      const category = categorizeRole(userRoles);

      if (category === "internal") {
        internalCount++;
      } else if (category === "crew") {
        crewCount++;
      } else {
        clientCount++;
      }
    });

    const total = allUsers.length || 1;
    const internalPct = Math.round((internalCount / total) * 100);
    const crewPct = Math.round((crewCount / total) * 100);
    const clientPct = 100 - internalPct - crewPct;

    // SVG Donut calculation (circumference of radius 46 is ~289.03)
    const radius = 46;
    const circ = 2 * Math.PI * radius;

    const internalLen = (internalCount / total) * circ;
    const crewLen = (crewCount / total) * circ;
    const clientLen = (clientCount / total) * circ;

    const offsetInternal = 0;
    const offsetCrew = -internalLen;
    const offsetClient = -(internalLen + crewLen);

    return {
      total: allUsers.length,
      internalCount,
      crewCount,
      clientCount,
      internalPct,
      crewPct,
      clientPct,
      circ,
      internalLen,
      crewLen,
      clientLen,
      offsetInternal,
      offsetCrew,
      offsetClient,
    };
  }, [allUsers]);

  return (
    <div className="um-composite-bento-wrapper donut-composite-wrapper">
      <CompositeBentoCard
        className="user-demographics-bento"
        pillContent={
          <div className="summary-lead-container">
            <GlassSurface
              className="summary-avatar donut-lead-avatar"
              width="44px"
              height="44px"
              borderRadius={22}
              blur={6}
              opacity={0}
              backgroundOpacity={0}
            >
              <Icon name="pie_chart" modifiers="sm" />
            </GlassSurface>
            <div className="summary-lead-text">
              <span className="summary-lead-name">Role Demographics</span>
              <span className="summary-lead-role">Workforce Distribution</span>
            </div>
          </div>
        }
        bottomContent={
          <div className="donut-composite-body">
            {/* SVG Donut Graphic */}
            <div className="donut-svg-wrapper">
              <svg className="donut-svg" viewBox="0 0 120 120">
                <circle
                  className="donut-track"
                  cx="60"
                  cy="60"
                  r="46"
                />
                <circle
                  className="donut-slice slice-internal"
                  cx="60"
                  cy="60"
                  r="46"
                  strokeDasharray={`${stats.internalLen} ${stats.circ}`}
                  strokeDashoffset={stats.offsetInternal}
                />
                <circle
                  className="donut-slice slice-crew"
                  cx="60"
                  cy="60"
                  r="46"
                  strokeDasharray={`${stats.crewLen} ${stats.circ}`}
                  strokeDashoffset={stats.offsetCrew}
                />
                <circle
                  className="donut-slice slice-clients"
                  cx="60"
                  cy="60"
                  r="46"
                  strokeDasharray={`${stats.clientLen} ${stats.circ}`}
                  strokeDashoffset={stats.offsetClient}
                />
              </svg>

              <div className="donut-center-info">
                <CountUp
                  from={0}
                  to={stats.total}
                  duration={1.5}
                  className="donut-center-number"
                  mode="roll"
                  trigger="view"
                  replayOnHover
                />
                <span className="donut-center-label">Users</span>
              </div>
            </div>

            {/* Legend Stack */}
            <div className="donut-legend-stack">
              <div className="donut-legend-item">
                <span className="legend-indicator dot-internal" />
                <div className="legend-text-group">
                  <span className="legend-name">Internal Crew</span>
                  <span className="legend-count">{stats.internalCount} users</span>
                </div>
                <span className="legend-percentage">{stats.internalPct}%</span>
              </div>

              <div className="donut-legend-item">
                <span className="legend-indicator dot-crew" />
                <div className="legend-text-group">
                  <span className="legend-name">Production Crew</span>
                  <span className="legend-count">{stats.crewCount} users</span>
                </div>
                <span className="legend-percentage">{stats.crewPct}%</span>
              </div>

              <div className="donut-legend-item">
                <span className="legend-indicator dot-clients" />
                <div className="legend-text-group">
                  <span className="legend-name">Clients</span>
                  <span className="legend-count">{stats.clientCount} users</span>
                </div>
                <span className="legend-percentage">{stats.clientPct}%</span>
              </div>
            </div>
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
              <div className="summary-selector-icon donut-selector-icon">
                <Icon name="category" modifiers="sm" />
              </div>
              <span>3 Categories</span>
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

export default UserRoleDonutWidget;
