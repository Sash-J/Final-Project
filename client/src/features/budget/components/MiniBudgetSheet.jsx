import React from "react";
import "./MiniBudgetSheet.css";

/**
 * Realistic mini replica mockup of the app's budget sheet (BudgetEntryForm)
 * for the 3D glass folders, featuring real budget column headers, phase sections,
 * line items, subtotal summary, and the version watermark (e.g. "V1", "V2", "DRAFT").
 */
const MiniBudgetSheet = ({
  versionNumber = 1,
  dateStr = "Published",
  isDraft = false,
  projectName = "",
  totalAmount,
}) => {
  const watermarkText = isDraft ? "DRAFT" : `V${versionNumber}`;
  const versionBadge = isDraft ? "DRAFT" : `V${versionNumber}`;
  const formattedTotal = totalAmount
    ? `$${Number(totalAmount).toLocaleString()}`
    : "$12,150";

  return (
    <div className={`mini-budget-sheet ${isDraft ? "is-draft" : ""}`}>
      {/* Top Accent Strip */}
      <div className="mini-budget-top-strip" />

      {/* Large Background Version Watermark */}
      <div className="mini-budget-watermark" aria-hidden="true">
        {watermarkText}
      </div>

      {/* Sheet Top Info Bar */}
      <div className="mini-sheet-topbar">
        <div className="mini-sheet-title-group">
          <span className="mini-sheet-icon">❖</span>
          <span className="mini-sheet-title" title={projectName || "Production Budget"}>
            {projectName || "Production Budget"}
          </span>
        </div>
        <div className="mini-sheet-version-tag">
          <span className="mini-sheet-version-num">{versionBadge}</span>
        </div>
      </div>

      {/* Mockup Budget Table */}
      <div className="mini-bef-table">
        {/* Table Column Headers (matches BudgetTableHeader.jsx) */}
        <div className="mini-bef-header-row">
          <span className="mini-col col-item-name">ITEM NAME</span>
          <span className="mini-col col-units">UNITS</span>
          <span className="mini-col col-rate">RATE</span>
          <span className="mini-col col-total">TOTAL</span>
        </div>

        {/* Phase 1 Header (matches phase-header in BudgetEntryForm.jsx) */}
        <div className="mini-bef-phase-row">
          <span className="mini-phase-name">▸ PRODUCTION</span>
          <span className="mini-phase-subtotal">Sub: $8.6k</span>
        </div>

        {/* Item Rows (matches BudgetRow.jsx) */}
        <div className="mini-bef-row">
          <span className="mini-col col-item-name">Director / DP</span>
          <span className="mini-col col-units">1</span>
          <span className="mini-col col-rate">$4,500</span>
          <span className="mini-col col-total">$4,500</span>
        </div>

        <div className="mini-bef-row zebra">
          <span className="mini-col col-item-name">Camera Package A</span>
          <span className="mini-col col-units">1</span>
          <span className="mini-col col-rate">$2,800</span>
          <span className="mini-col col-total">$2,800</span>
        </div>

        <div className="mini-bef-row">
          <span className="mini-col col-item-name">Sound Mixer</span>
          <span className="mini-col col-units">2</span>
          <span className="mini-col col-rate">$650</span>
          <span className="mini-col col-total">$1,300</span>
        </div>

        {/* Phase 2 Header */}
        <div className="mini-bef-phase-row">
          <span className="mini-phase-name">▸ POST-PRODUCTION</span>
          <span className="mini-phase-subtotal">Sub: $3.5k</span>
        </div>

        <div className="mini-bef-row zebra">
          <span className="mini-col col-item-name">Color Grading & VFX</span>
          <span className="mini-col col-units">1</span>
          <span className="mini-col col-rate">$3,500</span>
          <span className="mini-col col-total">$3,500</span>
        </div>
      </div>

      {/* Sheet Summary Bar (matches bottom budget summary) */}
      <div className="mini-bef-total-bar">
        <span className="mini-total-label">GRAND TOTAL</span>
        <span className="mini-total-value">{formattedTotal}</span>
      </div>
    </div>
  );
};

export default MiniBudgetSheet;
