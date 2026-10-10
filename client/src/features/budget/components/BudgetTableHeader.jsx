import { getCurrencySymbol } from "../../../utils/currencyUtils";
import { SkeletonBox } from "./BudgetEntrySkeleton";

export const BudgetTableHeader = ({ isSkeleton = false, isCompareMode = false, versionNameA = "V1", versionNameB = "V2" }) => (
  <thead>
    <tr>
      {!isCompareMode && <th className="col-drag"></th>}
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
        ) : isCompareMode ? (
          `${versionNameA} (${getCurrencySymbol()})`
        ) : (
          `TOTAL (${getCurrencySymbol()})`
        )}
      </th>
      {isCompareMode && (
        <>
          <th className="col-compare-total">
            {isSkeleton ? (
              <SkeletonBox className="skel-header-bar-right" />
            ) : (
              `${versionNameB} (${getCurrencySymbol()})`
            )}
          </th>
          <th className="col-compare-variance">
            {isSkeleton ? (
              <SkeletonBox className="skel-header-bar-right" />
            ) : (
              `VARIANCE (${getCurrencySymbol()})`
            )}
          </th>
        </>
      )}
    </tr>
  </thead>
);

export default BudgetTableHeader;
