import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Tag01Icon } from "@hugeicons/core-free-icons";
import "../../../components/common/Modal.css";
import GlassSurface from "../../../components/effects/GlassSurface";
import Icon from "../../../components/common/Icon";
import BranchedMenu from "../../../components/common/BranchedMenu";
import "./BudgetNavWidget.css";

/**
 * BudgetNavWidget - Floating glass navigation trigger stacked beneath the search trigger.
 * Opens an interactive BranchedMenu for jumping directly to budget departments and categories.
 */
const BudgetNavWidget = ({
  hierarchy = [],
  versionId = "",
  navOpen,
  setNavOpen,
  onNavigate,
}) => {
  const widgetRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const isPointerInsideRef = useRef(false);
  // Prevent immediate hover re-open when closing with the cursor still over the widget footprint
  const manuallyClosedRef = useRef(false);

  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearHoverTimeout, [clearHoverTimeout]);

  const handleExplicitClose = useCallback(() => {
    clearHoverTimeout();
    manuallyClosedRef.current = isPointerInsideRef.current;
    setNavOpen(false);
  }, [clearHoverTimeout, setNavOpen]);

  const menuItems = useMemo(() => {
    const sections = [];
    (hierarchy || []).forEach((phase) => {
      (phase.departments || []).forEach((dept, deptIdx) => {
        const prefix = String(deptIdx + 1).padStart(2, "0");
        const categories = (dept.categories || []).map((cat) => ({
          value: `cat:${cat.id}`,
          label: cat.category_name,
          icon: Tag01Icon,
          type: "category",
          phaseId: phase.phase_id,
          deptId: dept.id,
          catId: cat.id,
        }));

        sections.push({
          value: `dept:${dept.id}`,
          label: `${prefix} ${dept.department_name}`,
          type: "department",
          phaseId: phase.phase_id,
          deptId: dept.id,
          ...(categories.length > 0 ? { children: categories } : {}),
        });
      });
    });
    return sections;
  }, [hierarchy]);

  useEffect(() => {
    if (!navOpen) return undefined;

    const handlePointerDown = (e) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target)) {
        clearHoverTimeout();
        setNavOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleExplicitClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [clearHoverTimeout, handleExplicitClose, navOpen, setNavOpen]);

  const handleMouseEnter = () => {
    isPointerInsideRef.current = true;
    clearHoverTimeout();
    if (!manuallyClosedRef.current) {
      setNavOpen(true);
    }
  };

  const handleMouseLeave = () => {
    isPointerInsideRef.current = false;
    manuallyClosedRef.current = false;
    clearHoverTimeout();
    if (!navOpen) return;
    hoverTimeoutRef.current = setTimeout(() => {
      hoverTimeoutRef.current = null;
      setNavOpen(false);
    }, 300);
  };

  const handleTriggerClick = () => {
    clearHoverTimeout();
    manuallyClosedRef.current = false;
    setNavOpen(true);
  };

  const handleTriggerKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleTriggerClick();
    }
  };

  const handleSelect = (_value, item) => {
    if (!item || !onNavigate) return;
    if (item.type === "category") {
      onNavigate({
        phaseId: item.phaseId,
        deptId: item.deptId,
        elementId: `cat-section-${item.catId}`,
      });
      return;
    }

    onNavigate({
      phaseId: item.phaseId,
      deptId: item.deptId,
      elementId: `dept-section-${item.deptId}`,
    });
  };

  const handleToggle = (sectionIdx, isOpen) => {
    if (!isOpen || !onNavigate) return;
    const section = menuItems[sectionIdx];
    if (!section) return;
    onNavigate({
      phaseId: section.phaseId,
      deptId: section.deptId,
      elementId: `dept-section-${section.deptId}`,
    });
  };

  return (
    <div
      ref={widgetRef}
      className={`bef-nav-widget ${navOpen ? "expanded" : "collapsed"}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <GlassSurface
        className="bef-floating-trigger-btn bef-nav-trigger-btn"
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        role="button"
        tabIndex={navOpen ? -1 : 0}
        aria-label="Open budget navigation menu"
        aria-expanded={navOpen}
        title="Browse departments & categories"
        width={48}
        height={48}
        borderRadius={24}
        blur={10}
        opacity={0}
        backgroundOpacity={0}
      >
        <span className="material-symbols-outlined">account_tree</span>
      </GlassSurface>

      <div
        className="modal-glass-container bef-nav-container"
        role="dialog"
        aria-modal="false"
        aria-label="Budget sections navigation"
        aria-hidden={!navOpen}
      >
        <div className="bef-nav-header">
          <div className="bef-nav-title-group">
            <span className="material-symbols-outlined bef-nav-header-icon">
              account_tree
            </span>
            <span className="bef-nav-header-title">Budget Sections</span>
          </div>
          <button
            type="button"
            className="modal-close-btn bef-nav-close-btn"
            onClick={handleExplicitClose}
            aria-label="Close navigation menu"
            title="Close"
          >
            <Icon name="close" modifiers="md" />
          </button>
        </div>

        <div className="bef-nav-scroll">
          {menuItems.length > 0 ? (
            <BranchedMenu
              key={versionId || "budget-nav"}
              items={menuItems}
              defaultOpen={0}
              onSelect={handleSelect}
              onToggle={handleToggle}
              className="bef-branched-menu"
              width={280}
              rowHeight={34}
              indent={34}
              trunk={12}
              radius={9}
              fontSize={13}
            />
          ) : (
            <div className="bef-nav-empty">No departments available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BudgetNavWidget;

