import React, { useState, useEffect } from "react";
import GlassDropdown from "../../../components/common/GlassDropdown";
import HoverTooltip from "../../../components/common/HoverTooltip";
import { budgetService } from "../../../services/budgetService";

export const StatusMsg = ({ msg, setMsg }) => {
  useEffect(() => {
    if (!msg) return;
    const isError =
      msg.startsWith("Error") ||
      msg.startsWith("X") ||
      msg.startsWith("❌");
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
    msg.startsWith("❌");
  return <p key={msg} className={`status-msg ${isError ? "error" : "success"}`}>{msg}</p>;
};

export const WidgetOptionsMenu = ({ autoCenterEnabled, onToggleAutoCenter, isExpanded }) => {
  const [showMenu, setShowMenu] = useState(false);

  if (!isExpanded) return null;

  return (
    <div 
      className="widget-options-menu-trigger" 
      onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
    >
      <span className={`material-symbols-outlined widget-options-menu-btn ${showMenu ? 'active' : ''}`}>
        more_vert
      </span>
      {showMenu && (
        <>
          <div className="widget-options-menu-overlay" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
          <div className="widget-options-menu-dropdown" onClick={(e) => e.stopPropagation()}>
            <div className="auto-align-switch-container" style={{ margin: 0, justifyContent: 'space-between' }}>
              <span className="switch-label neo-label" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', marginRight: '16px' }}>Auto-center Viewport</span>
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

export const AddDepartment = ({ phases, onAdded, isExpanded, isSidebarExpanded, onToggle, autoCenterEnabled, onToggleAutoCenter }) => {
  const [name, setName] = useState("");
  const [phaseId, setPhaseId] = useState("2"); // Default to Production
  const [msg, setMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMsg("");
    try {
      const data = await budgetService.createDepartment({
        department_name: name,
        phase_id: parseInt(phaseId),
      });
      if (data && data.error) throw new Error(data.error);

      setMsg(`"${name}" added`);
      setName("");
      onAdded && onAdded();
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <HoverTooltip text={isSidebarExpanded ? "" : "Add Department"} wrapperClassName="w-100" style={{ display: 'flex' }}>
        <div className="sidebar-widget-header w-100" onClick={onToggle}>
          <div className="sidebar-widget-icon-wrapper">
            <span className="material-symbols-outlined icon-root">domain</span>
          </div>
          <h3 className="sidebar-widget-title">Add Department</h3>
          <WidgetOptionsMenu 
            autoCenterEnabled={autoCenterEnabled} 
            onToggleAutoCenter={onToggleAutoCenter} 
            isExpanded={isExpanded} 
          />
        </div>
      </HoverTooltip>

      <div className={`sidebar-widget-content ${isExpanded ? 'accordion-open' : ''}`}>
        <div className="sidebar-widget-content-inner">
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

          <div className="sidebar-dropdown-mb">
            <GlassDropdown
              placeholder="— Select Phase —"
              options={phases.map((p) => ({
                value: p.id,
                label: p.phase_name,
              }))}
              value={phaseId}
              onChange={(val) => setPhaseId(val)}
            />
          </div>

          <button type="submit" className="sidebar-widget-btn sidebar-widget-btn-full" disabled={isSubmitting}>
            <span className="material-symbols-outlined">add_circle</span>
            {isSubmitting ? "Adding..." : "Add Department"}
          </button>

          <div className="status-msg-container status-msg-container-styled">
            <StatusMsg msg={msg} setMsg={setMsg} />
          </div>
        </div>
      </div>
    </form>
  );
};

export const AddCategory = ({ departments, onAdded, onDeptSelect, isExpanded, isSidebarExpanded, onToggle, autoCenterEnabled, onToggleAutoCenter }) => {
  const [name, setName] = useState("");
  const [deptId, setDeptId] = useState("");
  const [msg, setMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMsg("");
    try {
      const data = await budgetService.createCategory({
        category_name: name,
        department_id: parseInt(deptId),
      });
      if (data && data.error) throw new Error(data.error);

      setMsg(`Category "${name}" added`);
      setName("");
      setDeptId("");
      onDeptSelect && onDeptSelect("");
      onAdded && onAdded();
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeptChange = (val) => {
    setDeptId(val);
    onDeptSelect && onDeptSelect(val);
  };

  return (
    <form onSubmit={handleSubmit}>
      <HoverTooltip text={isSidebarExpanded ? "" : "Add Category"} wrapperClassName="w-100" style={{ display: 'flex' }}>
        <div className="sidebar-widget-header w-100" onClick={onToggle} style={{ cursor: "pointer" }}>
          <div className="sidebar-widget-icon-wrapper theme-teal">
            <span className="material-symbols-outlined icon-root">category</span>
          </div>
          <h3 className="sidebar-widget-title">Add Category</h3>
          <WidgetOptionsMenu 
            autoCenterEnabled={autoCenterEnabled} 
            onToggleAutoCenter={onToggleAutoCenter} 
            isExpanded={isExpanded} 
          />
        </div>
      </HoverTooltip>

      <div className={`sidebar-widget-content ${isExpanded ? 'accordion-open' : ''}`}>
        <div className="sidebar-widget-content-inner">
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

          <div className="sidebar-dropdown-mb">
            <GlassDropdown
              placeholder="— Select Department —"
              options={departments.map((d) => ({
                value: d.id,
                label: d.department_name,
              }))}
              value={deptId}
              onChange={handleDeptChange}
            />
          </div>

          <button type="submit" className="sidebar-widget-btn sidebar-widget-btn-full theme-green" disabled={isSubmitting}>
            <span className="material-symbols-outlined">add_circle</span>
            {isSubmitting ? "Adding..." : "Add Category"}
          </button>

          <div className="status-msg-container status-msg-container-styled">
            <StatusMsg msg={msg} setMsg={setMsg} />
          </div>
        </div>
      </div>
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
  const [msg, setMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMsg("");
    try {
      const data = await budgetService.createBudgetItem({
        item_name: name,
        category_id: parseInt(catId),
      });
      if (data && data.error) throw new Error(data.error);

      setMsg(`Item "${name}" added`);
      setName("");
      setCatId("");
      onCategorySelect && onCategorySelect("");
      onAdded && onAdded();
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCatChange = (val) => {
    setCatId(val);
    onCategorySelect && onCategorySelect(val);
  };

  return (
    <form onSubmit={handleSubmit}>
      <HoverTooltip text={isSidebarExpanded ? "" : "Add Budget Item"} wrapperClassName="w-100" style={{ display: 'flex' }}>
        <div className="sidebar-widget-header w-100" onClick={onToggle} style={{ cursor: "pointer" }}>
          <div className="sidebar-widget-icon-wrapper theme-orange">
            <span className="material-symbols-outlined icon-root">inventory_2</span>
          </div>
          <h3 className="sidebar-widget-title">Add Budget Item</h3>
          <WidgetOptionsMenu 
            autoCenterEnabled={autoCenterEnabled} 
            onToggleAutoCenter={onToggleAutoCenter} 
            isExpanded={isExpanded} 
          />
        </div>
      </HoverTooltip>

      <div className={`sidebar-widget-content ${isExpanded ? 'accordion-open' : ''}`}>
        <div className="sidebar-widget-content-inner">
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

          <div className="sidebar-dropdown-mb">
            <GlassDropdown
              placeholder="— Select Category —"
              options={categories.map((c) => ({
                value: c.id,
                label: `${c.category_name} (${c.department_name})`,
              }))}
              value={catId}
              onChange={handleCatChange}
            />
          </div>

          <button type="submit" className="sidebar-widget-btn sidebar-widget-btn-full theme-orange sidebar-widget-btn-mb" disabled={isSubmitting}>
            <span className="material-symbols-outlined">add_circle</span>
            {isSubmitting ? "Adding..." : "Add Budget Item"}
          </button>

          <div className="auto-align-switch-container">
            <span className="switch-label neo-label auto-align-switch-label">Department Look-up</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={autoAlignEnabled}
                onChange={(e) => onToggleAutoAlign(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="status-msg-container status-msg-container-styled">
            <StatusMsg msg={msg} setMsg={setMsg} />
          </div>
        </div>
      </div>
    </form>
  );
};
