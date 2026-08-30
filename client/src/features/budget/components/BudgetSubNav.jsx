import HoverTooltip from "../../../components/common/HoverTooltip";
import "./BudgetSubNav.css";

const BudgetSubNav = ({
  handleDownloadPDF,
  onPublish,
  versionId,
  handleClear,
  submitting,
  handleSubmit,
  externalProjectId,
}) => {
  return (
    <div className="bef-actions">
      <HoverTooltip text="Download PDF" wrapperClassName="w-100" style={{ display: 'flex' }}>
        <div className="sidebar-widget-header w-100" onClick={handleDownloadPDF}>
          <div className="sidebar-widget-icon-wrapper theme-pdf">
            <span className="material-symbols-outlined icon-root">file_export</span>
          </div>
          <h3 className="sidebar-widget-title">Download PDF</h3>
        </div>
      </HoverTooltip>

      {onPublish && versionId && (
        <>
          <hr className="widget-divider" />
          <HoverTooltip text="Publish" wrapperClassName="w-100" style={{ display: 'flex' }}>
            <div className="sidebar-widget-header w-100" onClick={onPublish}>
              <div className="sidebar-widget-icon-wrapper theme-orange">
                <span className="material-symbols-outlined icon-root">publish</span>
              </div>
              <h3 className="sidebar-widget-title">Publish</h3>
            </div>
          </HoverTooltip>
        </>
      )}

      <hr className="widget-divider" />
      <HoverTooltip text="Clear All" wrapperClassName="w-100" style={{ display: 'flex' }}>
        <div 
          className={`sidebar-widget-header w-100 ${submitting ? 'disabled-header' : ''}`}
          onClick={submitting ? undefined : handleClear}
        >
          <div className="sidebar-widget-icon-wrapper">
            <span className="material-symbols-outlined icon-root">clear_all</span>
          </div>
          <h3 className="sidebar-widget-title">Clear All</h3>
        </div>
      </HoverTooltip>

      <hr className="widget-divider" />
      <HoverTooltip text={submitting ? "Saving…" : "Submit All"} wrapperClassName="w-100" style={{ display: 'flex' }}>
        <div 
          id="bef-save-button"
          className={`sidebar-widget-header w-100 ${(submitting || !externalProjectId) ? 'disabled-header' : ''}`}
          onClick={(submitting || !externalProjectId) ? undefined : handleSubmit}
        >
          <div className="sidebar-widget-icon-wrapper theme-submit">
            <span className="material-symbols-outlined icon-root">save</span>
          </div>
          <h3 className="sidebar-widget-title">{submitting ? "Saving…" : "Submit All"}</h3>
        </div>
      </HoverTooltip>
    </div>
  );
};

export default BudgetSubNav;
