import React, { useId, useMemo, useState } from "react";
import { useFinance, TIMEFRAME_OPTIONS } from "../context/FinanceContext";
import { formatCurrency } from "../../../utils/currencyUtils";
import { sanitizeRealtime } from "../../../utils/sanitizer";
import CompositeBentoCard from "../../../components/common/CompositeBentoCard";
import GlassSurface from "../../../components/effects/GlassSurface";
import HoverTooltip from "../../../components/common/HoverTooltip";
import CountUp from "../../../components/effects/CountUp";
import NeoButton from "../../../components/common/NeoButton";
import Icon from "../../../components/common/Icon";
import CashflowTrajectoryChart from "./CashflowTrajectoryChart";
import "./OverviewBento.css";

const BUCKET_META = [
  {
    key: "income",
    label: "Income",
    icon: "trending_up",
    accentClass: "fin-accent-emerald",
    accountsHint: "4010 / 4020",
    tooltipTitle: "Income Stream (4010 / 4020)",
  },
  {
    key: "expense",
    label: "Expenses",
    icon: "receipt_long",
    accentClass: "fin-accent-rose",
    accountsHint: "5010 / 6010",
    tooltipTitle: "Expenses Stream (5010 / 6010)",
  },
  {
    key: "drawing",
    label: "Drawings",
    icon: "account_balance_wallet",
    accentClass: "fin-accent-amber",
    accountsHint: "3020 Contra Equity",
    tooltipTitle: "Owner Drawings (3020)",
    requiresPersonal: true,
  },
  {
    key: "capital",
    label: "Capital",
    icon: "savings",
    accentClass: "fin-accent-cyan",
    accountsHint: "3010 Paid-In",
    tooltipTitle: "Capital Contributions (3010)",
    requiresPersonal: true,
  },
];

const LENS_CYCLE = ["profit", "cash", "income"];

const formatCompactAmount = (val) => {
  const num = Number(val || 0);
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    return `${sign}Rs ${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}Rs ${Math.round(abs / 1_000)}k`;
  }
  return `${sign}Rs ${Math.round(abs)}`;
};

