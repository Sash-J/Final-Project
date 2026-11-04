import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Icon from "../../../components/common/Icon";
import { formatCurrency } from "../../../utils/currencyUtils";
import { useProjects } from "../context/ProjectContext";
import "./BudgetVersionComparisonGraph.css";

// Fluid Catmull-Rom cubic bezier spline with peak softening and lead-in/lead-out curve tails
const buildFluidSpline = (points, width, baselineY) => {
  if (!points || points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  }

  const pFirst = points[0];
  const pLast = points[points.length - 1];
  const tailSpan = Math.min(45, (pLast.x - pFirst.x) / (points.length * 1.5));

  const leadIn = {
    x: Math.max(15, pFirst.x - tailSpan),
    y: baselineY - (baselineY - pFirst.y) * 0.45,
  };
  const leadOut = {
    x: Math.min(width - 15, pLast.x + tailSpan),
    y: baselineY - (baselineY - pLast.y) * 0.45,
  };

  const fullPoints = [leadIn, ...points, leadOut];
  let path = `M ${leadIn.x.toFixed(1)},${leadIn.y.toFixed(1)}`;
  const tension = 0.65;

  for (let i = 0; i < fullPoints.length - 1; i++) {
    const p0 = i > 0 ? fullPoints[i - 1] : fullPoints[i];
    const p1 = fullPoints[i];
    const p2 = fullPoints[i + 1];
    const p3 = i + 2 < fullPoints.length ? fullPoints[i + 2] : p2;

    let cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    let cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    let cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    let cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    // Peak softening: flatten tangents at crests and troughs for smooth waves
    if ((p1.y <= p0.y && p1.y <= p2.y) || (p1.y >= p0.y && p1.y >= p2.y)) {
      cp1y = p1.y;
    }
    if ((p2.y <= p1.y && p2.y <= p3.y) || (p2.y >= p1.y && p2.y >= p3.y)) {
      cp2y = p2.y;
    }

    cp1y = Math.max(15, Math.min(baselineY, cp1y));
    cp2y = Math.max(15, Math.min(baselineY, cp2y));

    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  return path;
};

const buildAreaPath = (points, splinePath, baselineY, width) => {
  if (!points || points.length === 0 || !splinePath) return "";
  const pFirst = points[0];
  const pLast = points[points.length - 1];
  const tailSpan = Math.min(45, (pLast.x - pFirst.x) / (points.length * 1.5));
  const leadInX = Math.max(15, pFirst.x - tailSpan);
  const leadOutX = Math.min(width - 15, pLast.x + tailSpan);

  return `${splinePath} L ${leadOutX.toFixed(1)},${baselineY.toFixed(1)} L ${leadInX.toFixed(1)},${baselineY.toFixed(1)} Z`;
};

const BudgetVersionComparisonGraph = ({
  projectId,
  versions = [],
  currentVersionId,
  currentHierarchy = [],
  currentValues = {},
}) => {
  const { getBudgetData, budgetCache } = useProjects();
  const [selectedVerAId, setSelectedVerAId] = useState("");
  const [selectedVerBId, setSelectedVerBId] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [svgWidth, setSvgWidth] = useState(840);
  const svgHeight = 240;

  // Initialize selected versions based on user rules:
  // - 1 line if one budget
  // - 2 lines if two budgets
  // - If > 2 keep two dropdowns defaulting to first and last
  useEffect(() => {
    if (!Array.isArray(versions) || versions.length === 0) {
      if (currentVersionId) {
        setSelectedVerAId(String(currentVersionId));
        setSelectedVerBId("");
      }
      return;
    }

    if (versions.length === 1) {
      setSelectedVerAId(String(versions[0].id));
      setSelectedVerBId("");
    } else if (versions.length === 2) {
      setSelectedVerAId(String(versions[0].id));
      setSelectedVerBId(String(versions[1].id));
    } else {
      setSelectedVerAId((prev) => {
        const exists = versions.some((v) => String(v.id) === String(prev));
        return exists ? prev : String(versions[0].id);
      });
      setSelectedVerBId((prev) => {
        const exists = versions.some((v) => String(v.id) === String(prev));
        return exists ? prev : String(versions[versions.length - 1].id);
      });
    }
  }, [versions, currentVersionId]);

  // Responsive container width tracking via ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const measure = () => {
      if (containerRef.current) {
        const clientW = containerRef.current.clientWidth;
        if (clientW > 150) {
          setSvgWidth(Math.round(clientW));
        }
      }
    };

    measure();

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 150) {
            setSvgWidth(Math.round(w));
          }
        }
      });
      ro.observe(containerRef.current);
    }

    window.addEventListener("resize", measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Fetch version A data if not in cache
  useEffect(() => {
    if (projectId && selectedVerAId) {
      const pIdStr = String(projectId);
      const vIdStr = String(selectedVerAId);
      if (!budgetCache[pIdStr]?.[vIdStr] && vIdStr !== String(currentVersionId)) {
        getBudgetData(projectId, selectedVerAId);
      }
    }
  }, [projectId, selectedVerAId, budgetCache, currentVersionId, getBudgetData]);

  // Fetch version B data if not in cache
  useEffect(() => {
    if (projectId && selectedVerBId && selectedVerBId !== selectedVerAId) {
      const pIdStr = String(projectId);
      const vIdStr = String(selectedVerBId);
      if (!budgetCache[pIdStr]?.[vIdStr] && vIdStr !== String(currentVersionId)) {
        getBudgetData(projectId, selectedVerBId);
      }
    }
  }, [projectId, selectedVerBId, selectedVerAId, budgetCache, currentVersionId, getBudgetData]);

  // Resolve Version records
  const verRecordA = useMemo(() => {
    return versions.find((v) => String(v.id) === String(selectedVerAId)) || {
      id: selectedVerAId,
      version_number: 1,
    };
  }, [versions, selectedVerAId]);

  const verRecordB = useMemo(() => {
    if (!selectedVerBId) return null;
    return versions.find((v) => String(v.id) === String(selectedVerBId)) || {
      id: selectedVerBId,
      version_number: 2,
    };
  }, [versions, selectedVerBId]);

  // Resolve values & hierarchy for Version A
  const dataA = useMemo(() => {
    const pIdStr = String(projectId);
    const vIdStr = String(selectedVerAId);
    if (vIdStr === String(currentVersionId) && currentValues) {
      return {
        values: currentValues,
        hierarchy: currentHierarchy,
      };
    }
    const cached = budgetCache[pIdStr]?.[vIdStr];
    return {
      values: cached?.values || {},
      hierarchy: cached?.hierarchy || currentHierarchy,
    };
  }, [projectId, selectedVerAId, currentVersionId, currentValues, currentHierarchy, budgetCache]);

  // Resolve values for Version B
  const dataB = useMemo(() => {
    if (!selectedVerBId) return { values: {}, hierarchy: [] };
    const pIdStr = String(projectId);
    const vIdStr = String(selectedVerBId);
    if (vIdStr === String(currentVersionId) && currentValues) {
      return {
        values: currentValues,
        hierarchy: currentHierarchy,
      };
    }
    const cached = budgetCache[pIdStr]?.[vIdStr];
    return {
      values: cached?.values || {},
      hierarchy: cached?.hierarchy || currentHierarchy,
    };
  }, [projectId, selectedVerBId, currentVersionId, currentValues, currentHierarchy, budgetCache]);

  // Category comparisons only
  const comparisonData = useMemo(() => {
    const hierarchy =
      (dataA.hierarchy && dataA.hierarchy.length > 0
        ? dataA.hierarchy
        : dataB.hierarchy) || currentHierarchy;

    const points = [];
    let grandA = 0;
    let grandB = 0;

    hierarchy.forEach((phase) => {
      (phase.departments || []).forEach((dept) => {
        (dept.categories || []).forEach((cat) => {
          let catA = 0;
          let catB = 0;

          (cat.items || []).forEach((item) => {
            const valA = dataA.values[item.id] || dataA.values[String(item.id)] || {};
            const valB = dataB.values[item.id] || dataB.values[String(item.id)] || {};
            catA += parseFloat(valA.total) || 0;
            catB += parseFloat(valB.total) || 0;
          });

          if (catA > 0 || catB > 0) {
            points.push({
              id: `${phase.phase_id}-${dept.id}-${cat.id}`,
              phaseName: phase.phase_name,
              deptName: dept.department_name,
              categoryName: cat.category_name,
              label: cat.category_name,
              valA: catA,
              valB: catB,
            });
            grandA += catA;
            grandB += catB;
          }
        });
      });
    });

    return {
      points,
      grandA,
      grandB,
      hasTwoLines: Boolean(selectedVerBId && selectedVerBId !== selectedVerAId),
    };
  }, [dataA, dataB, currentHierarchy, selectedVerAId, selectedVerBId]);

  // SVG dimensions & coordinate calculations
  const pointsCount = comparisonData.points.length;

  // Responsive horizontal margins so points and labels have room to breathe
  const padding = useMemo(() => {
    const horizontalPad = svgWidth < 550 ? 52 : 80;
    const rightPad = pointsCount <= 4 ? (svgWidth < 550 ? 68 : 100) : horizontalPad;
    return { top: 36, right: rightPad, bottom: 44, left: horizontalPad };
  }, [pointsCount, svgWidth]);

  const plotWidth = Math.max(100, svgWidth - padding.left - padding.right);
  const plotHeight = svgHeight - padding.top - padding.bottom;
  const baselineY = padding.top + plotHeight;

  const maxVal = useMemo(() => {
    let max = 0;
    comparisonData.points.forEach((p) => {
      if (p.valA > max) max = p.valA;
      if (p.valB > max) max = p.valB;
    });
    return max > 0 ? max * 1.3 : 100000;
  }, [comparisonData.points]);

  // Coordinates for Version A and Version B
  const coordinatesA = useMemo(() => {
    if (pointsCount === 0) return [];
    return comparisonData.points.map((p, i) => {
      const x =
        pointsCount === 1
          ? padding.left + plotWidth / 2
          : padding.left + (i / (pointsCount - 1)) * plotWidth;
      const y = baselineY - (p.valA / maxVal) * plotHeight;
      return { x, y, val: p.valA, item: p };
    });
  }, [comparisonData.points, pointsCount, padding.left, plotWidth, baselineY, maxVal, plotHeight]);

  const coordinatesB = useMemo(() => {
    if (!comparisonData.hasTwoLines || pointsCount === 0) return [];
    return comparisonData.points.map((p, i) => {
      const x =
        pointsCount === 1
          ? padding.left + plotWidth / 2
          : padding.left + (i / (pointsCount - 1)) * plotWidth;
      const y = baselineY - (p.valB / maxVal) * plotHeight;
      return { x, y, val: p.valB, item: p };
    });
  }, [comparisonData.points, comparisonData.hasTwoLines, pointsCount, padding.left, plotWidth, baselineY, maxVal, plotHeight]);

  // Fluid splines and areas
  const splinePathA = useMemo(
    () => buildFluidSpline(coordinatesA, svgWidth, baselineY),
    [coordinatesA, svgWidth, baselineY],
  );
  const areaPathA = useMemo(
    () => buildAreaPath(coordinatesA, splinePathA, baselineY, svgWidth),
    [coordinatesA, splinePathA, baselineY, svgWidth],
  );

  const splinePathB = useMemo(
    () => buildFluidSpline(coordinatesB, svgWidth, baselineY),
    [coordinatesB, svgWidth, baselineY],
  );
  const areaPathB = useMemo(
    () => buildAreaPath(coordinatesB, splinePathB, baselineY, svgWidth),
    [coordinatesB, splinePathB, baselineY, svgWidth],
  );

  // Grid Ticks
  const gridTicks = [0.25, 0.5, 0.75, 1.0];

  // Smooth mouse move tracking without layout thrashing
  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || coordinatesA.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width) return;
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * svgWidth;

    let closestIdx = 0;
    let minDist = Infinity;
    coordinatesA.forEach((pt, i) => {
      const dist = Math.abs(pt.x - svgX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    });

    if (minDist < 140) {
      setHoveredIndex((prev) => (prev === closestIdx ? prev : closestIdx));
    } else {
      setHoveredIndex(null);
    }
  }, [coordinatesA, svgWidth]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  // Tooltip details
  const activeHoverData = useMemo(() => {
    if (hoveredIndex === null || !comparisonData.points[hoveredIndex]) return null;
    const ptA = coordinatesA[hoveredIndex];
    const ptB = coordinatesB[hoveredIndex];
    const item = comparisonData.points[hoveredIndex];
    const x = ptA ? ptA.x : padding.left;
    const minY = ptB ? Math.min(ptA.y, ptB.y) : ptA ? ptA.y : baselineY;

    // Edge alignment to avoid clipping
    let alignClass = "tooltip-align-center";
    if (x > svgWidth - 210) {
      alignClass = "tooltip-align-right";
    } else if (x < 210) {
      alignClass = "tooltip-align-left";
    }

    const diff = ptB ? ptB.val - ptA.val : 0;
    const diffPct = ptA && ptA.val > 0 ? (diff / ptA.val) * 100 : 0;

    return {
      x,
      minY,
      alignClass,
      item,
      valA: ptA ? ptA.val : 0,
      valB: ptB ? ptB.val : 0,
      diff,
      diffPct,
      hasB: Boolean(ptB),
    };
  }, [hoveredIndex, comparisonData.points, coordinatesA, coordinatesB, padding.left, svgWidth, baselineY]);

  return (
    <div className="budget-comparison-card">
      {/* Top Header & Dropdown Controls */}
      <div className="comparison-card-header">
        <div className="comparison-title-group">
          <div className="comparison-title-row">
            <Icon name="show_chart" modifiers="sm" />
            <h4 className="comparison-main-title">Budget Version Trajectory</h4>
          </div>
          <p className="comparison-subtitle">
            {comparisonData.hasTwoLines
              ? `Comparing category expenses between v${verRecordA.version_number} and v${verRecordB?.version_number}`
              : `Expense progression across active categories (v${verRecordA.version_number})`}
          </p>
        </div>

        <div className="comparison-actions-group">
          {/* Dropdowns when > 2 versions exist */}
          {versions.length > 2 && (
            <div className="version-dropdown-cluster">
              <div className="version-select-pill">
                <span className="version-select-dot dot-orange" />
                <label className="version-select-label">Ver A:</label>
                <select
                  value={selectedVerAId}
                  onChange={(e) => setSelectedVerAId(e.target.value)}
                  className="version-compare-select"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={String(v.id)}>
                      v{v.version_number}
                    </option>
                  ))}
                </select>
              </div>

              <span className="version-compare-vs">vs</span>

              <div className="version-select-pill">
                <span className="version-select-dot dot-cyan" />
                <label className="version-select-label">Ver B:</label>
                <select
                  value={selectedVerBId}
                  onChange={(e) => setSelectedVerBId(e.target.value)}
                  className="version-compare-select"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={String(v.id)}>
                      v{v.version_number}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Legend Badges */}
          <div className="comparison-legend-cluster">
            <div className="legend-badge badge-ver-a">
              <span className="legend-badge-dot dot-orange" />
              <span className="legend-badge-name">
                v{verRecordA.version_number}
              </span>
              <strong className="legend-badge-val">
                {formatCurrency(comparisonData.grandA)}
              </strong>
            </div>

            {comparisonData.hasTwoLines && verRecordB && (
              <div className="legend-badge badge-ver-b">
                <span className="legend-badge-dot dot-cyan" />
                <span className="legend-badge-name">
                  v{verRecordB.version_number}
                </span>
                <strong className="legend-badge-val">
                  {formatCurrency(comparisonData.grandB)}
                </strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SVG Line Graph Canvas */}
      <div
        ref={containerRef}
        className="comparison-chart-wrapper"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {pointsCount === 0 ? (
          <div className="comparison-empty-state">
            <Icon name="insights" modifiers="md" />
            <span>No line items recorded for version comparison yet.</span>
          </div>
        ) : (
          <svg
            ref={svgRef}
            className="comparison-svg"
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          >
            <defs>
              {/* Version A Gradient (Orange) */}
              <linearGradient id="gradientVerA" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.28" />
                <stop offset="90%" stopColor="#f97316" stopOpacity="0.0" />
              </linearGradient>

              {/* Version B Gradient (Cyan) */}
              <linearGradient id="gradientVerB" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--accent-color, #00c6e6)" stopOpacity="0.25" />
                <stop offset="90%" stopColor="var(--accent-color, #00c6e6)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Labels */}
            {gridTicks.map((tick) => {
              const y = baselineY - tick * plotHeight;
              const tickVal = maxVal * tick;
              return (
                <g key={tick} className="chart-grid-line-group">
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={svgWidth - padding.right}
                    y2={y}
                    className="chart-grid-line"
                  />
                  <text
                    x={padding.left - 12}
                    y={y + 4}
                    className="chart-grid-label"
                  >
                    {tickVal >= 1000000
                      ? `${(tickVal / 1000000).toFixed(1)}M`
                      : tickVal >= 1000
                        ? `${Math.round(tickVal / 1000)}k`
                        : Math.round(tickVal)}
                  </text>
                </g>
              );
            })}

            {/* Baseline */}
            <line
              x1={padding.left}
              y1={baselineY}
              x2={svgWidth - padding.right}
              y2={baselineY}
              className="chart-baseline"
            />

            {/* Area Fills */}
            {areaPathA && (
              <path
                d={areaPathA}
                fill="url(#gradientVerA)"
                className="chart-area-fill"
              />
            )}
            {comparisonData.hasTwoLines && areaPathB && (
              <path
                d={areaPathB}
                fill="url(#gradientVerB)"
                className="chart-area-fill"
              />
            )}

            {/* Spline Lines */}
            {splinePathA && (
              <path
                d={splinePathA}
                className="chart-line-stroke stroke-ver-a"
              />
            )}
            {comparisonData.hasTwoLines && splinePathB && (
              <path
                d={splinePathB}
                className="chart-line-stroke stroke-ver-b"
              />
            )}

            {/* Crosshair on Hover */}
            {activeHoverData && (
              <g className="chart-crosshair-group">
                <line
                  x1={activeHoverData.x}
                  y1={padding.top}
                  x2={activeHoverData.x}
                  y2={baselineY}
                  className="chart-crosshair-line"
                />
              </g>
            )}

            {/* Data Points (Version A) */}
            {coordinatesA.map((pt, i) => (
              <g key={`a-${i}`} className="chart-point-group">
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredIndex === i ? 6.5 : 4.5}
                  className="chart-point-circle point-ver-a"
                />
                {hoveredIndex === i && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={11}
                    className="chart-point-pulse pulse-ver-a"
                  />
                )}
              </g>
            ))}

            {/* Data Points (Version B) */}
            {comparisonData.hasTwoLines &&
              coordinatesB.map((pt, i) => (
                <g key={`b-${i}`} className="chart-point-group">
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredIndex === i ? 6.5 : 4.5}
                    className="chart-point-circle point-ver-b"
                  />
                  {hoveredIndex === i && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={11}
                      className="chart-point-pulse pulse-ver-b"
                    />
                  )}
                </g>
              ))}

            {/* X-Axis Category Labels */}
            {comparisonData.points.map((pt, i) => {
              const x =
                pointsCount === 1
                  ? padding.left + plotWidth / 2
                  : padding.left + (i / (pointsCount - 1)) * plotWidth;
              const isHovered = hoveredIndex === i;

              const displayLabel =
                svgWidth < 520 && pt.label.length > 13
                  ? `${pt.label.slice(0, 11)}…`
                  : pt.label;

              return (
                <text
                  key={pt.id || i}
                  x={x}
                  y={baselineY + 22}
                  textAnchor="middle"
                  className={`chart-xaxis-label ${isHovered ? "active" : ""}`}
                >
                  <title>{pt.label}</title>
                  {displayLabel}
                </text>
              );
            })}
          </svg>
        )}

        {/* Floating Glass Tooltip */}
        {activeHoverData && (
          <div
            className={`chart-tooltip-glass ${activeHoverData.alignClass}`}
            style={{
              left: `${(activeHoverData.x / svgWidth) * 100}%`,
              top: `${(activeHoverData.minY / svgHeight) * 100}%`,
            }}
          >
            <div className="tooltip-header">
              <span className="tooltip-cat-name">
                {activeHoverData.item.label}
              </span>
              <span className="tooltip-phase-chip">
                {activeHoverData.item.deptName}
              </span>
            </div>

            <div className="tooltip-rows-list">
              <div className="tooltip-row ver-a">
                <span className="tooltip-dot dot-orange" />
                <span className="tooltip-label">v{verRecordA.version_number}:</span>
                <strong className="tooltip-val">
                  {formatCurrency(activeHoverData.valA)}
                </strong>
              </div>

              {activeHoverData.hasB && verRecordB && (
                <div className="tooltip-row ver-b">
                  <span className="tooltip-dot dot-cyan" />
                  <span className="tooltip-label">v{verRecordB.version_number}:</span>
                  <strong className="tooltip-val">
                    {formatCurrency(activeHoverData.valB)}
                  </strong>
                </div>
              )}
            </div>

            {activeHoverData.hasB && activeHoverData.diff !== 0 && (
              <div className="tooltip-diff-row">
                <span
                  className={`tooltip-diff-chip ${
                    activeHoverData.diff > 0 ? "positive" : "negative"
                  }`}
                >
                  <Icon
                    name={
                      activeHoverData.diff > 0
                        ? "trending_up"
                        : "trending_down"
                    }
                    modifiers="xs"
                  />
                  <span>
                    {activeHoverData.diff > 0 ? "+" : ""}
                    {formatCurrency(activeHoverData.diff)}
                  </span>
                  <span>({activeHoverData.diffPct.toFixed(1)}%)</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetVersionComparisonGraph;