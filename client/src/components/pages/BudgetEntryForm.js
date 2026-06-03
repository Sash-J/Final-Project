import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import html2pdf from "html2pdf.js";
import { useEffect, useRef, useState } from "react";
import { API } from "../../config";
import { useProjects } from "../../contexts/ProjectContext";
import { useAuth } from "../../contexts/AuthContext";
import { formatCurrency } from "../../utils/currencyUtils";
import ConfirmationModal from "../common/ConfirmationModal";
import BreakdownModal from "../modals/BreakdownModal";
import "./BudgetEntryForm.css";

import {
  SkeletonRow,
  SkeletonTable,
} from "./BudgetEntrySkeleton";

import BudgetRow from "./BudgetEntry/components/BudgetRow";
import BudgetSearchWidget from "./BudgetEntry/components/BudgetSearchWidget";
import BudgetSubNav from "./BudgetEntry/components/BudgetSubNav";
import CrewAssignmentDropdown from "./BudgetEntry/components/CrewAssignmentDropdown";
import BudgetColGroup from "./BudgetEntry/components/BudgetColGroup";
import BudgetTableHeader from "./BudgetEntry/components/BudgetTableHeader";
import BudgetFormatEmpty from "./BudgetEntry/components/BudgetFormatEmpty";
import { useBudgetState } from "./BudgetEntry/hooks/useBudgetState";
import { useBudgetAssignments } from "./BudgetEntry/hooks/useBudgetAssignments";
import { useBudgetCalculations } from "./BudgetEntry/hooks/useBudgetCalculations";
import { useBudgetDragAndDrop } from "./BudgetEntry/hooks/useBudgetDragAndDrop";





