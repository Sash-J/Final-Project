export const BudgetColGroup = ({ isCompareMode }) => (
  <colgroup className="bef-skeleton-colgroup">
    {!isCompareMode && <col className="col-drag" />}
    <col className="col-item-name" />
    <col className="col-units" />
    <col className="col-rate-type" />
    <col className="col-rate" />
    <col className="col-gross" />
    <col className="col-add" />
    <col className="col-total" />
    {isCompareMode && (
      <>
        <col className="col-compare-total" />
        <col className="col-compare-variance" />
      </>
    )}
  </colgroup>
);

export default BudgetColGroup;
