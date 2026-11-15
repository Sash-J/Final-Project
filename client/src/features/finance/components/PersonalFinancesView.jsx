import React, { useState, useEffect, useMemo } from "react";
import Icon from "../../../components/common/Icon";
import NeoButton from "../../../components/common/NeoButton";
import { formatCurrency } from "../../../utils/currencyUtils";
import { sanitizeRealtime } from "../../../utils/sanitizer";
import { useFinance } from "../context/FinanceContext";
import FinanceSkeleton from "./FinanceSkeleton";
import "./PersonalFinancesView.css";

const ROLE_TABS = [
  { id: "all", label: "All Stakeholders" },
  { id: "directors", label: "Directors & Equity Partners" },
  { id: "crew", label: "Crew & Contractors" },
];

const PersonalFinancesView = () => {
  const {
    permissions,
    sectionPayloads,
    sectionLoading,
    sectionErrors,
    loadSectionData,
    openRecordModal,
  } = useFinance();

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [showByProject, setShowByProject] = useState(false);

  const payload = sectionPayloads?.personal;
  const isLoading = Boolean(sectionLoading?.personal);
  const error = sectionErrors?.personal;

  useEffect(() => {
    if (permissions?.canViewPersonal && !payload) {
      loadSectionData("personal");
    }
  }, [permissions?.canViewPersonal, payload, loadSectionData]);

  const people = useMemo(() => {
    return payload?.people || [];
  }, [payload]);

  const byProject = useMemo(() => {
    return payload?.by_project || [];
  }, [payload]);

  // Aggregate KPI summary
  const summary = useMemo(() => {
    let totalCapital = 0;
    let totalDrawings = 0;
    let totalPayables = 0;
    let totalAdvances = 0;
    let totalFees = 0;

    people.forEach((p) => {
      totalCapital += Number(p.capital_contributed || 0);
      totalDrawings += Number(p.drawings_taken || 0);
      totalPayables += Number(p.payables_unpaid || 0);
      totalAdvances += Number(p.advances_owed || 0);
      totalFees += Number(p.fees_incurred || 0);
    });

    const netEquity = totalCapital - totalDrawings;

    return {
      count: people.length,
      totalCapital,
      totalDrawings,
      netEquity,
      totalPayables,
      totalAdvances,
      totalFees,
    };
  }, [people]);

  // Filter people
  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => {
      const isDirector =
        (p.role || "").toLowerCase().includes("director") ||
        (p.role || "").toLowerCase().includes("admin") ||
        (p.role || "").toLowerCase().includes("executive") ||
        Number(p.capital_contributed || 0) > 0 ||
        Number(p.drawings_taken || 0) > 0;

      if (activeTab === "directors" && !isDirector) return false;
      if (activeTab === "crew" && isDirector) return false;

      if (!q) return true;
      const name = (p.full_name || "").toLowerCase();
      const user = (p.username || "").toLowerCase();
      const role = (p.role || "").toLowerCase();
      return name.includes(q) || user.includes(q) || role.includes(q);
    });
  }, [people, activeTab, search]);

  // Guard: require canViewPersonal
  if (!permissions?.canViewPersonal) {
    return (
      <div className="fin-pers-restricted" data-testid="personal-finances-restricted">
        <Icon name="lock" modifiers="lg" />
        <h3 className="fin-pers-restricted-title">Access Restricted</h3>
        <p className="fin-pers-restricted-desc">
          Individual stakeholder balances, owner equity, drawings, and personal ledger lines require
          owner or executive administrative credentials.
        </p>
      </div>
    );
  }

  if (isLoading && !payload) {
    return <FinanceSkeleton variant="subview" />;
  }

  return (
    <div className="fin-pers-view" data-testid="personal-finances-view">
      {/* Top Header Card */}
      <div className="fin-pers-head-card">
        <div className="fin-pers-header-info">
          <span className="fin-pers-eyebrow">Individual Stakeholders & Equity Allocation</span>
          <h2 className="fin-pers-title">Personal Financial Statuses</h2>
          <p className="fin-pers-desc">
            Direct tracking of owner equity vs. drawings, contractor payables, advances, and personal
            allocations across studio projects.
          </p>
        </div>

        <div className="fin-pers-header-actions">
          <NeoButton
            variant="secondary"
            icon="refresh"
            loading={isLoading}
            onClick={() => loadSectionData("personal", {}, { force: true })}
          >
            Refresh
          </NeoButton>
          <NeoButton
            variant="glass"
            icon="view_list"
            onClick={() => setShowByProject(!showByProject)}
          >
            {showByProject ? "Hide Project Breakdown" : "Show Project Breakdown"}
          </NeoButton>
          <NeoButton
            variant="solid"
            icon="add"
            onClick={() => openRecordModal({ scope: "personal" })}
          >
            + Record Personal Voucher
          </NeoButton>
        </div>
      </div>

      {error && (
        <div className="fin-pers-error-banner" role="alert">
          <Icon name="error" modifiers="sm" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Summary Tiles */}
      <div className="fin-pers-kpi-grid">
        <div className="fin-pers-kpi-tile highlight-cyan">
          <span className="fin-pers-kpi-label">Capital Contributed</span>
          <span className="fin-pers-kpi-val positive">{formatCurrency(summary.totalCapital)}</span>
          <span className="fin-pers-kpi-sub">Total partner equity paid in</span>
        </div>

        <div className="fin-pers-kpi-tile">
          <span className="fin-pers-kpi-label">Drawings Taken</span>
          <span className="fin-pers-kpi-val warning">{formatCurrency(summary.totalDrawings)}</span>
          <span className="fin-pers-kpi-sub">Contra-equity distributions</span>
        </div>

        <div className="fin-pers-kpi-tile highlight-emerald">
          <span className="fin-pers-kpi-label">Net Equity Balance</span>
          <span className={`fin-pers-kpi-val ${summary.netEquity >= 0 ? "positive" : "negative"}`}>
            {formatCurrency(summary.netEquity)}
          </span>
          <span className="fin-pers-kpi-sub">Capital less cumulative drawings</span>
        </div>

        <div className="fin-pers-kpi-tile">
          <span className="fin-pers-kpi-label">Crew Payables (AP)</span>
          <span className="fin-pers-kpi-val negative">{formatCurrency(summary.totalPayables)}</span>
          <span className="fin-pers-kpi-sub">Unpaid wages & subcontractor bills</span>
        </div>

        <div className="fin-pers-kpi-tile">
          <span className="fin-pers-kpi-label">Outstanding Advances</span>
          <span className="fin-pers-kpi-val">{formatCurrency(summary.totalAdvances)}</span>
          <span className="fin-pers-kpi-sub">Disbursed production advances</span>
        </div>
      </div>

      {/* Controls Bar: Persona tabs & Search */}
      <div className="fin-pers-controls-bar">
        <div className="fin-pers-tabs" role="tablist" aria-label="Stakeholder Role Tabs">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`fin-pers-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="fin-pers-search-wrapper">
          <Icon name="search" modifiers="sm" />
          <input
            type="text"
            className="fin-pers-search-input"
            placeholder="Search person name or role..."
            value={search}
            onChange={(e) => setSearch(sanitizeRealtime(e.target.value))}
          />
          {search && (
            <button
              type="button"
              className="fin-pers-search-clear"
              aria-label="Clear stakeholder search"
              onClick={() => setSearch("")}
            >
              <Icon name="close" modifiers="sm" />
            </button>
          )}
        </div>
      </div>

      {/* Stakeholders Grid */}
      {filteredPeople.length === 0 ? (
        <div className="fin-pers-empty">
          <Icon name="group" modifiers="lg" />
          <p className="fin-pers-empty-title">No stakeholders match the criteria.</p>
          <p className="fin-pers-empty-desc">
            Try adjusting your search query or role tab to view active stakeholders.
          </p>
        </div>
      ) : (
        <div className="fin-pers-grid">
          {filteredPeople.map((person) => {
            const capital = Number(person.capital_contributed || 0);
            const drawings = Number(person.drawings_taken || 0);
            const netEquity = capital - drawings;
            const payables = Number(person.payables_unpaid || 0);
            const advances = Number(person.advances_owed || 0);
            const fees = Number(person.fees_incurred || 0);

            const isPartner = capital > 0 || drawings > 0;
            const initials = (person.full_name || person.username || "U")
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <div key={person.user_id} className="fin-pers-card" data-testid={`person-card-${person.user_id}`}>
                <div className="fin-pers-card-head">
                  <div className="fin-pers-avatar">{initials}</div>
                  <div className="fin-pers-person-info">
                    <h3 className="fin-pers-name">{person.full_name || person.username}</h3>
                    <span className="fin-pers-role">
                      @{person.username} · <span className="fin-pers-role-tag">{person.role || "Member"}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="fin-pers-btn-voucher"
                    onClick={() =>
                      openRecordModal({
                        scope: "personal",
                        user_id: person.user_id,
                      })
                    }
                    title="Record voucher for this person"
                  >
                    <Icon name="add" modifiers="sm" />
                    <span>Voucher</span>
                  </button>
                </div>

                <div className="fin-pers-card-metrics">
                  {isPartner ? (
                    <>
                      <div className="fin-pers-metric-cell">
                        <span className="fin-metric-label">Capital Contributed</span>
                        <span className="fin-metric-val positive">{formatCurrency(capital)}</span>
                      </div>
                      <div className="fin-pers-metric-cell">
                        <span className="fin-metric-label">Drawings Taken</span>
                        <span className="fin-metric-val warning">{formatCurrency(drawings)}</span>
                      </div>
                      <div className="fin-pers-metric-cell span-2 highlight-cell">
                        <span className="fin-metric-label">Net Equity Balance</span>
                        <span className={`fin-metric-val bold ${netEquity >= 0 ? "positive" : "negative"}`}>
                          {formatCurrency(netEquity)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="fin-pers-metric-cell">
                        <span className="fin-metric-label">Incurred Fees</span>
                        <span className="fin-metric-val">{formatCurrency(fees)}</span>
                      </div>
                      <div className="fin-pers-metric-cell">
                        <span className="fin-metric-label">Advances Owed</span>
                        <span className="fin-metric-val">{formatCurrency(advances)}</span>
                      </div>
                      <div className="fin-pers-metric-cell span-2 highlight-cell">
                        <span className="fin-metric-label">Unpaid Payables</span>
                        <span className={`fin-metric-val bold ${payables > 0 ? "negative" : "positive"}`}>
                          {formatCurrency(payables)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Optional Sub-table: Per-project personal status */}
      {showByProject && (
        <div className="fin-pers-by-project-section" data-testid="personal-by-project-section">
          <div className="fin-pers-by-project-header">
            <Icon name="account_tree" modifiers="md" />
            <h3 className="fin-pers-by-project-title">Individual Balances Segregated By Project</h3>
          </div>

          <div className="fin-pers-table-wrapper">
            {byProject.length === 0 ? (
              <div className="fin-pers-empty-list">No project-linked personal ledger entries found.</div>
            ) : (
              <table className="fin-pers-table">
                <thead>
                  <tr>
                    <th>Stakeholder</th>
                    <th>Project</th>
                    <th className="align-right">Fees Incurred</th>
                    <th className="align-right">Drawings</th>
                    <th className="align-right">Advances</th>
                    <th className="align-right">Unpaid Payables</th>
                  </tr>
                </thead>
                <tbody>
                  {byProject.map((row, idx) => (
                    <tr key={`${row.user_id}-${row.project_id || "gen"}-${idx}`}>
                      <td className="fin-pers-table-user">{row.full_name}</td>
                      <td>
                        <span className="fin-pers-proj-badge">
                          {row.project_code || "GEN"} · {row.project_name}
                        </span>
                      </td>
                      <td className="align-right">{formatCurrency(row.fees_incurred || 0)}</td>
                      <td className="align-right">{formatCurrency(row.drawings_taken || 0)}</td>
                      <td className="align-right">{formatCurrency(row.advances_owed || 0)}</td>
                      <td className="align-right fin-pers-table-payables">
                        {formatCurrency(row.payables_unpaid || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalFinancesView;