const BudgetEntryForm = ({
  embedded = false,
  externalProjectId = "",
  versionId = "",
  projectName = "",
  versionName = "",
  refreshKey = 0,
  onDirtyChange = () => {},
  selectedCatId = "",
  selectedDeptId = "",
  onPublish = null,
}) => {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const isAdmin = user?.role === "admin";
  const canEdit = isManager || isAdmin;

  const {
    getBudgetData,
    invalidateCache,
    invalidateHierarchyCache,
    hierarchyCache,
  } = useProjects();

  const {
    hierarchy, setHierarchy,
    expandedPhases, setExpandedPhases, togglePhase,
    collapsedDepts, setCollapsedDepts, toggleDept,
    values, setValues, getVal, handleChange,
    activeComment, setActiveComment,
    loading,
    submitting, setSubmitting,
    status, setStatus,
    breakdownData, setBreakdownData,
    activeBreakdownId, setActiveBreakdownId,
    activeBreakdownItem, setActiveBreakdownItem,
    showDisableConfirm, setShowDisableConfirm,
    showClearConfirm, setShowClearConfirm,
    pendingDisableId, setPendingDisableId,
    commentAnchorRect, setCommentAnchorRect,
    focusedInput, setFocusedInput,
    initialDataRef
  } = useBudgetState({
    externalProjectId,
    versionId,
    refreshKey,
    onDirtyChange,
    hierarchyCache,
    getBudgetData,
  });

  const {

    projectCrew,
    deptAssignments,
    categoryAssignments,
    budgetItemAssignments,
    activeAssignDeptId,
    setActiveAssignDeptId,
    activeAssignCatId,
    setActiveAssignCatId,
    activeAssignItemId,
    setActiveAssignItemId,
    isCrewEditing,
    setIsCrewEditing,
    handleAssignCrew,
    handleAssignCategoryCrew,
    handleAssignBudgetItemCrew,
  } = useBudgetAssignments(externalProjectId, onDirtyChange);

  useEffect(() => {
    if (!selectedCatId || !hierarchy.length) return;

    let foundPhaseId = null;
    let foundDeptId = null;
    for (const phase of hierarchy) {
      if (phase.departments) {
        for (const dept of phase.departments) {
          if (dept.categories) {
            const hasCat = dept.categories.some(
              (cat) => String(cat.id) === String(selectedCatId)
            );
            if (hasCat) {
              foundPhaseId = phase.phase_id;
              foundDeptId = dept.id;
              break;
            }
          }
        }
      }
      if (foundPhaseId) break;
    }

    if (foundPhaseId) {
      setExpandedPhases((prev) => {
        if (prev.has(foundPhaseId)) return prev;
        const next = new Set(prev);
        next.add(foundPhaseId);
        return next;
      });

      if (foundDeptId) {
        setCollapsedDepts((prev) => {
          if (!prev.has(foundDeptId)) return prev;
          const next = new Set(prev);
          next.delete(foundDeptId);
          return next;
        });
      }

      const timer = setTimeout(() => {
        const element = document.getElementById(`cat-section-${selectedCatId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("highlight-row-glow");
          const removeTimer = setTimeout(() => {
            element.classList.remove("highlight-row-glow");
          }, 3000);
          return () => clearTimeout(removeTimer);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedCatId, hierarchy, setCollapsedDepts, setExpandedPhases]);

  useEffect(() => {
    if (!selectedDeptId || !hierarchy.length) return;

    let foundPhaseId = null;
    for (const phase of hierarchy) {
      if (phase.departments) {
        const hasDept = phase.departments.some(
          (dept) => String(dept.id) === String(selectedDeptId)
        );
        if (hasDept) {
          foundPhaseId = phase.phase_id;
          break;
        }
      }
      if (foundPhaseId) break;
    }

    if (foundPhaseId) {
      setExpandedPhases((prev) => {
        if (prev.has(foundPhaseId)) return prev;
        const next = new Set(prev);
        next.add(foundPhaseId);
        return next;
      });

      setCollapsedDepts((prev) => {
        const dId = Number(selectedDeptId);
        if (!prev.has(dId)) return prev;
        const next = new Set(prev);
        next.delete(dId);
        return next;
      });

      const timer = setTimeout(() => {
        const element = document.getElementById(`dept-section-${selectedDeptId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("highlight-row-glow");
          const removeTimer = setTimeout(() => {
            element.classList.remove("highlight-row-glow");
          }, 3000);
          return () => clearTimeout(removeTimer);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedDeptId, hierarchy, setCollapsedDepts, setExpandedPhases]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  const searchInputRef = useRef(null);
  const [translateY, setTranslateY] = useState(0);
  const translateYRef = useRef(0);
  translateYRef.current = translateY;

  useEffect(() => {
    let scrollTimeout = null;
    let isScrolling = false;
    let containerDocTop = 0;
    let initialTranslateY = 0;

    const handleScroll = () => {
      if (!containerRef.current || !widgetRef.current) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const maxScrollLimit = document.documentElement.scrollHeight - window.innerHeight;
      const clampedScroll = Math.max(0, Math.min(scrollTop, maxScrollLimit));

      // Calculate layout coordinates once at the start of a scroll gesture
      // to completely prevent layout thrashing (forced reflows) during scroll ticks.
      if (!isScrolling) {
        isScrolling = true;
        const rect = containerRef.current.getBoundingClientRect();
        containerDocTop = rect.top + scrollTop;
        initialTranslateY = translateYRef.current;
      }

      const clampedRectTop = containerDocTop - clampedScroll;

      // Safe viewport boundary limits for the widget (navbar to viewport bottom)
      const topLimit = 140;
      const widgetHeight = searchOpen ? 240 : 80;
      const bottomLimit = window.innerHeight - widgetHeight - 40; // 40px safety padding

      // Calculate widget's viewport position based on its last settled absolute position
      const naturalViewportTop = initialTranslateY + clampedRectTop;

      let adjustedViewportTop = naturalViewportTop;
      const resistance = 0.15; // 85% resistance factor

      // Apply rubber-band dampening at boundaries so it slows down and never goes out of frame
      if (naturalViewportTop < topLimit) {
        const overshoot = topLimit - naturalViewportTop;
        adjustedViewportTop = topLimit - overshoot * resistance;
      } else if (naturalViewportTop > bottomLimit) {
        const overshoot = naturalViewportTop - bottomLimit;
        adjustedViewportTop = bottomLimit + overshoot * resistance;
      }

      // Convert back to container-relative coordinate and clamp to container height
      const requiredTranslateY = adjustedViewportTop - clampedRectTop;
      const maxScroll = containerRef.current.offsetHeight - widgetHeight;
      const clampedTranslateY = Math.max(0, Math.min(requiredTranslateY, maxScroll));

      // Disable transition for instantaneous feedback during scrolling
      widgetRef.current.style.transition = "none";
      widgetRef.current.style.transform = `translateY(${clampedTranslateY}px)`;

      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Settle smoothly after scrolling stops
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        
        if (containerRef.current && widgetRef.current) {
          const currentRect = containerRef.current.getBoundingClientRect();
          const currentScrollTop = window.scrollY || document.documentElement.scrollTop;
          const currentClampedScroll = Math.max(0, Math.min(currentScrollTop, maxScrollLimit));
          const currentContainerDocTop = currentRect.top + currentScrollTop;
          const finalClampedRectTop = currentContainerDocTop - currentClampedScroll;

          // Keep widget 140px from viewport top below navbar
          const targetOffset = 140 - finalClampedRectTop;
          const finalMaxScroll = containerRef.current.offsetHeight - widgetHeight;
          const finalOffset = Math.min(
            Math.max(0, targetOffset),
            Math.max(0, finalMaxScroll)
          );

          const distance = Math.abs(translateYRef.current - finalOffset);
          if (distance > 300) {
            widgetRef.current.style.transition = "none";
          } else {
            widgetRef.current.style.transition = "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)";
          }
          void widgetRef.current.offsetHeight; // force reflow
          widgetRef.current.style.transform = `translateY(${finalOffset}px)`;
          setTranslateY(finalOffset);
        }
      }, 150); // 150ms Stop-scroll detection
    };

    window.addEventListener("scroll", handleScroll, true);

    // Initial position set immediately (without debounce)
    if (containerRef.current) {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const maxScrollLimit = document.documentElement.scrollHeight - window.innerHeight;
      const clampedScroll = Math.max(0, Math.min(scrollTop, maxScrollLimit));

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerDocTop = containerRect.top + scrollTop;
      const clampedRectTop = containerDocTop - clampedScroll;

      const targetOffset = 140 - clampedRectTop;
      const maxScroll = containerRef.current.offsetHeight - (searchOpen ? 240 : 80);
      const offset = Math.min(
        Math.max(0, targetOffset),
        Math.max(0, maxScroll)
      );
      setTranslateY(offset);
      if (widgetRef.current) {
        widgetRef.current.style.transition = "none";
        widgetRef.current.style.transform = `translateY(${offset}px)`;
      }
    }

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [searchOpen]);

  // Focus the search input when the widget is expanded
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    }
  }, [searchOpen]);

  // Search items in hierarchy
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const results = [];

    hierarchy.forEach((phase) => {
      if (phase.departments) {
        phase.departments.forEach((dept) => {
          if (dept.categories) {
            dept.categories.forEach((cat) => {
              if (cat.items) {
                cat.items.forEach((item) => {
                  if (item.item_name.toLowerCase().includes(query)) {
                    results.push({
                      itemId: item.id,
                      phaseId: phase.phase_id,
                      deptId: dept.id,
                      itemName: item.item_name,
                    });
                  }
                });
              }
            });
          }
        });
      }
    });

    setSearchResults(results);
    setCurrentMatchIndex(results.length > 0 ? 0 : -1);
  }, [searchQuery, hierarchy]);

  const goToMatch = (idx) => {
    if (searchResults.length === 0 || idx < 0 || idx >= searchResults.length) return;

    const match = searchResults[idx];
    
    // Expand the phase if it is collapsed
    if (!expandedPhases.has(match.phaseId)) {
      setExpandedPhases((prev) => {
        const next = new Set(prev);
        next.add(match.phaseId);
        return next;
      });
    }

    // Expand the department if it is collapsed
    if (collapsedDepts.has(match.deptId)) {
      setCollapsedDepts((prev) => {
        const next = new Set(prev);
        next.delete(match.deptId);
        return next;
      });
    }

    // Wait for rendering to complete, locate DOM row, scroll and flash it cyan
    setTimeout(() => {
      const element = document.getElementById(`budget-row-${match.itemId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        
        // Remove previous highlight class if any
        element.classList.remove("cyan-flash-highlight");
        
        // Trigger reflow to restart CSS animation
        void element.offsetWidth;
        
        // Add highlight class
        element.classList.add("cyan-flash-highlight");
        
        // Clean up class after animation ends
        setTimeout(() => {
          element.classList.remove("cyan-flash-highlight");
        }, 2000);
      }
    }, 100);
  };

  const handleSearchNext = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchResults.length;
    setCurrentMatchIndex(nextIdx);
    goToMatch(nextIdx);
  };

  const handleSearchPrev = () => {
    if (searchResults.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentMatchIndex(prevIdx);
    goToMatch(prevIdx);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearchNext();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSearchQuery("");
      setSearchOpen(false);
    }
  };


  const handleToggleItemize = async (itemId, itemName) => {
    if (showVersionWarning) return;

    const currentIsItemized = values[itemId]?.is_itemized || false;
    const nextIsItemized = !currentIsItemized;

    //Clear manual values
    if (nextIsItemized) {
      setValues((prev) => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] || {}),
          qty: "",
          rate: "",
          gross: "0",
          is_itemized: true,
        },
      }));

      //Open modal when toggled on
      setActiveBreakdownId(itemId);
      setActiveBreakdownItem(itemName);
    } else {
      setPendingDisableId(itemId);
      setShowDisableConfirm(true);
    }
  };

  const handleConfirmDisable = async () => {
    const itemId = pendingDisableId;
    if (!itemId) return;

    setShowDisableConfirm(false);
    setPendingDisableId(null);

    setValues((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        is_itemized: false,
        total: 0,
      },
    }));
    setBreakdownData((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

    try {
      await fetch(`${API}/api/budget-values/breakdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          project_id: parseInt(externalProjectId),
          version_id: parseInt(versionId),
          item_id: parseInt(itemId),
          breakdown_items: [],
        }),
      });
      // Invalidate cacheing - help from OpenAI
      invalidateCache(externalProjectId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelDisable = () => {
    setShowDisableConfirm(false);
    setPendingDisableId(null);
  };

  const handleBreakdownSave = (validItems, grandTotal) => {
    const itemId = activeBreakdownId;

    const cleanedItems = validItems.map((item) => ({
      ...item,
      quantity: parseFloat(item.quantity) || 0,
      rate_multiplier: parseFloat(item.rate_multiplier) || 1,
      rate: parseFloat(item.rate) || 0,
      additional1: parseFloat(item.additional1) || 0,
      gross_revenue: parseFloat(item.gross_revenue) || 0,
      total: parseFloat(item.total) || 0,
    }));

    setBreakdownData((prev) => ({
      ...prev,
      [itemId]: cleanedItems,
    }));

    setValues((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        total: grandTotal,
        is_itemized: true,
      },
    }));

    fetch(`${API}/api/budget-values/breakdown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: parseInt(externalProjectId),
        version_id: parseInt(versionId),
        item_id: parseInt(itemId),
        breakdown_items: cleanedItems,
      }),
    })
      .then(() => {
        // Invalidate cache - help from OpenAI
        invalidateCache(externalProjectId);
      })
      .catch((err) => console.error("Failed to save breakdown:", err));
  };

  const {
    calcGross,
    totalRaw,
    getCategorySubtotal,
    getDeptSubtotal,
    grossDisplay,
    totalDisplay,
    getPhaseSubtotal,
    grandTotal,
  } = useBudgetCalculations(values, hierarchy);

  const { onDragEnd } = useBudgetDragAndDrop(hierarchy, setHierarchy, invalidateHierarchyCache);

  const handleSubmit = async () => {
    if (!externalProjectId) {
      setStatus({ type: "error", text: "Please select a project first." });
      return;
    }
    if (!versionId) {
      setStatus({
        type: "error",
        text: "Please select a budget version before proceeding.",
      });
      return;
    }

    const initialValuesObj = initialDataRef.current
      ? JSON.parse(initialDataRef.current.values)
      : {};
    const prefilledIds = new Set(
      Object.keys(initialValuesObj).map((id) => parseInt(id)),
    );

    const payload = [];
    Object.entries(values).forEach(([itemId, v]) => {
      const itemIdNum = parseInt(itemId);
      const q = parseFloat(v.qty) || 0;
      const r = parseFloat(v.rate) || 0;
      const m = parseFloat(v.multiplier) || 1;
      const a1 = parseFloat(v.add1) || 0;
      const c1 = v.c1 || "";
      const isItemized = v.is_itemized ? 1 : 0;

      const hasInputs = q > 0 || r > 0 || a1 > 0 || c1;
      const isPrefilled = prefilledIds.has(itemIdNum);

      if (hasInputs || isItemized || isPrefilled) {
        payload.push({
          budget_item_id: itemIdNum,
          quantity: q,
          rate: r,
          rate_type: v.rate_type || "day",
          rate_multiplier: m,
          additional1: a1,
          comment1: c1,
          gross_revenue: calcGross(v),
          total: totalRaw(itemIdNum),
          is_itemized: isItemized,
        });
      }
    });

    if (!payload.length) {
      setStatus({
        type: "error",
        text: "No values entered. Fill in at least one row.",
      });
      return;
    }
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch(`${API}/api/budget-values/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          project_id: parseInt(externalProjectId),
          version_id: parseInt(versionId),
          values: payload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      // Save crew assignments
      const deptPromises = Object.entries(deptAssignments).map(([deptId, crewList]) => {
        const userIds = crewList.map(c => c.id);
        return fetch(`${API}/api/projects/${externalProjectId}/departments/${deptId}/assign-crew`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ user_ids: userIds }),
        });
      });
      const catPromises = Object.entries(categoryAssignments).map(([catId, crewList]) => {
        const userIds = crewList.map(c => c.id);
        return fetch(`${API}/api/projects/${externalProjectId}/categories/${catId}/assign-crew`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ user_ids: userIds }),
        });
      });
      const itemPromises = Object.entries(budgetItemAssignments).map(([itemId, crewList]) => {
        const userIds = crewList.map(c => c.id);
        return fetch(`${API}/api/projects/${externalProjectId}/budget-items/${itemId}/assign-crew`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ user_ids: userIds }),
        });
      });
      await Promise.all([...deptPromises, ...catPromises, ...itemPromises]);

      invalidateCache(externalProjectId);

      initialDataRef.current = {
        values: JSON.stringify(values),
        breakdowns: JSON.stringify(breakdownData),
      };
      onDirtyChange(false);

      setStatus({
        type: "success",
        text: `${data.message} saved successfully.`,
      });
    } catch (err) {
      setStatus({ type: "error", text: `${err.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById("admin-budget-pdf-content");
    if (!element) return;
    const dateStr = new Date().toISOString().split("T")[0];
    const pName = projectName ? projectName.replace(/\s+/g, "_") : "Project";
    const vName = versionName ? versionName : "Draft";
    const filename = `${pName}_Version_${vName}_${dateStr}.pdf`;

    const opt = {
      margin: 10,
      filename: filename,
      image: { type: "jpeg", quality: 2 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        backgroundColor: "#0d0e15ff",
        windowWidth: 1200,
      },
      jsPDF: { unit: "mm", format: "a3", orientation: "portrait" },
    };
    html2pdf().set(opt).from(element).save();
  };

  const handleClear = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClear = () => {
    setValues({});
    setStatus(null);
    setShowClearConfirm(false);
  };

  const handleCancelClear = () => {
    setShowClearConfirm(false);
  };

  const showVersionWarning = externalProjectId && !versionId;
  const isReadOnly = showVersionWarning || (!!versionId && !canEdit);
  const canDrag = isAdmin && !isReadOnly;

  return (
    <div className="bef-root" onClick={() => setActiveComment(null)}>
      {/* Floating Collapsible Search Widget */}
      {externalProjectId && versionId && hierarchy.length > 0 && (
        <BudgetSearchWidget 
          widgetRef={widgetRef}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          translateY={translateY}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          handleSearchKeyDown={handleSearchKeyDown}
          searchResults={searchResults}
          currentMatchIndex={currentMatchIndex}
          handleSearchPrev={handleSearchPrev}
          handleSearchNext={handleSearchNext}
        />
      )}

      <div className="bef-main-content" ref={containerRef}>
        {!embedded && (
          <div className="bef-header">
            <h2>Budget Entry</h2>
            <p>
              Fill in quantities, rates, and additional costs relative to the
              selected project.
            </p>
          </div>
        )}

        {/* Show active skeleton only when truly loading a version */}
        {loading && <SkeletonTable />}
        {!loading && (!externalProjectId || !versionId) && (
          <BudgetFormatEmpty />
        )}

        {!loading && externalProjectId && versionId && hierarchy.length > 0 && (
          <div
            id="admin-budget-pdf-content"
            className="fade-in-section"
            style={{
              padding: "20px",
              backgroundColor: "#0d0e15",
              borderRadius: "12px",
            }}
          >
            <div className={`bef-sheet ${!canDrag ? "drag-disabled" : ""}`}>
              <DragDropContext onDragEnd={onDragEnd}>
                <table className="bef-table header-only-table">
                  <BudgetColGroup />
                  <BudgetTableHeader />
                </table>

                {hierarchy.map((phase) => {
                  const isExpanded = expandedPhases.has(phase.phase_id);
                  const phaseTotal = getPhaseSubtotal(phase);

                  return (
                    <div
                      key={phase.phase_id}
                      className={`phase-section ${isExpanded ? "expanded" : "collapsed"}`}
                    >
                      <div
                        className="phase-header"
                        onClick={() => togglePhase(phase.phase_id)}
                      >
                        <div className="phase-header-left">
                          <h3>{phase.phase_name}</h3>
                        </div>
                        <div className="phase-header-right">
                          <span className="phase-total-label">Subtotal: </span>
                          <span className="phase-total-value">
                            {formatCurrency(phaseTotal)}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <Droppable
                          droppableId={`phase-${phase.phase_id}`}
                          type="DEPARTMENT"
                        >
                          {(providedDeptList) => (
                            <div
                              className="phase-content"
                              ref={providedDeptList.innerRef}
                              {...providedDeptList.droppableProps}
                            >
                              {phase.departments.map((dept, deptIdx) => (
                                <Draggable
                                  key={dept.id}
                                  draggableId={`dept-${dept.id}`}
                                  index={deptIdx}
                                  isDragDisabled={!canDrag}
                                >
                                  {(providedDept, snapshotDept) => (
                                    <div
                                      ref={providedDept.innerRef}
                                      {...providedDept.draggableProps}
                                      className={`dept-section ${snapshotDept.isDragging ? "dragging-dept" : ""}`}
                                    >
                                      <table className="bef-table dept-header-table">
                                        <BudgetColGroup />
                                        <tbody className="bef-dept-body">
                                          <tr
                                            id={`dept-section-${dept.id}`}
                                            className="bef-dept-row"
                                          >
                                            <td
                                              className="col-drag"
                                              {...providedDept.dragHandleProps}
                                            >
                                              <span className="material-symbols-outlined drag-handle-icon">
                                                drag_indicator
                                              </span>
                                            </td>
                                            <td
                                              colSpan="6"
                                              onClick={() => toggleDept(dept.id)}
                                              className="dept-header-cell"
                                            >
                                              <div className="dept-header-content">
                                                <div className="dept-title-wrapper">
                                                  <span className="dept-id">
                                                    {String(deptIdx + 1).padStart(2, "0")}
                                                  </span>
                                                  <span className="dept-name">
                                                    {dept.department_name}
                                                  </span>
                                                </div>
                                                <div 
                                                  className="dept-crew-container"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  {(!user || user.role === "admin" || user.role === "manager") && (
                                                      <CrewAssignmentDropdown
                                                        assignedCrew={deptAssignments[dept.id] || []}
                                                        projectCrew={projectCrew}
                                                        isActive={activeAssignDeptId === dept.id}
                                                        onToggle={() => setActiveAssignDeptId(activeAssignDeptId === dept.id ? null : dept.id)}
                                                        onAssign={(crewId) => handleAssignCrew(dept.id, crewId)}
                                                        isCrewEditing={isCrewEditing}
                                                        setIsCrewEditing={setIsCrewEditing}
                                                        badgeSize={20}
                                                      />)}
                                                </div>
                                              </div>
                                            </td>
                                            <td className="col-total dept-subtotal-val" style={{ fontWeight: "700", color: "var(--accent-color)", textAlign: "right", paddingRight: "24px" }}>
                                              {(() => {
                                                const total = getDeptSubtotal(dept);
                                                return total > 0 ? formatCurrency(total) : "";
                                              })()}
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>

                                      <Droppable
                                        droppableId={`dept-${dept.id}`}
                                        type="CATEGORY"
                                      >
                                        {(provided) => (
                                          <table
                                            className="bef-table cat-list-table"
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            style={{
                                              display: collapsedDepts.has(dept.id) ? "none" : "table"
                                            }}
                                          >
                                            <BudgetColGroup />
                                            {dept.categories.map((cat, catIdx) => (
                                              <Draggable
                                                key={cat.id}
                                                draggableId={`cat-${cat.id}`}
                                                index={catIdx}
                                                isDragDisabled={!canDrag}
                                              >
                                                {(providedCat, snapshotCat) => (
                                                  <Droppable
                                                    droppableId={`cat-${cat.id}`}
                                                    type="ITEM"
                                                  >
                                                    {(providedItem) => (
                                                      <tbody
                                                        className={`bef-cat-body ${snapshotCat.isDragging ? "dragging-cat" : ""}`}
                                                        ref={(el) => {
                                                          providedCat.innerRef(el);
                                                          providedItem.innerRef(el);
                                                        }}
                                                        {...providedCat.draggableProps}
                                                        {...providedItem.droppableProps}
                                                      >
                                                        <tr id={`cat-section-${cat.id}`} className="bef-cat-row">
                                                          <td
                                                            className="col-drag"
                                                            {...providedCat.dragHandleProps}
                                                          >
                                                            <span className="material-symbols-outlined drag-handle-icon">
                                                              drag_indicator
                                                            </span>
                                                          </td>
                                                          <td
                                                            colSpan="6"
                                                            className="cat-name-cell"
                                                          >
                                                            <div className="cat-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                              <span className="cat-name">
                                                                {cat.category_name}
                                                              </span>
                                                              
                                                              <div className="crew-assign-wrapper" style={{ marginLeft: "10px", position: "relative" }}>
                                                                <CrewAssignmentDropdown
                                                                  assignedCrew={categoryAssignments[cat.id] || []}
                                                                  projectCrew={projectCrew}
                                                                  isActive={activeAssignCatId === cat.id}
                                                                  onToggle={() => setActiveAssignCatId(activeAssignCatId === cat.id ? null : cat.id)}
                                                                  onAssign={(crewId) => handleAssignCategoryCrew(cat.id, crewId)}
                                                                  isCrewEditing={isCrewEditing}
                                                                  setIsCrewEditing={setIsCrewEditing}
                                                                  badgeSize={18}
                                                                />
                                                              </div>

                                                            </div>
                                                          </td>
                                                          <td className="col-total cat-subtotal">
                                                            {(() => {
                                                              const subtotal =
                                                                getCategorySubtotal(
                                                                  cat,
                                                                );
                                                              return subtotal > 0
                                                                ? formatCurrency(
                                                                    subtotal,
                                                                  )
                                                                : "";
                                                            })()}
                                                          </td>
                                                        </tr>

                                                        {loading &&
                                                        (!values ||
                                                          Object.keys(values).length ===
                                                            0) ? (
                                                          <>
                                                            <SkeletonRow />
                                                            <SkeletonRow />
                                                            <SkeletonRow />
                                                          </>
                                                        ) : (
                                                          cat.items.map(
                                                            (item, index) => {
                                                              const v =
                                                                values[item.id] || {};
                                                              const isFilled =
                                                                (parseFloat(v.qty) ||
                                                                  0) > 0 ||
                                                                (parseFloat(v.rate) ||
                                                                  0) > 0 ||
                                                                (parseFloat(v.add1) ||
                                                                  0) > 0;

                                                              return (
                                                                <BudgetRow
                                                                  key={item.id}
                                                                  item={item}
                                                                  index={index}
                                                                  getVal={getVal}
                                                                  handleChange={
                                                                    handleChange
                                                                  }
                                                                  handleToggleItemize={
                                                                    handleToggleItemize
                                                                  }
                                                                  setActiveBreakdownId={
                                                                    setActiveBreakdownId
                                                                  }
                                                                  setActiveBreakdownItem={
                                                                    setActiveBreakdownItem
                                                                  }
                                                                  commentAnchorRect={
                                                                    commentAnchorRect
                                                                  }
                                                                  setCommentAnchorRect={
                                                                    setCommentAnchorRect
                                                                  }
                                                                  activeComment={
                                                                    activeComment
                                                                  }
                                                                  setActiveComment={
                                                                    setActiveComment
                                                                  }
                                                                  showVersionWarning={
                                                                    isReadOnly
                                                                  }
                                                                  grossDisplay={
                                                                    grossDisplay
                                                                  }
                                                                  totalDisplay={
                                                                    totalDisplay
                                                                  }
                                                                  isFilled={isFilled}
                                                                  focusedInput={
                                                                    focusedInput
                                                                  }
                                                                  setFocusedInput={
                                                                    setFocusedInput
                                                                  }
                                                                  isDragDisabled={!canDrag}
                                                                  projectCrew={projectCrew}
                                                                  budgetItemAssignments={budgetItemAssignments}
                                                                  activeAssignItemId={activeAssignItemId}
                                                                  setActiveAssignItemId={setActiveAssignItemId}
                                                                  isCrewEditing={isCrewEditing}
                                                                  setIsCrewEditing={setIsCrewEditing}
                                                                  handleAssignBudgetItemCrew={handleAssignBudgetItemCrew}
                                                                />
                                                              );
                                                            },
                                                          )
                                                        )}
                                                        {providedItem.placeholder}
                                                        <tr className="bef-cat-spacer-row">
                                                          <td colSpan="8"></td>
                                                        </tr>
                                                      </tbody>
                                                    )}
                                                  </Droppable>
                                                )}
                                              </Draggable>
                                            ))}
                                            {provided.placeholder}
                                          </table>
                                        )}
                                      </Droppable>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {providedDeptList.placeholder}
                            </div>
                          )}
                        </Droppable>
                      )}
                    </div>
                  );
                })}
              </DragDropContext>
            </div>
            <div className="bef-footer">
              <div className="bef-grand-total">
                Grand Total:&nbsp;
                <strong>{formatCurrency(grandTotal)}</strong>
              </div>
            </div>
          </div>
        )}

        {!loading && hierarchy.length > 0 && (
          <div className="bef-footer bef-actions-only-footer">
            <BudgetSubNav 
              handleDownloadPDF={handleDownloadPDF}
              onPublish={onPublish}
              versionId={versionId}
              handleClear={handleClear}
              submitting={submitting}
              handleSubmit={handleSubmit}
              externalProjectId={externalProjectId}
            />
          </div>
        )}

        <div
          className="status-msg-container"
          style={{ minHeight: "40px", marginTop: "1rem" }}
        >
          {status && (
            <div className={`bef-status ${status.type}`}>{status.text}</div>
          )}
        </div>

        <BreakdownModal
          isOpen={!!activeBreakdownId}
          onClose={() => {
            setActiveBreakdownId(null);
            setActiveBreakdownItem(null);
          }}
          onSave={handleBreakdownSave}
          initialItems={
            activeBreakdownId ? breakdownData[activeBreakdownId] || [] : []
          }
          itemName={activeBreakdownItem}
          projectId={externalProjectId}
          versionId={versionId}
          itemId={activeBreakdownId}
        />

        <ConfirmationModal
          isOpen={showDisableConfirm}
          title="Disable Itemization"
          message="Are you sure you want to disable itemization? This will permanently clear the breakdown list and all sub-items entered for this budget row."
          onConfirm={handleConfirmDisable}
          onCancel={handleCancelDisable}
          confirmLabel="Yes, Clear Breakdown"
          cancelLabel="Wait, Keep it"
        />

        <ConfirmationModal
          isOpen={showClearConfirm}
          title="Clear Budget Form"
          message="Are you sure you want to clear all values from the budget form? This will reset all current unsaved edits on the screen."
          onConfirm={handleConfirmClear}
          onCancel={handleCancelClear}
          confirmLabel="Yes, Clear All"
          cancelLabel="Cancel"
          confirmVariant="danger"
        />
      </div>
    </div>
  );
};

export default BudgetEntryForm;
