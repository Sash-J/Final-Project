import React from "react";
import "./BudgetEntrySkeleton.css";
import FlipFadeText from "../../../components/common/FlipFadeText";

export const SkeletonBox = ({
  className = "",
  pulse = true,
  delay = 1,
}) => (
  <div
    className={`${className} ${pulse ? "premium-skel-pulse" : ""} premium-skel-delay-${delay}`}
  ></div>
);

export const SkeletonRow = ({ delay = 1 }) => (
  <tr className="premium-skel-table-row">
    <td className="col-drag">
      <SkeletonBox className="premium-skel-col-sm" pulse delay={delay} />
    </td>
    <td className="col-item-name">
      <SkeletonBox className="premium-skel-col-lg" pulse delay={delay} />
    </td>
    <td className="col-units">
      <SkeletonBox className="premium-skel-col-sm" pulse delay={delay} />
    </td>
    <td className="col-rate-type">
      <SkeletonBox className="premium-skel-col-md" pulse delay={delay} />
    </td>
    <td className="col-rate">
      <SkeletonBox className="premium-skel-col-md" pulse delay={delay} />
    </td>
    <td className="col-gross">
      <SkeletonBox className="premium-skel-col-md" pulse delay={delay} />
    </td>
    <td className="col-add">
      <SkeletonBox className="premium-skel-col-sm" pulse delay={delay} />
    </td>
    <td className="col-total">
      <SkeletonBox className="premium-skel-col-md" pulse delay={delay} />
    </td>
  </tr>
);

export const SkeletonPhase = ({ itemsCount = 3 }) => (
  <div className="premium-skel-group">
    <SkeletonBox className="premium-skel-group-header" pulse delay={1} />
    
    <table className="bef-table premium-skel-table">
      <tbody>
        {Array.from({ length: itemsCount }).map((_, i) => (
          <SkeletonRow key={i} delay={(i % 4) + 1} />
        ))}
      </tbody>
    </table>
    
    <div className="premium-skel-total-row">
      <SkeletonBox className="premium-skel-total" pulse delay={3} />
    </div>
  </div>
);

export const SkeletonTable = () => (
  <div className="premium-skeleton-container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <FlipFadeText />
  </div>
);

// We keep these exports around in case other files expect them as no-ops now
export const SkeletonHeader = () => null;
