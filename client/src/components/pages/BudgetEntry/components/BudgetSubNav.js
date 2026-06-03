import Icon from "../../../common/Icon";

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
    <div className="bef-actions" style={{ marginLeft: "auto" }}>
      <button
        className="sub-nav-btn btn-pdf"
        onClick={handleDownloadPDF}
      >
        <Icon name="file_export" modifiers="md" />
        <span>Download PDF</span>
      </button>
      {onPublish && versionId && (
        <button
          className="sub-nav-btn btn-publish"
          onClick={onPublish}
        >
          <Icon name="publish" modifiers="md" />
          <span>Publish</span>
        </button>
      )}
      <button
        className="sub-nav-btn btn-clear"
        onClick={handleClear}
        disabled={submitting}
      >
        <Icon name="clear_all" modifiers="md" />
        <span>Clear All</span>
      </button>
      <button
        id="bef-save-button"
        className="sub-nav-btn btn-save"
        onClick={handleSubmit}
        disabled={submitting || !externalProjectId}
      >
        <Icon name="save" modifiers="md" />
        <span>{submitting ? "Saving…" : "Submit All"}</span>
      </button>
    </div>
  );
};

export default BudgetSubNav;