const getMonogram = (label = "") => {
  const cleaned = String(label || "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim();
  if (!cleaned) return "VD";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
};

const buildHeroSparkline = (trajectory = [], kpiLens = "profit") => {
  const W = 260;
  const H = 64;
  const padX = 10;
  const padY = 10;

  let rawValues = [];
  if (Array.isArray(trajectory) && trajectory.length > 0) {
    rawValues = trajectory.map((pt) => {
      if (kpiLens === "income") return Number(pt.income || 0);
      if (kpiLens === "cash") {
        return Number(pt.income || 0) - Number(pt.expenses || 0) + Number(pt.capital || 0);
      }
      return Number(pt.net_profit || 0);
    });
  }

  if (rawValues.length === 0) {
    rawValues = [0, 0];
  } else if (rawValues.length === 1) {
    rawValues = [rawValues[0] * 0.45, rawValues[0]];
  }

  const minVal = Math.min(...rawValues, 0);
  const maxVal = Math.max(...rawValues, 1);
  const range = Math.max(1, maxVal - minVal);
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const pts = rawValues.map((v, i) => ({
    x: padX + (i / (rawValues.length - 1)) * innerW,
    y: padY + innerH - ((v - minVal) / range) * innerH,
  }));

  let linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = Math.max(padY, Math.min(H - padY, p1.y + (p2.y - p0.y) / 6));
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = Math.max(padY, Math.min(H - padY, p2.y - (p3.y - p1.y) / 6));
    linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  const last = pts[pts.length - 1];
  const first = pts[0];
  const areaPath = `${linePath} L ${last.x.toFixed(1)} ${H} L ${first.x.toFixed(1)} ${H} Z`;

  return {
    width: W,
    height: H,
    linePath,
    areaPath,
    activePoint: last,
  };
};

const OverviewBento = () => {
  const uid = useId().replace(/[^\w-]/g, "");
  const {
    permissions,
    scope,
    timeframe,
    setTimeframe,
    dateRange,
    searchQuery,
    workspaceData,
    navigateToSection,
  } = useFinance();

  const [kpiLens, setKpiLens] = useState("profit");
  const [watchTab, setWatchTab] = useState("projects");
  const [watchFilter, setWatchFilter] = useState("");

  const summary = useMemo(
    () => workspaceData?.summary || {},
    [workspaceData]
  );
  const buckets = useMemo(
    () => workspaceData?.buckets || {},
    [workspaceData]
  );
  const watchlist = useMemo(
    () => workspaceData?.watchlist || {},
    [workspaceData]
  );

  const filteredTrajectory = useMemo(() => {
    const raw = Array.isArray(workspaceData?.trajectory)
      ? workspaceData.trajectory
      : [];
    const fromMonth =
      dateRange?.from && dateRange.from.length >= 7
        ? dateRange.from.slice(0, 7)
        : "";
    const toMonth =
      dateRange?.to && dateRange.to.length >= 7
        ? dateRange.to.slice(0, 7)
        : "";

    if (!fromMonth && !toMonth) return raw;
    return raw.filter((pt) => {
      if (!pt?.month) return false;
      if (fromMonth && pt.month < fromMonth) return false;
      if (toMonth && pt.month > toMonth) return false;
      return true;
    });
  }, [workspaceData, dateRange]);

  const marginInfo = useMemo(() => {
    const income = Number(summary.total_income || 0);
    const net = Number(summary.net_profit || 0);
    const pct = income > 0 ? Math.round((net / income) * 100) : 0;
    const progress = Math.max(4, Math.min(100, Math.abs(pct)));
    return {
      pct,
      progress,
      isPositive: net >= 0,
    };
  }, [summary]);

  const heroMetric = useMemo(() => {
    if (kpiLens === "cash") {
      const cashVal = Number(summary.cash_balance || 0);
      return {
        key: "cash",
        title: "Liquid Cash",
        subtitle: "Treasury Balance",
        shortLabel: "Cash",
        icon: "account_balance_wallet",
        value: cashVal,
        badgeLabel: `AR ${formatCompactAmount(summary.ar_balance)}`,
        badgeTone: cashVal >= 0 ? "is-positive" : "is-negative",
        rightMeta: `AP ${formatCompactAmount(summary.ap_balance)}`,
      };
    }

    if (kpiLens === "income") {
      const incVal = Number(summary.total_income || 0);
      const quoted = Number(summary.quoted_client_total || 0);
      const collectRate =
        quoted > 0
          ? Math.min(100, Math.round((Number(summary.total_collections || 0) / quoted) * 100))
          : 100;
      return {
        key: "income",
        title: "Total Income",
        subtitle: `${scope === "all" ? "All Scopes" : scope} Revenue`,
        shortLabel: "Income",
        icon: "payments",
        value: incVal,
        badgeLabel: `${collectRate}% collected`,
        badgeTone: "is-positive",
        rightMeta: `Expenses ${formatCompactAmount(summary.total_expenses)}`,
      };
    }

    const netVal = Number(summary.net_profit || 0);
    return {
      key: "profit",
      title: "Net Profit",
      subtitle: "Operating Position",
      shortLabel: "Profit",
      icon: "trending_up",
      value: netVal,
      badgeLabel: `${marginInfo.pct >= 0 ? "+" : ""}${marginInfo.pct}% margin`,
      badgeTone: netVal >= 0 ? "is-positive" : "is-negative",
      rightMeta: `Operating Margin ${Math.abs(marginInfo.pct)}%`,
    };
  }, [kpiLens, summary, scope, marginInfo]);

  const sparklineModel = useMemo(
    () => buildHeroSparkline(filteredTrajectory, kpiLens),
    [filteredTrajectory, kpiLens]
  );

  const treasuryMetrics = useMemo(() => {
    const cash = Number(summary.cash_balance || 0);
    const ar = Number(summary.ar_balance || 0);
    const ap = Number(summary.ap_balance || 0);
    const ratioNum = ap > 0 ? (Math.max(0, cash) + ar) / ap : null;
    const ratioLabel =
      ratioNum !== null ? `${ratioNum.toFixed(1)}x Ratio` : "Debt-Free";
    const debtorsCount = Array.isArray(watchlist.debtors)
      ? watchlist.debtors.length
      : 0;
    const creditorsCount = Array.isArray(watchlist.creditors)
      ? watchlist.creditors.length
      : 0;
    return {
      cash,
      ar,
      ap,
      ratioLabel,
      debtorsCount,
      creditorsCount,
    };
  }, [summary, watchlist]);

  const insightCard = useMemo(() => {
    const net = Number(summary.net_profit || 0);
    const cash = Number(summary.cash_balance || 0);
    const monthCount = filteredTrajectory.length;

    if (cash < 0) {
      return {
        title: "Liquidity Attention Needed",
        description:
          "Liquid cash reserves are currently negative. Inspect open receivables & payables.",
        ctaLabel: "Review Cash & Vitals",
        tone: "warning",
        targetSection: "debtors",
      };
    }

    if (net < 0) {
      return {
        title: "Operating Deficit Alert",
        description:
          "Operating expenses exceed recognized income in this window. Inspect P&L reports.",
        ctaLabel: "Inspect P&L Report",
        tone: "warning",
        targetSection: "reports",
      };
    }

    return {
      title: "Decisions Powered by Data",
      description:
        monthCount > 0
          ? `Books balanced across ${monthCount} active ${
              monthCount === 1 ? "period" : "periods"
            }. Run P&L & Trial Balance.`
          : "Books balanced for active period. Run real-time P&L, Trial Balance & General Ledger.",
      ctaLabel: "Explore Reports",
      tone: "primary",
      targetSection: "reports",
    };
  }, [summary, filteredTrajectory]);

  const visibleBuckets = useMemo(() => {
    const allowed = BUCKET_META.filter(
      (b) => !b.requiresPersonal || permissions.canViewPersonal
    );
    const grandTotal = allowed.reduce(
      (acc, b) => acc + Number(buckets[b.key]?.total || 0),
      0
    );

    return allowed.map((b) => {
      const item = buckets[b.key] || { count: 0, total: 0 };
      const total = Number(item.total || 0);
      const count = Number(item.count || 0);
      const sharePct =
        grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;
      return {
        ...b,
        total,
        count,
        sharePct,
      };
    });
  }, [buckets, permissions.canViewPersonal]);

  const combinedWatchQuery = useMemo(() => {
    const parts = [searchQuery, watchFilter]
      .map((s) => (s || "").trim().toLowerCase())
      .filter(Boolean);
    return parts;
  }, [searchQuery, watchFilter]);

  const filteredWatchRows = useMemo(() => {
    const list =
      watchTab === "projects"
        ? watchlist.projects || []
        : watchTab === "debtors"
          ? watchlist.debtors || []
          : watchlist.creditors || [];

    if (combinedWatchQuery.length === 0) return list;

    return list.filter((row) => {
      const hay = [
        row.project_name,
        row.code_name,
        row.party_name,
        row.voucher_no,
        row.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return combinedWatchQuery.every((q) => hay.includes(q));
    });
  }, [watchlist, watchTab, combinedWatchQuery]);

  const watchTabLabel =
    watchTab === "projects"
      ? "Projects"
      : watchTab === "debtors"
        ? "Debtors"
        : "Creditors";

  const cycleHeroLens = () => {
    const currentIdx = LENS_CYCLE.indexOf(kpiLens);
    const nextIdx = (currentIdx + 1) % LENS_CYCLE.length;
    setKpiLens(LENS_CYCLE[nextIdx]);
  };

  const handleWatchlistOpenAll = () => {
    if (watchTab === "projects") {
      navigateToSection("projects");
    } else {
      navigateToSection("debtors", {
        type: watchTab === "debtors" ? "receivable" : "payable",
      });
    }
  };

  return (
    <div className="fin-overview-root">
      <div className="fin-bento-grid">
        {/* ── Column 1: Hero Position + Treasury Reserves + Radiant Insights CTA ── */}
        <div className="fin-bento-col-left">
          <section
            className="fin-bento-slot fin-hero-slot"
            aria-label="Financial Position"
          >
            <CompositeBentoCard
              className="fin-composite-card fin-hero-bento"
              pillContent={
                <div className="summary-lead-container">
                  <GlassSurface
                    width={40}
                    height={40}
                    borderRadius={20}
                    className="summary-avatar fin-hero-orb"
                  >
                    <Icon name={heroMetric.icon} modifiers="md" />
                  </GlassSurface>
                  <div className="summary-lead-text">
                    <span className="summary-lead-name">{heroMetric.title}</span>
                    <span className="summary-lead-role">
                      {heroMetric.subtitle}
                    </span>
                  </div>
                </div>
              }
              rightContent={
                <div className="summary-bento-top-right">
                  <HoverTooltip
                    title="Cycle Metric Lens"
                    description="Click to cycle Operating Net Profit, Liquid Cash, and Total Income."
                  >
                    <GlassSurface
                      width="100%"
                      height={42}
                      borderRadius={30}
                      className="summary-selector fin-hero-selector"
                      onClick={cycleHeroLens}
                    >
                      <span className="fin-selector-tf">{timeframe}</span>
                      <span className="fin-selector-sep" aria-hidden="true">
                        |
                      </span>
                      <span className="summary-selector-text">
                        {heroMetric.shortLabel}
                      </span>
                      <Icon
                        name="swap_horiz"
                        modifiers="sm"
                        className="summary-selector-caret"
                      />
                    </GlassSurface>
                  </HoverTooltip>
                </div>
              }
              bottomContent={
                <div className="fin-hero-body">
                  <div className="fin-hero-controls">
                    <div
                      className="fin-lens-switch"
                      role="group"
                      aria-label="Metric lens"
                    >
                      <button
                        type="button"
                        className={`fin-lens-pill ${
                          kpiLens === "profit" ? "is-active" : ""
                        }`}
                        onClick={() => setKpiLens("profit")}
                      >
                        Net Profit
                      </button>
                      <button
                        type="button"
                        className={`fin-lens-pill ${
                          kpiLens === "cash" ? "is-active" : ""
                        }`}
                        onClick={() => setKpiLens("cash")}
                      >
                        Cash
                      </button>
                      <button
                        type="button"
                        className={`fin-lens-pill ${
                          kpiLens === "income" ? "is-active" : ""
                        }`}
                        onClick={() => setKpiLens("income")}
                      >
                        Income
                      </button>
                    </div>

                    <select
                      className="fin-tf-compact-select"
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                      aria-label="Overview timeframe"
                    >
                      {TIMEFRAME_OPTIONS.map((tf) => (
                        <option key={tf} value={tf}>
                          {tf}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    className="fin-hero-figure-row"
                    aria-label={formatCurrency(heroMetric.value)}
                  >
                    <span className="fin-hero-currency">Rs</span>
                    <CountUp
                      key={`${heroMetric.key}-${heroMetric.value}`}
                      from={0}
                      to={heroMetric.value}
                      decimals={2}
                      separator=","
                      duration={0.65}
                      trigger="load"
                      className="fin-hero-value"
                    />
                  </div>

                  <div className="fin-hero-sparkline-wrap" aria-hidden="true">
                    <svg
                      className="fin-hero-sparkline-svg"
                      viewBox={`0 0 ${sparklineModel.width} ${sparklineModel.height}`}
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient
                          id={`${uid}-spark-area`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--accent-color, #00c6e6)"
                            stopOpacity="0.34"
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--accent-color, #00c6e6)"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>
                      <path
                        d={sparklineModel.areaPath}
                        fill={`url(#${uid}-spark-area)`}
                      />
                      <path
                        d={sparklineModel.linePath}
                        className="fin-sparkline-path"
                      />
                      <line
                        x1={sparklineModel.activePoint.x}
                        y1={sparklineModel.activePoint.y}
                        x2={sparklineModel.activePoint.x}
                        y2={sparklineModel.height}
                        className="fin-sparkline-drop"
                      />
                      <circle
                        cx={sparklineModel.activePoint.x}
                        cy={sparklineModel.activePoint.y}
                        r="8"
                        className="fin-sparkline-halo"
                      />
                      <circle
                        cx={sparklineModel.activePoint.x}
                        cy={sparklineModel.activePoint.y}
                        r="4"
                        className="fin-sparkline-node"
                      />
                    </svg>
                  </div>

                  <div className="fin-hero-footer">
                    <div className="fin-holding-meta">
                      <span
                        className={`fin-delta-badge ${heroMetric.badgeTone}`}
                      >
                        {heroMetric.badgeLabel}
                      </span>
                      <span className="fin-holding-sub">
                        {heroMetric.rightMeta}
                      </span>
                    </div>

                    <svg
                      className="fin-hero-progress-svg"
                      viewBox="0 0 100 6"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient
                          id={`${uid}-bar-grad`}
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop offset="0%" stopColor="#00c6e6" />
                          <stop offset="100%" stopColor="#34d399" />
                        </linearGradient>
                      </defs>
                      <rect
                        x="0"
                        y="0"
                        width="100"
                        height="6"
                        rx="3"
                        className="fin-hero-progress-track"
                      />
                      <rect
                        x="0"
                        y="0"
                        width={marginInfo.progress}
                        height="6"
                        rx="3"
                        fill={`url(#${uid}-bar-grad)`}
                      />
                    </svg>
                  </div>
                </div>
              }
            />
          </section>

          <section
            className="fin-bento-slot fin-treasury-slot"
            aria-label="Treasury and Exposure"
          >
            <CompositeBentoCard
              className="fin-composite-card fin-treasury-bento"
              pillContent={
                <div className="summary-lead-container">
                  <GlassSurface
                    width={40}
                    height={40}
                    borderRadius={20}
                    className="summary-avatar fin-treasury-orb"
                  >
                    <Icon name="account_balance" modifiers="md" />
                  </GlassSurface>
                  <div className="summary-lead-text">
                    <span className="summary-lead-name">
                      Treasury &amp; Exposure
                    </span>
                    <span className="summary-lead-role">Liquid Reserves</span>
                  </div>
                </div>
              }
              rightContent={
                <div className="summary-bento-top-right">
                  <HoverTooltip
                    title="Liquidity Coverage Ratio"
                    description="Cash reserves plus open receivables compared against current payables."
                  >
                    <GlassSurface
                      width="100%"
                      height={42}
                      borderRadius={30}
                      className="summary-selector fin-ratio-selector"
                      onClick={() => navigateToSection("reports")}
                    >
                      <span className="summary-selector-text">
                        {treasuryMetrics.ratioLabel}
                      </span>
                      <Icon
                        name="north_east"
                        modifiers="sm"
                        className="summary-selector-caret"
                      />
                    </GlassSurface>
                  </HoverTooltip>
                </div>
              }
              bottomContent={
                <div className="fin-treasury-grid">
                  <HoverTooltip
                    title="Bank & Cash Reserves"
                    description="Live double-entry bank balances plus opening balances across active accounts."
                  >
                    <button
                      type="button"
                      className="fin-treasury-tile fin-treasury-cash"
                      onClick={() => navigateToSection("accounts")}
                    >
                      <span className="fin-treasury-label">
                        Liquid Cash
                        <span className="fin-treasury-dot" />
                      </span>
                      <span className="fin-treasury-val">
                        {formatCurrency(treasuryMetrics.cash, true, 0)}
                      </span>
                      <span className="fin-treasury-sub">
                        Quoted {formatCompactAmount(summary.quoted_client_total)}
                      </span>
                    </button>
                  </HoverTooltip>

                  <HoverTooltip
                    title="Open Receivables vs Payables"
                    description="Click to settle open client invoices (AR) or vendor bills (AP)."
                  >
                    <button
                      type="button"
                      className="fin-treasury-tile fin-treasury-arap"
                      onClick={() => navigateToSection("debtors")}
                    >
                      <span className="fin-treasury-label">Open AR / AP</span>
                      <span className="fin-treasury-val fin-treasury-split">
                        {formatCompactAmount(treasuryMetrics.ar)} /{" "}
                        {formatCompactAmount(treasuryMetrics.ap)}
                      </span>
                      <span className="fin-treasury-sub">
                        {treasuryMetrics.debtorsCount} AR ·{" "}
                        {treasuryMetrics.creditorsCount} AP open
                      </span>
                    </button>
                  </HoverTooltip>
                </div>
              }
            />
          </section>

          <section
            className="fin-bento-slot fin-insights-slot"
            aria-label="Financial Insights"
          >
            <GlassSurface
              width="100%"
              height="100%"
              borderRadius={26}
              blur={16}
              opacity={0.45}
              backgroundOpacity={0.38}
              className={`fin-insights-glass ${
                insightCard.tone === "warning" ? "is-warning" : ""
              }`}
            >
              <div className="fin-insights-inner">
                <div className="fin-insights-text-group">
                  <h2 className="fin-insights-title">{insightCard.title}</h2>
                  <p className="fin-insights-copy">{insightCard.description}</p>
                </div>
                <div className="fin-insights-actions">
                  <HoverTooltip
                    title="Open Financial Reports"
                    description="Launch P&L Statement, Trial Balance, and Balance Sheet reports."
                  >
                    <NeoButton
                      variant={
                        insightCard.tone === "warning" ? "danger" : "solid"
                      }
                      icon="auto_awesome"
                      onClick={() =>
                        navigateToSection(insightCard.targetSection)
                      }
                    >
                      {insightCard.ctaLabel}
                    </NeoButton>
                  </HoverTooltip>
                </div>
              </div>
            </GlassSurface>
          </section>
        </div>

        {/* ── Column 2: Accountable Buckets (2x2 Matrix) + Cashflow Trajectory ── */}
        <div className="fin-bento-col-center">
          <section
            className="fin-bento-slot fin-buckets-slot"
            aria-label="Accountable Buckets"
          >
            <CompositeBentoCard
              className="fin-composite-card fin-buckets-bento"
              pillContent={
                <div className="summary-lead-container">
                  <GlassSurface
                    width={40}
                    height={40}
                    borderRadius={20}
                    className="summary-avatar fin-buckets-orb"
                  >
                    <Icon name="pie_chart" modifiers="md" />
                  </GlassSurface>
                  <div className="summary-lead-text">
                    <h2 className="summary-lead-name fin-buckets-heading">
                      Accountable Buckets
                    </h2>
                    <span className="summary-lead-role">
                      {visibleBuckets.length} Ledger Streams
                    </span>
                  </div>
                </div>
              }
              rightContent={
                <div className="summary-bento-top-right">
                  <HoverTooltip
                    title="All Ledger Records"
                    description="Open full General Ledger voucher table across all accounting streams."
                  >
                    <GlassSurface
                      width="100%"
                      height={42}
                      borderRadius={30}
                      className="summary-selector fin-see-all-capsule"
                      onClick={() => navigateToSection("ledger")}
                    >
                      <span className="summary-selector-text">See all</span>
                      <Icon
                        name="north_east"
                        modifiers="sm"
                        className="summary-selector-caret"
                      />
                    </GlassSurface>
                  </HoverTooltip>
                </div>
              }
              bottomContent={
                <div
                  className={`fin-buckets-grid ${
                    visibleBuckets.length <= 2 ? "is-compact-two" : ""
                  }`}
                >
                  {visibleBuckets.map((b) => (
                    <HoverTooltip
                      key={b.key}
                      title={b.tooltipTitle}
                      description={`${b.count} posted entries totaling ${formatCurrency(
                        b.total
                      )} (${b.sharePct}% of bucket flow). Click to filter Ledger.`}
                    >
                      <button
                        type="button"
                        className={`fin-bucket-tile ${b.accentClass}`}
                        onClick={() =>
                          navigateToSection("ledger", { doc_type: b.key })
                        }
                      >
                        <div className="fin-bucket-head">
                          <span className="fin-bucket-label">{b.label}</span>
                          <span className="fin-bucket-count">{b.sharePct}%</span>
                        </div>
                        <span className="fin-bucket-amount">
                          {formatCurrency(b.total)}
                        </span>
                        <div className="fin-bucket-foot">
                          <span className="fin-bucket-icon-badge">
                            <Icon name={b.icon} modifiers="sm" />
                          </span>
                          <span className="fin-bucket-code">
                            {b.count} entries · {b.accountsHint}
                          </span>
                        </div>
                      </button>
                    </HoverTooltip>
                  ))}
                </div>
              }
            />
          </section>

          <CashflowTrajectoryChart
            trajectory={filteredTrajectory}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            canViewPersonal={permissions.canViewPersonal}
            dateRange={dateRange}
          />
        </div>

        {/* ── Column 3: Full-Height Projects / Debtors / Creditors Watchlist ── */}
        <div className="fin-bento-col-right">
          <section
            className="fin-bento-slot fin-watchlist-slot"
            aria-label="Financial Watchlist"
          >
            <CompositeBentoCard
              className="fin-composite-card fin-watchlist-bento"
              pillContent={
                <div className="summary-lead-container">
                  <GlassSurface
                    width={40}
                    height={40}
                    borderRadius={20}
                    className="summary-avatar fin-watchlist-orb"
                  >
                    <Icon name="monitoring" modifiers="md" />
                  </GlassSurface>
                  <div className="summary-lead-text">
                    <span className="summary-lead-name">Watchlist</span>
                    <span className="summary-lead-role">
                      Counterparties &amp; Projects
                    </span>
                  </div>
                </div>
              }
              rightContent={
                <div className="summary-bento-top-right">
                  <HoverTooltip
                    title={`Open ${watchTabLabel}`}
                    description={`Inspect all ${filteredWatchRows.length} tracked ${watchTabLabel.toLowerCase()} records.`}
                  >
                    <GlassSurface
                      width="100%"
                      height={42}
                      borderRadius={30}
                      className="summary-selector fin-watch-capsule"
                      onClick={handleWatchlistOpenAll}
                    >
                      <span className="summary-selector-text">
                        {watchTabLabel} ({filteredWatchRows.length})
                      </span>
                      <Icon
                        name="north_east"
                        modifiers="sm"
                        className="summary-selector-caret"
                      />
                    </GlassSurface>
                  </HoverTooltip>
                </div>
              }
              bottomContent={
                <div className="fin-watchlist-body">
                  <div
                    className="fin-seg-tabs"
                    role="tablist"
                    aria-label="Watchlist categories"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={watchTab === "projects"}
                      className={`fin-seg-tab-btn ${
                        watchTab === "projects" ? "is-active" : ""
                      }`}
                      onClick={() => setWatchTab("projects")}
                    >
                      Projects
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={watchTab === "debtors"}
                      className={`fin-seg-tab-btn ${
                        watchTab === "debtors" ? "is-active" : ""
                      }`}
                      onClick={() => setWatchTab("debtors")}
                    >
                      Debtors
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={watchTab === "creditors"}
                      className={`fin-seg-tab-btn ${
                        watchTab === "creditors" ? "is-active" : ""
                      }`}
                      onClick={() => setWatchTab("creditors")}
                    >
                      Creditors
                    </button>
                  </div>

                  <div className="fin-watch-list">
                    {filteredWatchRows.length === 0 ? (
                      <div className="fin-watch-empty">
                        <Icon name="inbox" modifiers="md" />
                        <span>
                          {combinedWatchQuery.length > 0
                            ? "No watchlist records match the filter."
                            : watchTab === "projects"
                              ? "No active projects found in this scope."
                              : watchTab === "debtors"
                                ? "All client receivables settled."
                                : "No open vendor payables."}
                        </span>
                      </div>
                    ) : (
                      filteredWatchRows.slice(0, 7).map((row) => {
                        if (watchTab === "projects") {
                          const name =
                            row.project_name ||
                            row.code_name ||
                            "Untitled Project";
                          const margin = Number(row.net_margin || 0);
                          return (
                            <HoverTooltip
                              key={`proj-${row.id}`}
                              title={name}
                              description={`Quoted: ${formatCurrency(
                                row.quoted_client_total
                              )} · Actual Income: ${formatCurrency(
                                row.actual_income
                              )} · Expenses: ${formatCurrency(
                                row.actual_expense
                              )}`}
                            >
                              <button
                                type="button"
                                className="fin-watch-row"
                                onClick={() =>
                                  navigateToSection("projects", {
                                    projectId: row.id,
                                  })
                                }
                              >
                                <div className="fin-watch-row-left">
                                  <span className="fin-watch-avatar">
                                    {getMonogram(name)}
                                  </span>
                                  <div className="fin-watch-text">
                                    <span className="fin-watch-name">
                                      {name}
                                    </span>
                                    <span className="fin-watch-sub">
                                      {row.code_name || row.status || "Project"}{" "}
                                      · Quote{" "}
                                      {formatCurrency(
                                        row.quoted_client_total,
                                        true,
                                        0
                                      )}
                                    </span>
                                  </div>
                                </div>
                                <div className="fin-watch-right">
                                  <span className="fin-watch-amount">
                                    {formatCurrency(
                                      row.actual_income || row.total_paid || 0
                                    )}
                                  </span>
                                  <span
                                    className={`fin-watch-subval ${
                                      margin >= 0
                                        ? "is-positive"
                                        : "is-negative"
                                    }`}
                                  >
                                    {margin >= 0 ? "+" : ""}
                                    {formatCurrency(margin)} net
                                  </span>
                                </div>
                              </button>
                            </HoverTooltip>
                          );
                        }

                        const party =
                          row.party_name || row.voucher_no || "Counterparty";
                        const bal = Number(
                          row.balance ?? row.total_amount ?? 0
                        );
                        return (
                          <HoverTooltip
                            key={`cp-${row.id}`}
                            title={`${party} (${row.voucher_no || watchTabLabel})`}
                            description={`Total: ${formatCurrency(
                              row.total_amount
                            )} · Settled: ${formatCurrency(
                              row.settled_amount
                            )} · Balance Due: ${formatCurrency(bal)}`}
                          >
                            <button
                              type="button"
                              className="fin-watch-row"
                              onClick={() =>
                                navigateToSection("debtors", {
                                  type:
                                    watchTab === "debtors"
                                      ? "receivable"
                                      : "payable",
                                })
                              }
                            >
                              <div className="fin-watch-row-left">
                                <span className="fin-watch-avatar">
                                  {getMonogram(party)}
                                </span>
                                <div className="fin-watch-text">
                                  <span className="fin-watch-name">{party}</span>
                                  <span className="fin-watch-sub">
                                    {row.voucher_no || row.doc_type}
                                    {row.due_date ? ` · Due ${row.due_date}` : ""}
                                  </span>
                                </div>
                              </div>
                              <div className="fin-watch-right">
                                <span className="fin-watch-amount">
                                  {formatCurrency(bal)}
                                </span>
                                <span
                                  className={`fin-watch-subval ${
                                    watchTab === "debtors"
                                      ? "is-positive"
                                      : "is-negative"
                                  }`}
                                >
                                  {String(row.status || "open").toUpperCase()}
                                </span>
                              </div>
                            </button>
                          </HoverTooltip>
                        );
                      })
                    )}
                  </div>

                  <div className="fin-watch-quickfilter">
                    <Icon
                      name="search"
                      modifiers="sm"
                      className="fin-watch-filter-icon"
                    />
                    <input
                      type="text"
                      className="fin-watch-filter-input"
                      value={watchFilter}
                      onChange={(e) =>
                        setWatchFilter(sanitizeRealtime(e.target.value, "text"))
                      }
                      placeholder="Jump to project or party..."
                      aria-label="Filter watchlist"
                    />
                    {watchFilter && (
                      <button
                        type="button"
                        className="fin-watch-filter-clear"
                        aria-label="Clear watchlist filter"
                        onClick={() => setWatchFilter("")}
                      >
                        <Icon name="close" modifiers="sm" />
                      </button>
                    )}
                  </div>
                </div>
              }
            />
          </section>
        </div>
      </div>
    </div>
  );
};

export default OverviewBento;
