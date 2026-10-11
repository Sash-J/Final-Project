import { useEffect, useMemo, useState } from "react";
import GlassDropdown from "../../../components/common/GlassDropdown";
import HoverTooltip from "../../../components/common/HoverTooltip";
import { budgetService } from "../../../services/budgetService";
import toast from "react-hot-toast";

export const StatusMsg = ({ msg, setMsg }) => {
  useEffect(() => {
    if (!msg) return;
    const isError =
      msg.startsWith("Error") ||
      msg.startsWith("X") ||
      msg.startsWith("âŒ");
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
    msg.startsWith("â Œ");
  return <p key={msg} className={`status-msg ${isError ? "error" : "success"}`}>{msg}</p>;
};

export const WidgetOptionsMenu = ({ autoCenterEnabled, onToggleAutoCenter, isExpanded }) => {
  const [showMenu, setShowMenu] = useState(false);

  if (!isExpanded) return null;

  return (
    <div
      className="widget-options-menu-trigger"
      onClick={(e) => { e.stopPropagation(); setShowMenu((prev) => !prev); }}
    >
      <span className={`material-symbols-outlined widget-options-menu-btn ${showMenu ? 'active' : ''}`}>
        more_vert
      </span>
      {showMenu && (
        <>
          <div className="widget-options-menu-overlay" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
          <div className="widget-options-menu-dropdown" onClick={(e) => e.stopPropagation()}>
            <div className="widget-switch-container">
              <span className="switch-label neo-label">Auto-center Viewport</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={autoCenterEnabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleAutoCenter(e.target.checked);
                  }}
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
  autoCenterEnabled,
  onToggleAutoCenter,
  showOptionsMenu = false,
  children,
}) => {
  return (
    <>
      <HoverTooltip text={isSidebarExpanded ? "" : title} wrapperClassName="w-100 sidebar-tooltip-wrapper">
        <div className="sidebar-widget-header w-100" onClick={onToggle}>
          <div className={`sidebar-widget-icon-wrapper ${iconTheme}`}>
            <span className="material-symbols-outlined icon-root">{icon}</span>
          </div>
          <h3 className="sidebar-widget-title">{title}</h3>
          {showOptionsMenu && (
            <WidgetOptionsMenu
              autoCenterEnabled={autoCenterEnabled}
              onToggleAutoCenter={onToggleAutoCenter}
              isExpanded={isExpanded}
            />
          )}
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

export const AddDepartment = ({ phases, onAdded, isExpanded, isSidebarExpanded, onToggle, autoCenterEnabled, onToggleAutoCenter }) => {
  const [name, setName] = useState("");
  const [phaseId, setPhaseId] = useState("2"); // Default to Production
  const [isSubmitting, setIsSubmitting] = useState(false);

  const phaseOptions = useMemo(() => phases.map((p) => ({ value: p.id, label: p.phase_name })), [phases]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const data = await budgetService.createDepartment({
        department_name: name,
        phase_id: Number(phaseId),
      });
      if (data && data.error) throw new Error(data.error);

      toast.success(`"${name}" added`);
      setName("");
      onAdded && onAdded();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <SidebarWidgetAccordion
        title="Add Department"
        icon="domain"
        isExpanded={isExpanded}
        isSidebarExpanded={isSidebarExpanded}
        onToggle={onToggle}
        showOptionsMenu={true}
        autoCenterEnabled={autoCenterEnabled}
        onToggleAutoCenter={onToggleAutoCenter}
      >
        <div className="sidebar-widget-input-wrapper">
          <span className="material-symbols-outlined sidebar-widget-input-icon">corporate_fare</span>
          <input
            className="neo-input"
            type="text"
            placeholder="Department Name (e.g. Camera)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="sidebar-dropdown-container">
          <GlassDropdown
            placeholder="— Select Phase —"
            options={phaseOptions}
            value={phaseId}
            onChange={(val) => setPhaseId(val)}
          />
        </div>

        <button type="submit" className="sidebar-widget-btn sidebar-widget-btn-full" disabled={isSubmitting}>
          <span className="material-symbols-outlined">add_circle</span>
          {isSubmitting ? "Adding..." : "Add Department"}
        </button>


      </SidebarWidgetAccordion>
    </form>
  );
};

export const AddCategory = ({ departments, onAdded, onDeptSelect, isExpanded, isSidebarExpanded, onToggle, autoCenterEnabled, onToggleAutoCenter }) => {
  const [name, setName] = useState("");
  const [deptId, setDeptId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const data = await budgetService.createCategory({
        category_name: name,
        department_id: Number(deptId),
      });
      if (data && data.error) throw new Error(data.error);

      toast.success(`Category "${name}" added`);
      setName("");
      setDeptId("");
      onDeptSelect && onDeptSelect("");
      onAdded && onAdded();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deptOptions = useMemo(() => departments.map((d) => ({ value: d.id, label: d.department_name })), [departments]);

  const handleDeptChange = (val) => {
    setDeptId(val);
    onDeptSelect && onDeptSelect(val);
  };

  return (
    <form onSubmit={handleSubmit}>
      <SidebarWidgetAccordion
        title="Add Category"
        icon="category"
        iconTheme="theme-teal"
        isExpanded={isExpanded}
        isSidebarExpanded={isSidebarExpanded}
        onToggle={onToggle}
        showOptionsMenu={true}
        autoCenterEnabled={autoCenterEnabled}
        onToggleAutoCenter={onToggleAutoCenter}
      >
        <div className="sidebar-widget-input-wrapper">
          <span className="material-symbols-outlined sidebar-widget-input-icon">label</span>
          <input
            className="neo-input"
            type="text"
            placeholder="Category Name (e.g. Electrical)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="sidebar-dropdown-container">
          <GlassDropdown
            placeholder="— Select Department —"
            options={deptOptions}
            value={deptId}
            onChange={handleDeptChange}
          />
        </div>

        <button type="submit" className="sidebar-widget-btn sidebar-widget-btn-full theme-green" disabled={isSubmitting}>
          <span className="material-symbols-outlined">add_circle</span>
          {isSubmitting ? "Adding..." : "Add Category"}
        </button>


      </SidebarWidgetAccordion>
    </form>
  );
};

export const AddBudgetItem = ({
  categories,
  onAdded,
  onCategorySelect,
  autoAlignEnabled,
  onToggleAutoAlign,
  isExpanded,
  isSidebarExpanded,
  onToggle,
  autoCenterEnabled,
  onToggleAutoCenter
}) => {
  const [name, setName] = useState("");
  const [catId, setCatId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const data = await budgetService.createBudgetItem({
        item_name: name,
        category_id: Number(catId),
      });
      if (data && data.error) throw new Error(data.error);

      toast.success(`Item "${name}" added`);
      setName("");
      setCatId("");
      onCategorySelect && onCategorySelect("");
      onAdded && onAdded();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const catOptions = useMemo(() => categories.map((c) => ({ value: c.id, label: `${c.category_name} (${c.department_name})` })), [categories]);

  const handleCatChange = (val) => {
    setCatId(val);
    onCategorySelect && onCategorySelect(val);
  };

  return (
    <form onSubmit={handleSubmit}>
      <SidebarWidgetAccordion
        title="Add Budget Item"
        icon="inventory_2"
        iconTheme="theme-orange"
        isExpanded={isExpanded}
        isSidebarExpanded={isSidebarExpanded}
        onToggle={onToggle}
        showOptionsMenu={true}
        autoCenterEnabled={autoCenterEnabled}
        onToggleAutoCenter={onToggleAutoCenter}
      >
        <div className="sidebar-widget-input-wrapper">
          <span className="material-symbols-outlined sidebar-widget-input-icon">post_add</span>
          <input
            className="neo-input"
            type="text"
            placeholder="Item Name (e.g. LED Panel)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="sidebar-dropdown-container">
          <GlassDropdown
            placeholder="— Select Category —"
            options={catOptions}
            value={catId}
            onChange={handleCatChange}
          />
        </div>

        <button type="submit" className="sidebar-widget-btn sidebar-widget-btn-full theme-orange sidebar-widget-btn-spaced" disabled={isSubmitting}>
          <span className="material-symbols-outlined">add_circle</span>
          {isSubmitting ? "Adding..." : "Add Budget Item"}
        </button>

        <div className="widget-switch-container">
          <span className="switch-label neo-label widget-switch-label">Department Look-up</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={autoAlignEnabled}
              onChange={(e) => onToggleAutoAlign(e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>


      </SidebarWidgetAccordion>
    </form>
  );
};


export const CompareBudgetWidget = ({
  projects,
  isExpanded,
  isSidebarExpanded,
  onToggle,
  compareProjectId,
  setCompareProjectId,
  compareVersionId,
  setCompareVersionId,
  onClearCompare
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

  const versionBOptions = useMemo(() => versionsB.map((v) => ({
    value: String(v.id),
    label: `Version ${v.version_number}`,
  })), [versionsB]);

  return (
    <div className="compare-budget-widget">
      <SidebarWidgetAccordion
        title="Compare Budgets"
        icon="compare_arrows"
        isExpanded={isExpanded}
        isSidebarExpanded={isSidebarExpanded}
        onToggle={onToggle}
      >
        <p className="compare-widget-description">
          Select a project and version to compare against the currently active budget.
        </p>
        <div className="sidebar-dropdown-container">
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
        </div>

        <div className="sidebar-dropdown-container">
          <GlassDropdown
            placeholder={loadingVersions ? "Loading versions..." : "— Select Version B —"}
            options={versionBOptions}
            value={compareVersionId}
            onChange={setCompareVersionId}
            disabled={!compareProjectId || loadingVersions}
          />
        </div>

        {compareProjectId && compareVersionId && (
          <button
            type="button"
            className="sidebar-widget-btn sidebar-widget-btn-full sidebar-widget-btn-spaced theme-red"
            onClick={onClearCompare}
          >
            <span className="material-symbols-outlined">close</span>
            Exit Compare Mode
          </button>
        )}
      </SidebarWidgetAccordion>
    </div>
  );
};

// This is the new budget