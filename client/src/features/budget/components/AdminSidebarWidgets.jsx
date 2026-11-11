import { useEffect, useMemo, useState } from "react";
import FloatingInput from "../../../components/common/FloatingInput";
import GlassDropdown from "../../../components/common/GlassDropdown";
import HoverTooltip from "../../../components/common/HoverTooltip";
import Icon from "../../../components/common/Icon";
import NeoButton from "../../../components/common/NeoButton";
import {
  validateDepartmentName,
  validateCategoryName,
  validateBudgetItemName,
} from "../../../utils/validators";
import { budgetService } from "../../../services/budgetService";
import toast from "react-hot-toast";

export const StatusMsg = ({ msg, setMsg }) => {
  useEffect(() => {
    if (!msg) return;
    const isError =
      msg.startsWith("Error") ||
      msg.startsWith("X") ||
      msg.startsWith("✕");
    if (!isError && setMsg) {
      const timer = setTimeout(() => {
        setMsg("");
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [msg, setMsg]);

  if (!msg) return null;
  const isError =
    msg.startsWith("Error") ||
    msg.startsWith("X") ||
    msg.startsWith("✕");
  return <p key={msg} className={`status-msg ${isError ? "error" : "success"}`}>{msg}</p>;
};

export const WidgetOptionsMenu = ({
  autoAlignEnabled = true,
  onToggleAutoAlign,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleToggle = (e) => {
    e.stopPropagation();
    const nextVal = !autoAlignEnabled;
    onToggleAutoAlign && onToggleAutoAlign(nextVal);
  };

  return (
    <div
      className="widget-options-menu-trigger"
      onClick={(e) => {
        e.stopPropagation();
        setShowMenu((prev) => !prev);
      }}
    >
      <button
        type="button"
        className={`widget-options-menu-btn ${showMenu ? "active" : ""}`}
        aria-label="Department look-up options"
        title="Drawer Options"
      >
        <Icon name="more_vert" modifiers="sm" />
      </button>
      {showMenu && (
        <>
          <div
            className="widget-options-menu-overlay"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
          />
          <div
            className="widget-options-menu-dropdown"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="widget-switch-container widget-options-switch-row"
              onClick={handleToggle}
              title="Automatically align and focus relevant department or category in budget"
            >
              <span className="switch-label neo-label">Department Look-up</span>
              <label className="switch" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={autoAlignEnabled}
                  onChange={(e) => onToggleAutoAlign && onToggleAutoAlign(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const SidebarWidgetAccordion = ({
  title,
  icon,
  iconTheme = "",
  isExpanded,
  isSidebarExpanded,
  onToggle,
  showOptionsMenu = false,
  children,
}) => {
  return (
    <>
      <HoverTooltip text={isSidebarExpanded ? "" : title} wrapperClassName="w-100 sidebar-tooltip-wrapper">
        <div className="sidebar-widget-header w-100" onClick={onToggle}>
          <div className={`sidebar-widget-icon-wrapper ${iconTheme}`}>
            <Icon name={icon} modifiers="sm" />
          </div>
          <h3 className="sidebar-widget-title">{title}</h3>
        </div>
      </HoverTooltip>

      <div className={`sidebar-widget-content ${isExpanded ? 'accordion-open' : ''}`}>
        <div className="sidebar-widget-content-inner">
          {children}
        </div>
      </div>
    </>
  );
};

/* ── Project & Version Widget (Option B) ─────────────────────────────────── */
export const ProjectVersionWidget = ({
  isClient = false,
  canEditBudget = true,
  projectId = "",
  versionId = "",
  projectOptions = [],
  versionOptions = [],
  onProjectChange,
  onVersionChange,
  onDeleteVersion,
  onCreateNewVersion,
}) => {
  return (
    <div className="neo-form">
      <FloatingInput
        label={isClient ? "Client Project" : "Active Project"}
        hasValue={Boolean(projectId)}
      >
        <GlassDropdown
          placeholder="- Select Project -"
          options={projectOptions}
          value={projectId}
          onChange={(val) => onProjectChange && onProjectChange(val)}
        />
      </FloatingInput>

      {projectId && (
        <FloatingInput
          label={isClient ? "Published Budget Version" : "Budget Version"}
          hasValue={Boolean(versionId)}
        >
          <GlassDropdown
            placeholder={
              isClient
                ? (versionOptions.length === 0 ? "— No Published Versions —" : "— Select Version —")
                : "— Select —"
            }
            modifiers="lg fluid"
            options={versionOptions}
            value={versionId}
            onChange={(val) => onVersionChange && onVersionChange(val)}
            disabled={versionOptions.length === 0}
          />
        </FloatingInput>
      )}

      {isClient && versionOptions.length === 0 && projectId && (
        <div className="budget-drawer-notice">
          <Icon name="info" modifiers="sm" />
          <span>No published budget is available for this project yet. Published versions from the production team will appear here once released.</span>
        </div>
      )}

      {canEditBudget && projectId && (
        versionOptions.length === 0 ? (
          <NeoButton
            type="button"
            variant="solid"
            fullWidth
            icon="add"
            onClick={onCreateNewVersion}
          >
            Initialize Version 1
          </NeoButton>
        ) : (
          <div className="neo-form-row">
            <NeoButton
              type="button"
              variant="danger"
              fullWidth
              icon="delete"
              onClick={onDeleteVersion}
              disabled={!versionId}
              disabledReason={!versionId ? "Select a version to delete" : ""}
            >
              Delete
            </NeoButton>

            <NeoButton
              type="button"
              variant="neutral"
              fullWidth
              icon="content_copy"
              onClick={onCreateNewVersion}
              disabled={!versionId}
              disabledReason={!versionId ? "Select a version to clone" : ""}
            >
              Clone
            </NeoButton>
          </div>
        )
      )}
    </div>
  );
};

/* ── Add Department Widget ───────────────────────────────────────────────── */
export const AddDepartment = ({
  phases = [],
  onAdded,
  isExpanded = false,
  isSidebarExpanded = false,
  onToggle,
  inDrawer = false,
}) => {
  const [name, setName] = useState("");
  const [phaseId, setPhaseId] = useState("2"); // Default to Production
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState({ name: false, phaseId: false });

  const phaseOptions = useMemo(() => phases.map((p) => ({ value: p.id, label: p.phase_name })), [phases]);

  const validationErrors = useMemo(() => ({
    name: validateDepartmentName(name),
    phaseId: !phaseId ? "Production phase is required." : "",
  }), [name, phaseId]);

  const isFormValid = !validationErrors.name && !validationErrors.phaseId;

  const submitDisabledReason = useMemo(() => {
    if (!name.trim()) return "Department name is required";
    if (validationErrors.name) return validationErrors.name;
    if (!phaseId) return "Production phase is required";
    return "";
  }, [name, validationErrors, phaseId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, phaseId: true });
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const data = await budgetService.createDepartment({
        department_name: name.trim(),
        phase_id: Number(phaseId),
      });
      if (data && data.error) throw new Error(data.error);

      toast.success(`"${name}" added`);
      setName("");
      setTouched({ name: false, phaseId: false });
      onAdded && onAdded();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formFields = (
    <>
      <FloatingInput
        label="Department Name"
        type="text"
        placeholder="e.g. Camera, Sound, Lighting"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
        error={touched.name ? validationErrors.name : ""}
        required
      />

      <FloatingInput
        label="Production Phase"
        hasValue={Boolean(phaseId)}
        onBlur={() => setTouched((prev) => ({ ...prev, phaseId: true }))}
        error={touched.phaseId ? validationErrors.phaseId : ""}
        required
      >
        <GlassDropdown
          placeholder="— Select Phase —"
          options={phaseOptions}
          value={phaseId}
          onChange={(val) => {
            setPhaseId(val);
            setTouched((prev) => ({ ...prev, phaseId: true }));
          }}
        />
      </FloatingInput>

      <NeoButton
        type="submit"
        variant="solid"
        fullWidth
        loading={isSubmitting}
        disabled={!isFormValid}
        disabledReason={submitDisabledReason}
        icon="add_circle"
      >
        Add Department
      </NeoButton>
    </>
  );

  if (inDrawer) {
    return (
      <form onSubmit={handleSubmit} className="neo-form" noValidate>
        {formFields}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="neo-form" noValidate>
      <SidebarWidgetAccordion
        title="Add Department"
        icon="domain"
        isExpanded={isExpanded}
        isSidebarExpanded={isSidebarExpanded}
        onToggle={onToggle}
      >
        <div className="neo-form">
          {formFields}
        </div>
      </SidebarWidgetAccordion>
    </form>
  );
};

/* ── Add Category Widget ─────────────────────────────────────────────────── */
export const AddCategory = ({
  departments = [],
  onAdded,
  onDeptSelect,
  isExpanded = false,
  isSidebarExpanded = false,
  onToggle,
  inDrawer = false,
}) => {
  const [name, setName] = useState("");
  const [deptId, setDeptId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState({ name: false, deptId: false });

  const deptOptions = useMemo(() => departments.map((d) => ({ value: d.id, label: d.department_name })), [departments]);

  const validationErrors = useMemo(() => ({
    name: validateCategoryName(name),
    deptId: !deptId ? "Department assignment is required." : "",
  }), [name, deptId]);

  const isFormValid = !validationErrors.name && !validationErrors.deptId;

  const submitDisabledReason = useMemo(() => {
    if (!name.trim()) return "Category name is required";
    if (validationErrors.name) return validationErrors.name;
    if (!deptId) return "Department assignment is required";
    return "";
  }, [name, validationErrors, deptId]);

  const handleDeptChange = (val) => {
    setDeptId(val);
    setTouched((prev) => ({ ...prev, deptId: true }));
    onDeptSelect && onDeptSelect(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, deptId: true });
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const data = await budgetService.createCategory({
        category_name: name.trim(),
        department_id: Number(deptId),
      });
      if (data && data.error) throw new Error(data.error);

      toast.success(`Category "${name}" added`);
      setName("");
      setDeptId("");
      setTouched({ name: false, deptId: false });
      onDeptSelect && onDeptSelect("");
      onAdded && onAdded();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formFields = (
    <>
      <FloatingInput
        label="Category Name"
        type="text"
        placeholder="e.g. Electrical, Grip, Labor"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
        error={touched.name ? validationErrors.name : ""}
        required
      />

      <FloatingInput
        label="Assign to Department"
        hasValue={Boolean(deptId)}
        onBlur={() => setTouched((prev) => ({ ...prev, deptId: true }))}
        error={touched.deptId ? validationErrors.deptId : ""}
        required
      >
        <GlassDropdown
          placeholder="— Select Department —"
          options={deptOptions}
          value={deptId}
          onChange={handleDeptChange}
        />
      </FloatingInput>

      <NeoButton
        type="submit"
        variant="solid"
        fullWidth
        loading={isSubmitting}
        disabled={!isFormValid}
        disabledReason={submitDisabledReason}
        icon="add_circle"
      >
        Add Category
      </NeoButton>
    </>
  );

  if (inDrawer) {
    return (
      <form onSubmit={handleSubmit} className="neo-form" noValidate>
        {formFields}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="neo-form" noValidate>
      <SidebarWidgetAccordion
        title="Add Category"
        icon="category"
        iconTheme="theme-teal"
        isExpanded={isExpanded}
        isSidebarExpanded={isSidebarExpanded}
        onToggle={onToggle}
      >
        <div className="neo-form">
          {formFields}
        </div>
      </SidebarWidgetAccordion>
    </form>
  );
};

/* ── Add Budget Item Widget ──────────────────────────────────────────────── */
export const AddBudgetItem = ({
  categories = [],
  onAdded,
  onCategorySelect,
  isExpanded = false,
  isSidebarExpanded = false,
  onToggle,
  inDrawer = false,
}) => {
  const [name, setName] = useState("");
  const [catId, setCatId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState({ name: false, catId: false });

  const catOptions = useMemo(() => categories.map((c) => ({ value: c.id, label: `${c.category_name} (${c.department_name})` })), [categories]);

  const validationErrors = useMemo(() => ({
    name: validateBudgetItemName(name),
    catId: !catId ? "Category is required." : "",
  }), [name, catId]);

  const isFormValid = !validationErrors.name && !validationErrors.catId;

  const submitDisabledReason = useMemo(() => {
    if (!name.trim()) return "Item description is required";
    if (validationErrors.name) return validationErrors.name;
    if (!catId) return "Category is required";
    return "";
  }, [name, validationErrors, catId]);

  const handleCatChange = (val) => {
    setCatId(val);
    setTouched((prev) => ({ ...prev, catId: true }));
    onCategorySelect && onCategorySelect(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, catId: true });
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const data = await budgetService.createBudgetItem({
        item_name: name.trim(),
        category_id: Number(catId),
      });
      if (data && data.error) throw new Error(data.error);

      toast.success(`Item "${name}" added`);
      setName("");
      setCatId("");
      setTouched({ name: false, catId: false });
      onCategorySelect && onCategorySelect("");
      onAdded && onAdded();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formFields = (
    <>
      <FloatingInput
        label="Item Description"
        type="text"
        placeholder="e.g. ARRI SkyPanel S60-C"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
        error={touched.name ? validationErrors.name : ""}
        required
      />

      <FloatingInput
        label="Category"
        hasValue={Boolean(catId)}
        onBlur={() => setTouched((prev) => ({ ...prev, catId: true }))}
        error={touched.catId ? validationErrors.catId : ""}
        required
      >
        <GlassDropdown
          placeholder="— Select Category —"
          options={catOptions}
          value={catId}
          onChange={handleCatChange}
        />
      </FloatingInput>

      <NeoButton
        type="submit"
        variant="solid"
        fullWidth
        loading={isSubmitting}
        disabled={!isFormValid}
        disabledReason={submitDisabledReason}
        icon="add_circle"
      >
        Add Budget Item
      </NeoButton>
    </>
  );

  if (inDrawer) {
    return (
      <form onSubmit={handleSubmit} className="neo-form" noValidate>
        {formFields}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="neo-form" noValidate>
      <SidebarWidgetAccordion
        title="Add Budget Item"
        icon="inventory_2"
        iconTheme="theme-orange"
        isExpanded={isExpanded}
        isSidebarExpanded={isSidebarExpanded}
        onToggle={onToggle}
      >
        <div className="neo-form">
          {formFields}
        </div>
      </SidebarWidgetAccordion>
    </form>
  );
};

/* ── Compare Budget Widget ───────────────────────────────────────────────── */
export const CompareBudgetWidget = ({
  projects = [],
  currentProjectId = "",
  currentVersionId = "",
  isExpanded = false,
  isSidebarExpanded = false,
  onToggle,
  compareProjectId = "",
  setCompareProjectId,
  compareVersionId = "",
  setCompareVersionId,
  onClearCompare,
  inDrawer = false,
}) => {
  const [versionsB, setVersionsB] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    if (compareProjectId) {
      const controller = new AbortController();
      setLoadingVersions(true);

      const fetchVersions = async () => {
        try {
          const res = await budgetService.getBudgetVersions(
            compareProjectId,
            { signal: controller.signal }
          );
          if (!controller.signal.aborted) {
            if (Array.isArray(res)) {
              setVersionsB(res);
            } else {
              setVersionsB([]);
            }
            setLoadingVersions(false);
          }
        } catch (err) {
          if (!controller.signal.aborted) {
            console.error("Failed to fetch versions:", err);
            setVersionsB([]);
            setLoadingVersions(false);
          }
        }
      };

      fetchVersions();

      return () => controller.abort();
    } else {
      setVersionsB([]);
      setCompareVersionId("");
    }
  }, [compareProjectId, setCompareVersionId]);

  const projectOptions = useMemo(() => projects.map((p) => ({
    value: String(p.id),
    label: p.project_name,
  })), [projects]);

  const versionBOptions = useMemo(() => versionsB.map((v) => {
    const isCurrent = String(v.id) === String(currentVersionId) && String(compareProjectId) === String(currentProjectId);
    return {
      value: String(v.id),
      label: `Version ${v.version_number}${isCurrent ? " (Active - Current)" : ""}`,
      disabled: isCurrent,
    };
  }), [versionsB, currentVersionId, compareProjectId, currentProjectId]);

  // Prevent active version from remaining selected as compare target
  useEffect(() => {
    if (
      compareVersionId &&
      String(compareVersionId) === String(currentVersionId) &&
      String(compareProjectId) === String(currentProjectId)
    ) {
      setCompareVersionId("");
    }
  }, [compareVersionId, currentVersionId, compareProjectId, currentProjectId, setCompareVersionId]);

  const formContent = (
    <div className="neo-form">
      <p className="compare-widget-description">
        Select a project and version to compare side-by-side against the currently active budget.
      </p>

      <FloatingInput
        label="Comparison Project"
        hasValue={Boolean(compareProjectId)}
      >
        <GlassDropdown
          placeholder="— Select Project B —"
          options={projectOptions}
          value={compareProjectId}
          onChange={(val) => {
            setCompareProjectId(val);
            setCompareVersionId("");
          }}
          searchable
        />
      </FloatingInput>

      <FloatingInput
        label="Comparison Version"
        hasValue={Boolean(compareVersionId)}
      >
        <GlassDropdown
          placeholder={loadingVersions ? "Loading versions..." : "— Select Version B —"}
          options={versionBOptions}
          value={compareVersionId}
          onChange={setCompareVersionId}
          disabled={!compareProjectId || loadingVersions}
        />
      </FloatingInput>

      {compareProjectId && compareVersionId && (
        <NeoButton
          type="button"
          variant="cancel"
          fullWidth
          icon="close"
          onClick={onClearCompare}
        >
          Exit Compare Mode
        </NeoButton>
      )}
    </div>
  );

  if (inDrawer) {
    return formContent;
  }

  return (
    <div className="compare-budget-widget">
      <SidebarWidgetAccordion
        title="Compare Budgets"
        icon="compare_arrows"
        isExpanded={isExpanded}
        isSidebarExpanded={isSidebarExpanded}
        onToggle={onToggle}
      >
        {formContent}
      </SidebarWidgetAccordion>
    </div>
  );
};
