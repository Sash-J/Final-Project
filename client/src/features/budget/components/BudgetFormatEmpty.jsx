import BudgetColGroup from "./BudgetColGroup";
import BudgetTableHeader from "./BudgetTableHeader";
import SelectedOptionsSvg from "../../../assets/svg images/undraw_selected-options_2x1i.svg";

export const BudgetFormatEmpty = () => (
  <div className="bef-sheet empty-format-sheet" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '600px' }}>
    <table className="bef-table header-only-table" style={{ flexShrink: 0 }}>
      <BudgetColGroup />
      <BudgetTableHeader />
    </table>
    <div className="empty-format-placeholder" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: '40px' }}>
      <img
        src={SelectedOptionsSvg}
        alt="Select project options"
        style={{ maxWidth: '350px', marginBottom: '32px', opacity: 0.5 }}
      />
      <span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.4)', fontWeight: '400', cursor: 'default' }}>
        Select a project and version to view the budget
      </span>
    </div>
  </div>
);

export default BudgetFormatEmpty;
