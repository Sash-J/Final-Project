import BudgetColGroup from "./BudgetColGroup";
import BudgetTableHeader from "./BudgetTableHeader";

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

export default BudgetFormatEmpty;
