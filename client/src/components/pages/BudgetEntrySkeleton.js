import React from "react";
import { getCurrencySymbol } from "../../utils/currencyUtils";
import "./BudgetEntrySkeleton.css";

//Table columns
export const BudgetColGroup = () => (
  <colgroup className="bef-skeleton-colgroup">
    <col />
    <col />
    <col />
    <col />
    <col />
    <col />
    <col />
    <col />
  </colgroup>
);

export const BudgetTableHeader = ({ isSkeleton = false }) => (
  <thead>
    <tr>
      <th className="col-drag"></th>
      <th className="col-item-name">
        {isSkeleton ? (
          <SkeletonBox className="skel-header-bar-left" />
        ) : (
          "ITEM NAME"
        )}
      </th>
      <th className="col-units">
        {isSkeleton ? (
          <SkeletonBox className="skel-header-bar-center" />
        ) : (
          "UNITS"
        )}
      </th>
      <th className="col-rate-type">
        {isSkeleton ? (
          <SkeletonBox className="skel-header-bar-center" />
        ) : (
          "TYPE"
        )}
      </th>
      <th className="col-rate">
        {isSkeleton ? (
          <SkeletonBox className="skel-header-bar-right" />
        ) : (
          "RATE"
        )}
      </th>
      <th className="col-gross">
        {isSkeleton ? (
          <SkeletonBox className="skel-header-bar-right" />
        ) : (
          `GROSS (${getCurrencySymbol()})`
        )}
      </th>
      <th className="col-add">
        {isSkeleton ? (
          <SkeletonBox className="skel-header-bar-right" />
        ) : (
          "ADDITIONAL"
        )}
      </th>
      <th className="col-total">
        {isSkeleton ? (
          <SkeletonBox className="skel-header-bar-right" />
        ) : (
          `TOTAL (${getCurrencySymbol()})`
        )}
      </th>
    </tr>
  </thead>
);

//keletal
export const SkeletonBox = ({
  width,
  height,
  margin,
  className = "",
  style = {},
}) => (
  <div
    className={`skeleton-box skeleton-base ${className}`}
    style={{
      width: width || "100%",
      height: height || "5px",
      margin: margin || "0",
      ...style,
    }}
  ></div>
);

export const SkeletonRow = () => (
  <tr className="bef-row skeleton-row">
    <td className="col-drag">
      <SkeletonBox className="skel-bar-handle" margin="0 auto" />
    </td>
    <td className="col-item-name">
      <div className="item-name-cell-wrapper">
        <SkeletonBox className="skel-bar-name" />
      </div>
    </td>
    <td className="col-units">
      <div className="readability-input-proxy">
        <SkeletonBox className="skel-bar-small" />
      </div>
    </td>
    <td className="col-rate-type">
      <div className="rate-type-column-content">
        <SkeletonBox className="skel-bar-medium" />
      </div>
    </td>
    <td className="col-rate">
      <div className="readability-input-proxy">
        <SkeletonBox className="skel-bar-medium" />
      </div>
    </td>
    <td className="col-gross">
      <div className="readability-input-proxy">
        <SkeletonBox className="skel-bar-medium" />
      </div>
    </td>
    <td className="col-add">
      <div className="readability-input-proxy">
        <SkeletonBox className="skel-bar-medium" />
      </div>
    </td>
    <td className="col-total">
      <div className="readability-input-proxy">
        <SkeletonBox className="skel-bar-large" />
      </div>
    </td>
  </tr>
);

export const SkeletonPhase = ({ itemsPerCat = 3 }) => (
  <div className="phase-section expanded skeleton-phase">
    <div className="phase-header">
      <div className="phase-header-left">
        <SkeletonBox className="skel-phase-title-bar" />
      </div>
      <div className="phase-header-right">
        <SkeletonBox className="skel-phase-total-bar" />
      </div>
    </div>
    <div className="phase-content">
      <div className="dept-section">
        <table className="bef-table dept-header-table">
          <BudgetColGroup />
          <tbody className="bef-dept-body">
            <tr className="bef-dept-row">
              <td colSpan="8">
                <div className="dept-header-content">
                  <SkeletonBox className="skel-dept-bar" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <table className="bef-table cat-list-table">
          <BudgetColGroup />
          <tbody className="bef-cat-body">
            <tr className="bef-cat-row">
              <td className="col-drag">
                <SkeletonBox className="skel-bar-handle" margin="0 auto" />
              </td>
              <td colSpan="6" className="cat-name-cell">
                <div className="cat-header-row">
                  <SkeletonBox className="skel-cat-bar" />
                </div>
              </td>
              <td className="col-total cat-subtotal">
                <SkeletonBox className="skel-cat-total-bar" />
              </td>
            </tr>
            {Array.from({ length: itemsPerCat }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export const SkeletonTable = () => (
  <div className="bef-sheet skeleton-sheet">
    <table className="bef-table header-only-table">
      <BudgetColGroup />
      <BudgetTableHeader isSkeleton />
    </table>
    <SkeletonPhase itemsPerCat={4} />
    <SkeletonPhase itemsPerCat={3} />
  </div>
);

export const BudgetFormatEmpty = () => (
  <div className="bef-sheet empty-format-sheet">
    <table className="bef-table header-only-table">
      <BudgetColGroup />
      <BudgetTableHeader />
    </table>
    <div className="empty-format-placeholder">
      Select a project and version to view the budget
    </div>
  </div>
);
