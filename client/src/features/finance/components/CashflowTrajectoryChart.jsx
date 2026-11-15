import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { TIMEFRAME_OPTIONS } from "../context/FinanceContext";
import { formatCurrency } from "../../../utils/currencyUtils";
import CompositeBentoCard from "../../../components/common/CompositeBentoCard";
import GlassSurface from "../../../components/effects/GlassSurface";
import GlassDatePicker from "../../../components/common/GlassDatePicker";
import HoverTooltip from "../../../components/common/HoverTooltip";
import Icon from "../../../components/common/Icon";
import "./CashflowTrajectoryChart.css";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatMonthLabel = (ym) => {
  if (!ym || typeof ym !== "string") return "";
  const [yearStr, monthStr] = ym.split("-");
  const mIdx = parseInt(monthStr, 10) - 1;
  if (Number.isNaN(mIdx) || mIdx < 0 || mIdx > 11) return ym;
  return `${MONTH_NAMES[mIdx]} ${yearStr ? yearStr.slice(-2) : ""}`.trim();
};

const formatCompactAxis = (val) => {
  const num = Number(val || 0);
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}k`;
  }
  return `${sign}${Math.round(abs)}`;
};

/**
 * Generates a clamped Catmull-Rom cubic Bezier SVG path so curves stay smooth
 * without overshooting flat baseline segments.
 */
const buildSmoothSpline = (points, minY, maxY) => {
  if (!points || points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  }

  const clampY = (y) => Math.max(minY, Math.min(maxY, y));
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = clampY(p2.y - (p3.y - p1.y) / 6);

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
};

const buildAreaFillPath = (points, linePath, baselineY) => {
  if (!points || points.length < 2 || !linePath) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
};

const CashflowTrajectoryChart = ({
  trajectory = [],
  timeframe = "6M",
  onTimeframeChange,
  canViewPersonal = true,
  dateRange = null,
}) => {
  const uid = useId().replace(/[^\w-]/g, "");
  const containerRef = useRef(null);
  const [svgWidth, setSvgWidth] = useState(520);
  const svgHeight = 198;
  const padLeft = 48;
  const padRight = 18;
  const padTop = 16;
  const padBottom = 28;

  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [focusDate, setFocusDate] = useState("");
  const [visibleSeries, setVisibleSeries] = useState({
    profit: true,
    income: true,
    expenses: true,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const measure = () => {
      if (el && el.clientWidth > 160) {
        setSvgWidth(Math.round(el.clientWidth));
      }
    };
    measure();

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 160) {
            setSvgWidth(Math.round(entry.contentRect.width));
          }
        }
      });
      ro.observe(el);
    }
    window.addEventListener("resize", measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const toggleSeries = (key) => {
    setVisibleSeries((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.profit && !next.income && !next.expenses) {
        return prev;
      }
      return next;
    });
  };

  const pinnedIdx = useMemo(() => {
    if (!focusDate || focusDate.length < 7 || !Array.isArray(trajectory)) {
      return null;
    }
    const targetMonth = focusDate.slice(0, 7);
    const foundIdx = trajectory.findIndex((pt) => pt.month === targetMonth);
    return foundIdx >= 0 ? foundIdx : null;
  }, [focusDate, trajectory]);

  const effectiveIdx = useMemo(() => {
    if (hoveredIdx !== null && trajectory[hoveredIdx]) return hoveredIdx;
    if (pinnedIdx !== null && trajectory[pinnedIdx]) return pinnedIdx;
    return null;
  }, [hoveredIdx, pinnedIdx, trajectory]);

  const chartModel = useMemo(() => {
    if (!Array.isArray(trajectory) || trajectory.length === 0) {
      return null;
    }

    const plotW = Math.max(180, svgWidth - padLeft - padRight);
    const plotH = svgHeight - padTop - padBottom;

    const candidateValues = [0];
    trajectory.forEach((pt) => {
      if (visibleSeries.income) candidateValues.push(Number(pt.income || 0));
      if (visibleSeries.expenses) candidateValues.push(Number(pt.expenses || 0));
      if (visibleSeries.profit) candidateValues.push(Number(pt.net_profit || 0));
    });

    let minVal = Math.min(...candidateValues);
    let maxVal = Math.max(...candidateValues);
    if (maxVal === minVal) {
      maxVal = minVal + 1000;
    }
    const span = maxVal - minVal;
    const paddedMax = maxVal + span * 0.1;
    const paddedMin = minVal < 0 ? minVal - span * 0.08 : 0;
    const range = Math.max(1, paddedMax - paddedMin);

    const toY = (v) => padTop + plotH - ((v - paddedMin) / range) * plotH;
    const zeroY = toY(0);

    const n = trajectory.length;
    const toX = (i) => {
      if (n === 1) return padLeft + plotW / 2;
      return padLeft + (i / (n - 1)) * plotW;
    };

    const incomePts = trajectory.map((pt, i) => ({
      x: toX(i),
      y: toY(Number(pt.income || 0)),
    }));
    const expensePts = trajectory.map((pt, i) => ({
      x: toX(i),
      y: toY(Number(pt.expenses || 0)),
    }));
    const profitPts = trajectory.map((pt, i) => ({
      x: toX(i),
      y: toY(Number(pt.net_profit || 0)),
    }));

    const bottomY = padTop + plotH;
    const profitPath = buildSmoothSpline(profitPts, padTop, bottomY);
    const incomePath = buildSmoothSpline(incomePts, padTop, bottomY);
    const expensePath = buildSmoothSpline(expensePts, padTop, bottomY);
    const profitAreaPath = buildAreaFillPath(profitPts, profitPath, zeroY);

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((frac) => {
      const value = paddedMin + frac * range;
      return {
        value,
        y: toY(value),
        label: formatCompactAxis(value),
      };
    });

    const peakIdx = trajectory.reduce(
      (best, pt, idx) =>
        Number(pt.net_profit || 0) > Number(trajectory[best]?.net_profit || 0)
          ? idx
          : best,
      0
    );

    return {
      n,
      plotW,
      bottomY,
      zeroY,
      ticks,
      incomePts,
      expensePts,
      profitPts,
      incomePath,
      expensePath,
      profitPath,
      profitAreaPath,
      peakIdx,
    };
  }, [trajectory, svgWidth, visibleSeries]);

  const activePoint =
    chartModel && effectiveIdx !== null && trajectory[effectiveIdx]
      ? trajectory[effectiveIdx]
      : null;

  const activeCoords = useMemo(() => {
    if (!chartModel || effectiveIdx === null) return null;
    const pt = chartModel.profitPts[effectiveIdx];
    if (!pt) return null;
    const rawPct = (pt.x / svgWidth) * 100;
    const clampedPct = Math.max(20, Math.min(80, rawPct));
    return { x: pt.x, tooltipPct: clampedPct, idx: effectiveIdx };
  }, [chartModel, effectiveIdx, svgWidth]);

  const highlightIdx =
    effectiveIdx !== null
      ? effectiveIdx
      : chartModel
        ? chartModel.peakIdx
        : null;

  const focusBadgeLabel = useMemo(() => {
    if (focusDate && focusDate.length >= 7) {
      return formatMonthLabel(focusDate.slice(0, 7));
    }
    if (Array.isArray(trajectory) && trajectory.length > 0) {
      return formatMonthLabel(trajectory[trajectory.length - 1].month);
    }
    return timeframe;
  }, [focusDate, trajectory, timeframe]);

  const hasExternalDateFilter = Boolean(dateRange?.from || dateRange?.to);

  return (
    <section
      className="fin-bento-slot fin-traj-slot"
      aria-label="Cashflow and P&L Trajectory"
    >
      <CompositeBentoCard
        className="fin-composite-card fin-traj-bento"
        pillContent={
          <div className="summary-lead-container">
            <GlassSurface
              width={40}
              height={40}
              borderRadius={20}
              className="summary-avatar fin-traj-orb"
            >
              <Icon name="show_chart" modifiers="md" />
            </GlassSurface>
            <div className="summary-lead-text">
              <h2 className="summary-lead-name fin-traj-title">
                Cashflow &amp; P&amp;L Performance
              </h2>
              <span className="summary-lead-role">
                {hasExternalDateFilter
                  ? "Filtered Period Telemetry"
                  : "Monthly Income vs. Expenses"}
              </span>
            </div>
          </div>
        }
        rightContent={
          <div className="summary-bento-top-right">
            <HoverTooltip
              title="Inspect Focus Month"
              description="Choose a calendar date to pin its monthly Net Profit, Income, and Expense telemetry directly on the curve."
            >
              <GlassSurface
                width="100%"
                height={42}
                borderRadius={30}
                className="summary-selector fin-traj-date-capsule"
              >
                <div className="fin-traj-date-trigger">
                  <GlassDatePicker
                    value={focusDate}
                    onChange={setFocusDate}
                    iconOnly
                    className="fin-traj-datepicker-btn"
                  />
                  <span className="summary-selector-text">
                    {focusBadgeLabel}
                  </span>
                  {focusDate && (
                    <button
                      type="button"
                      className="fin-traj-pin-clear"
                      aria-label="Unpin focus month"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusDate("");
                      }}
                    >
                      <Icon name="close" modifiers="sm" />
                    </button>
                  )}
                </div>
              </GlassSurface>
            </HoverTooltip>
          </div>
        }
        bottomContent={
          <div className="fin-traj-body">
            <div className="fin-traj-controls-bar">
              <div
                className="fin-traj-series-toggles"
                role="group"
                aria-label="Series filters"
              >
                <button
                  type="button"
                  className={`fin-traj-series-pill ${
                    visibleSeries.profit ? "is-active" : ""
                  }`}
                  onClick={() => toggleSeries("profit")}
                >
                  <span className="fin-traj-dot series-profit" />
                  <span>Net Profit</span>
                </button>
                <button
                  type="button"
                  className={`fin-traj-series-pill ${
                    visibleSeries.income ? "is-active" : ""
                  }`}
                  onClick={() => toggleSeries("income")}
                >
                  <span className="fin-traj-dot series-income" />
                  <span>Income</span>
                </button>
                <button
                  type="button"
                  className={`fin-traj-series-pill ${
                    visibleSeries.expenses ? "is-active" : ""
                  }`}
                  onClick={() => toggleSeries("expenses")}
                >
                  <span className="fin-traj-dot series-expenses" />
                  <span>Expenses</span>
                </button>
              </div>

              <div
                className="fin-traj-timeframe-group"
                role="group"
                aria-label="Timeframe"
              >
                {TIMEFRAME_OPTIONS.map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    className={`fin-traj-tf-btn ${
                      timeframe === tf ? "is-active" : ""
                    }`}
                    onClick={() => onTimeframeChange?.(tf)}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div ref={containerRef} className="fin-traj-canvas-wrap">
              {!chartModel ? (
                <div className="fin-traj-empty">
                  <span>
                    No posted ledger activity in this window ({timeframe}).
                  </span>
                </div>
              ) : (
                <>
                  <svg
                    className="fin-traj-svg"
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    preserveAspectRatio="none"
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <defs>
                      <linearGradient
                        id={`${uid}-profit-area`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--accent-color, #00c6e6)"
                          stopOpacity="0.32"
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--accent-color, #00c6e6)"
                          stopOpacity="0.0"
                        />
                      </linearGradient>
                    </defs>

                    {chartModel.ticks.map((t, idx) => (
                      <g key={idx}>
                        <line
                          x1={padLeft}
                          y1={t.y}
                          x2={svgWidth - padRight}
                          y2={t.y}
                          className={
                            Math.abs(t.value) < 0.01
                              ? "fin-traj-zero-line"
                              : "fin-traj-grid-line"
                          }
                        />
                        <text
                          x={padLeft - 8}
                          y={t.y + 4}
                          textAnchor="end"
                          className="fin-traj-axis-label"
                        >
                          {t.label}
                        </text>
                      </g>
                    ))}

                    {visibleSeries.profit && chartModel.profitAreaPath && (
                      <path
                        d={chartModel.profitAreaPath}
                        fill={`url(#${uid}-profit-area)`}
                      />
                    )}
                    {visibleSeries.expenses && chartModel.expensePath && (
                      <path
                        d={chartModel.expensePath}
                        className="fin-traj-line-expenses"
                      />
                    )}
                    {visibleSeries.income && chartModel.incomePath && (
                      <path
                        d={chartModel.incomePath}
                        className="fin-traj-line-income"
                      />
                    )}
                    {visibleSeries.profit && chartModel.profitPath && (
                      <path
                        d={chartModel.profitPath}
                        className="fin-traj-line-profit"
                      />
                    )}

                    {trajectory.map((pt, i) => {
                      const showEvery = trajectory.length > 8 ? 2 : 1;
                      if (i % showEvery !== 0 && i !== trajectory.length - 1) {
                        return null;
                      }
                      return (
                        <text
                          key={pt.month}
                          x={chartModel.profitPts[i].x}
                          y={svgHeight - 7}
                          textAnchor="middle"
                          className="fin-traj-month-label"
                        >
                          {formatMonthLabel(pt.month)}
                        </text>
                      );
                    })}

                    {/* Highlight dot (hovered, pinned date, or peak month) */}
                    {highlightIdx !== null && chartModel.profitPts[highlightIdx] && (
                      <g>
                        {activeCoords && (
                          <line
                            x1={activeCoords.x}
                            y1={padTop}
                            x2={activeCoords.x}
                            y2={chartModel.bottomY}
                            className="fin-traj-crosshair"
                          />
                        )}
                        {visibleSeries.income && (
                          <circle
                            cx={chartModel.incomePts[highlightIdx].x}
                            cy={chartModel.incomePts[highlightIdx].y}
                            r={activeCoords ? "4.5" : "3.5"}
                            className="fin-traj-point-ring fin-traj-point-income"
                          />
                        )}
                        {visibleSeries.expenses && (
                          <circle
                            cx={chartModel.expensePts[highlightIdx].x}
                            cy={chartModel.expensePts[highlightIdx].y}
                            r={activeCoords ? "4.5" : "3.5"}
                            className="fin-traj-point-ring fin-traj-point-expenses"
                          />
                        )}
                        {visibleSeries.profit && (
                          <>
                            <circle
                              cx={chartModel.profitPts[highlightIdx].x}
                              cy={chartModel.profitPts[highlightIdx].y}
                              r="10"
                              className="fin-traj-point-halo"
                            />
                            <circle
                              cx={chartModel.profitPts[highlightIdx].x}
                              cy={chartModel.profitPts[highlightIdx].y}
                              r="5.5"
                              className="fin-traj-point-ring fin-traj-point-profit"
                            />
                          </>
                        )}
                      </g>
                    )}

                    {trajectory.map((pt, i) => {
                      const sliceW =
                        chartModel.n === 1
                          ? chartModel.plotW
                          : chartModel.plotW / (chartModel.n - 1);
                      const rectX =
                        chartModel.n === 1
                          ? padLeft
                          : Math.max(
                              padLeft,
                              chartModel.profitPts[i].x - sliceW / 2
                            );
                      const rectW =
                        chartModel.n === 1
                          ? chartModel.plotW
                          : Math.min(sliceW, svgWidth - padRight - rectX);

                      return (
                        <rect
                          key={`hit-${pt.month}`}
                          x={rectX}
                          y={padTop}
                          width={Math.max(12, rectW)}
                          height={svgHeight - padTop - padBottom}
                          className="fin-traj-hover-hit"
                          onMouseEnter={() => setHoveredIdx(i)}
                          onFocus={() => setHoveredIdx(i)}
                        />
                      );
                    })}
                  </svg>

                  {activePoint && activeCoords && (
                    <div
                      className="fin-traj-tooltip"
                      style={{ left: `${activeCoords.tooltipPct}%` }}
                      role="status"
                    >
                      <div className="fin-traj-tooltip-head">
                        <span className="fin-traj-tooltip-month">
                          {formatMonthLabel(activePoint.month)}
                        </span>
                        <span
                          className={`fin-traj-tooltip-pill ${
                            Number(activePoint.net_profit || 0) >= 0
                              ? "is-positive"
                              : "is-negative"
                          }`}
                        >
                          {Number(activePoint.net_profit || 0) >= 0 ? "+" : ""}
                          {formatCompactAxis(activePoint.net_profit)}
                        </span>
                      </div>
                      <div className="fin-traj-tooltip-row">
                        <span className="fin-traj-tooltip-key">
                          <span className="fin-traj-dot series-income" /> Income
                        </span>
                        <span className="fin-traj-tooltip-val">
                          {formatCurrency(activePoint.income)}
                        </span>
                      </div>
                      <div className="fin-traj-tooltip-row">
                        <span className="fin-traj-tooltip-key">
                          <span className="fin-traj-dot series-expenses" />{" "}
                          Expenses
                        </span>
                        <span className="fin-traj-tooltip-val">
                          {formatCurrency(activePoint.expenses)}
                        </span>
                      </div>
                      <div className="fin-traj-tooltip-row">
                        <span className="fin-traj-tooltip-key">
                          <span className="fin-traj-dot series-profit" /> Net
                          Profit
                        </span>
                        <span className="fin-traj-tooltip-val">
                          {formatCurrency(activePoint.net_profit)}
                        </span>
                      </div>
                      {canViewPersonal &&
                        (Number(activePoint.drawings || 0) > 0 ||
                          Number(activePoint.capital || 0) > 0) && (
                          <div className="fin-traj-tooltip-row">
                            <span className="fin-traj-tooltip-key">
                              Drawings / Cap
                            </span>
                            <span className="fin-traj-tooltip-val">
                              {formatCompactAxis(activePoint.drawings)} /{" "}
                              {formatCompactAxis(activePoint.capital)}
                            </span>
                          </div>
                        )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        }
      />
    </section>
  );
};

export default CashflowTrajectoryChart;
