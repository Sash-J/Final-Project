import BudgetColGroup from "./BudgetColGroup";
import BudgetTableHeader from "./BudgetTableHeader";
import SelectedOptionsSvg from "../../../assets/svg images/undraw_selected-options_2x1i.svg";

export const BudgetFormatEmpty = () => (
  <div className="bef-sheet empty-format-sheet">
    <table className="bef-table header-only-table">
      <BudgetColGroup />
      <BudgetTableHeader />
    </table>
    <div className="empty-format-placeholder">
      <img
        src={SelectedOptionsSvg}
        alt="Select project options"
        className="empty-format-svg"
      />
      <span className="empty-format-text">
        Select a project and version to view the budget
      </span>
    </div>
  </div>
);

export default BudgetFormatEmpty;
