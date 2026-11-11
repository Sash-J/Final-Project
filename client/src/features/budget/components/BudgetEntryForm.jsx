import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { budgetService } from "../../../services/budgetService";
import { projectService } from "../../../services/projectService";
import { useProjects } from "../../projects/context/ProjectContext";
import { useAuth } from "../../auth/context/AuthContext";
import { formatCurrency } from "../../../utils/currencyUtils";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import BreakdownModal from "../../../components/modals/BreakdownModal";
import Icon from "../../../components/common/Icon";
import NeoButton from "../../../components/common/NeoButton";
import "./BudgetEntryForm.css";

import {
  SkeletonRow,
  SkeletonTable,
} from "./BudgetEntrySkeleton";

import BudgetRow from "./BudgetRow";
import BudgetSearchWidget from "./BudgetSearchWidget";
import BudgetNavWidget from "./BudgetNavWidget";
import BudgetSubNav from "./BudgetSubNav";
import CrewAssignmentDropdown from "./CrewAssignmentDropdown";
import BudgetColGroup from "./BudgetColGroup";
import BudgetTableHeader from "./BudgetTableHeader";
import BudgetFormatEmpty from "./BudgetFormatEmpty";
import { useBudgetState } from "../hooks/useBudgetState";
import { useBudgetAssignments } from "../hooks/useBudgetAssignments";
import { useBudgetCalculations } from "../hooks/useBudgetCalculations";
import { useBudgetDragAndDrop } from "../hooks/useBudgetDragAndDrop";
import { exportBudgetToPDF, exportBudgetToExcel } from "../utils/ExportService";
import toast from "react-hot-toast";





const NOOP = () => {};

const BudgetEntryForm = ({
  embedded = false,
  externalProjectId = "",
  versionId = "",
  projectName = "",
  versionName = "",
  refreshKey = 0,
  onDirtyChange = NOOP,
  selectedCatId = "",
  selectedDeptId = "",
  onPublish = null,
  actionsContainer = null,
  onActionsReady = null,
  hideActionsFooter = false,
  comparisonData = null,
  isCompareLoading = false,
  onClearCompare = null,
  canEdit: canEditProp = undefined,
  hideUnused = false,
  hideMargin = false,
}) => {
  const { user, hasRole, hasPermission } = useAuth();
  const isManager = hasRole("manager");
  const isAdmin = hasRole("admin");
  const isClient = hasRole("client");
  const hasEditPermission = hasPermission("budget.edit");
  const canEdit = canEditProp !== undefined ? canEditProp : ((isManager || isAdmin || hasEditPermission) && !isClient);
  const shouldHideUnused = hideUnused || isClient;
  const hideGrossAndAdd = hideMargin || shouldHideUnused;

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
    canEdit,
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

  // Comparison helpers
  const getBudgetBItemTotal = (item) =>
    parseFloat(
      comparisonData?.budgetB?.[item.id]?.total ??
      comparisonData?.budgetB?.[String(item.id)]?.total
    ) || 0;
  const getBudgetBCatTotal = (cat) =>
    (cat.items || []).reduce((sum, item) => sum + getBudgetBItemTotal(item), 0);
  const getBudgetBDeptTotal = (dept) =>
    (dept.categories || []).reduce((sum, cat) => sum + getBudgetBCatTotal(cat), 0);
  const getBudgetBPhaseTotal = (phase) =>
    (phase.departments || []).reduce((sum, dept) => sum + getBudgetBDeptTotal(dept), 0);
  const getBudgetBGrandTotal = () =>
    (hierarchy || []).reduce((sum, phase) => sum + getBudgetBPhaseTotal(phase), 0);

  const getVarianceClass = (valA, valB) => {
    const diff = Number((valA - valB).toFixed(2));
    if (diff > 0.009) return "variance-negative"; // Overage in Current Budget compared to Baseline
    if (diff < -0.009) return "variance-positive"; // Savings in Current Budget compared to Baseline
    return "variance-neutral";
  };

  const formatVariance = (valA, valB) => {
    const diff = Number((valA - valB).toFixed(2));
    if (Math.abs(diff) < 0.01) return formatCurrency(0);
    const formatted = formatCurrency(Math.abs(diff));
    return diff > 0 ? `+${formatted}` : `-${formatted}`;
  };

  const displayHierarchy = useMemo(() => {
    if (!shouldHideUnused || !hierarchy || hierarchy.length === 0) {
      return hierarchy;
    }

    const getItemBTotal = (item) =>
      parseFloat(
        comparisonData?.budgetB?.[item.id]?.total ??
        comparisonData?.budgetB?.[String(item.id)]?.total
      ) || 0;
    const getCatBTotal = (cat) =>
      (cat.items || []).reduce((sum, item) => sum + getItemBTotal(item), 0);
    const getDeptBTotal = (dept) =>
      (dept.categories || []).reduce((sum, cat) => sum + getCatBTotal(cat), 0);
    const getPhaseBTotal = (phase) =>
      (phase.departments || []).reduce((sum, dept) => sum + getDeptBTotal(dept), 0);

    const isItemUsed = (item) => {
      const v = values[item.id];
      const q = v ? (parseFloat(v.qty) || 0) : 0;
      const r = v ? (parseFloat(v.rate) || 0) : 0;
      const a1 = v ? (parseFloat(v.add1) || 0) : 0;
      const tot = totalRaw ? totalRaw(item.id) : (v ? (parseFloat(v.total) || 0) : 0);
      const isItemized = v ? Boolean(v.is_itemized) : false;
      const hasComment = v ? Boolean(v.c1 && String(v.c1).trim().length > 0) : false;
      const compareBTotal = comparisonData ? getItemBTotal(item) : 0;
      return q > 0 || r > 0 || a1 > 0 || tot > 0 || isItemized || hasComment || compareBTotal > 0;
    };

    return hierarchy
      .map((phase) => {
        const filteredDepts = (phase.departments || [])
          .map((dept) => {
            const filteredCats = (dept.categories || [])
              .map((cat) => {
                const usedItems = (cat.items || []).filter(isItemUsed);
                const catSubtotal = getCategorySubtotal(cat);
                const catBTotal = comparisonData ? getCatBTotal(cat) : 0;
                if (usedItems.length === 0 && catSubtotal <= 0 && catBTotal <= 0) {
                  return null;
                }
                return {
                  ...cat,
                  items: usedItems,
                };
              })
              .filter(Boolean);

            const deptSubtotal = getDeptSubtotal(dept);
            const deptBTotal = comparisonData ? getDeptBTotal(dept) : 0;
            if (filteredCats.length === 0 && deptSubtotal <= 0 && deptBTotal <= 0) {
              return null;
            }
            return {
              ...dept,
              categories: filteredCats,
            };
          })
          .filter(Boolean);

        const phaseSubtotal = getPhaseSubtotal(phase);
        const phaseBTotal = comparisonData ? getPhaseBTotal(phase) : 0;
        if (filteredDepts.length === 0 && phaseSubtotal <= 0 && phaseBTotal <= 0) {
          return null;
        }
        return {
          ...phase,
          departments: filteredDepts,
        };
      })
      .filter(Boolean);
  }, [
    shouldHideUnused,
    hierarchy,
    values,
    totalRaw,
    getCategorySubtotal,
    getDeptSubtotal,
    getPhaseSubtotal,
    comparisonData,
  ]);

  const navScrollTimerRef = useRef(null);
  const navFlashTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (navScrollTimerRef.current) clearTimeout(navScrollTimerRef.current);
      if (navFlashTimerRef.current) clearTimeout(navFlashTimerRef.current);
    };
  }, []);

  // Shared navigator: expands phase/department if collapsed, scrolls row into view, and flashes it
  const navigateToTarget = useCallback(
    ({ phaseId = null, deptId = null, elementId }) => {
      if (phaseId != null) {
        setExpandedPhases((prev) => {
          if (prev.has(phaseId)) return prev;
          const next = new Set(prev);
          next.add(phaseId);
          return next;
        });
      }

      if (deptId != null) {
        setCollapsedDepts((prev) => {
          const numId = Number(deptId);
          if (!prev.has(deptId) && !prev.has(numId)) return prev;
          const next = new Set(prev);
          next.delete(deptId);
          next.delete(numId);
          return next;
        });
      }

      if (navScrollTimerRef.current) {
        clearTimeout(navScrollTimerRef.current);
      }

      navScrollTimerRef.current = setTimeout(() => {
        navScrollTimerRef.current = null;
        const element = document.getElementById(elementId);
        if (!element) return;

        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.remove("cyan-flash-highlight");
        void element.offsetWidth;
        element.classList.add("cyan-flash-highlight");

        if (navFlashTimerRef.current) {
          clearTimeout(navFlashTimerRef.current);
        }
        navFlashTimerRef.current = setTimeout(() => {
          element.classList.remove("cyan-flash-highlight");
          navFlashTimerRef.current = null;
        }, 2500);
      }, 120);
    },
    [setCollapsedDepts, setExpandedPhases]
  );

  useEffect(() => {
    if (!selectedCatId || !displayHierarchy.length) return;

    let foundPhaseId = null;
    let foundDeptId = null;
    for (const phase of displayHierarchy) {
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
      navigateToTarget({
        phaseId: foundPhaseId,
        deptId: foundDeptId,
        elementId: `cat-section-${selectedCatId}`,
      });
    }
  }, [selectedCatId, displayHierarchy, navigateToTarget]);

  useEffect(() => {
    if (!selectedDeptId || !displayHierarchy.length) return;

    let foundPhaseId = null;
    for (const phase of displayHierarchy) {
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
      navigateToTarget({
        phaseId: foundPhaseId,
        deptId: selectedDeptId,
        elementId: `dept-section-${selectedDeptId}`,
      });
    }
  }, [selectedDeptId, displayHierarchy, navigateToTarget]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  const handleSetSearchOpen = useCallback((open) => {
    setSearchOpen(open);
    if (open) setNavOpen(false);
  }, []);

  const handleSetNavOpen = useCallback((open) => {
    setNavOpen(open);
    if (open) setSearchOpen(false);
  }, []);

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

    const handleScroll = () => {
      if (!containerRef.current || !widgetRef.current) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const maxScrollLimit = document.documentElement.scrollHeight - window.innerHeight;
      const clampedScroll = Math.max(0, Math.min(scrollTop, maxScrollLimit));

      if (!isScrolling) {
        isScrolling = true;
        const rect = containerRef.current.getBoundingClientRect();
        containerDocTop = rect.top + scrollTop;
      }

      const clampedRectTop = containerDocTop - clampedScroll;
      
      // Target offset to keep the floating widgets 140px below the viewport top
      const targetOffset = 140 - clampedRectTop;
      
      const widgetHeight = navOpen ? 420 : searchOpen ? 240 : 140;
      const maxScroll = Math.max(0, containerRef.current.offsetHeight - widgetHeight);
      const clampedTranslateY = Math.max(0, Math.min(targetOffset, maxScroll));

      // Update position with a smooth CSS transition to create a gliding 'trailing' effect
      widgetRef.current.style.transition = "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
      widgetRef.current.style.transform = `translateY(${clampedTranslateY}px)`;
      translateYRef.current = clampedTranslateY;

      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        // Sync state once scrolling stops completely
        setTranslateY(translateYRef.current);
      }, 150);
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
      const widgetHeight = navOpen ? 420 : searchOpen ? 240 : 140;
      const maxScroll = Math.max(0, containerRef.current.offsetHeight - widgetHeight);
      const offset = Math.min(
        Math.max(0, targetOffset),
        maxScroll
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
  }, [searchOpen, navOpen]);

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

    displayHierarchy.forEach((phase) => {
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
  }, [searchQuery, displayHierarchy]);

  const goToMatch = (idx) => {
    if (searchResults.length === 0 || idx < 0 || idx >= searchResults.length) return;

    const match = searchResults[idx];
    navigateToTarget({
      phaseId: match.phaseId,
      deptId: match.deptId,
      elementId: `budget-row-${match.itemId}`,
    });
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
      await budgetService.saveBudgetBreakdown({
        project_id: parseInt(externalProjectId),
        version_id: parseInt(versionId),
        item_id: parseInt(itemId),
        breakdown_items: [],
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

    budgetService.saveBudgetBreakdown({
      project_id: parseInt(externalProjectId),
      version_id: parseInt(versionId),
      item_id: parseInt(itemId),
      breakdown_items: cleanedItems,
    })
      .then(() => {
        // Invalidate cache - help from OpenAI
        invalidateCache(externalProjectId);
      })
      .catch((err) => console.error("Failed to save breakdown:", err));
  };

  const { onDragEnd } = useBudgetDragAndDrop(hierarchy, setHierarchy, invalidateHierarchyCache);

  const handleSubmit = async () => {
    if (!externalProjectId) {
      toast.error("Please select a project first.");
      return;
    }
    if (!versionId) {
      toast.error("Please select a budget version before proceeding.");
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
      toast.error("No values entered. Fill in at least one row.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await budgetService.updateBudgetValuesBatch({
        project_id: parseInt(externalProjectId),
        version_id: parseInt(versionId),
        values: payload,
      });
      if (data && data.error) throw new Error(data.error);

      // Save crew assignments
      const deptPromises = Object.entries(deptAssignments).map(([deptId, crewList]) => {
        const userIds = crewList.map(c => c.id);
        return projectService.assignCrewToDepartment(externalProjectId, deptId, userIds);
      });
      const catPromises = Object.entries(categoryAssignments).map(([catId, crewList]) => {
        const userIds = crewList.map(c => c.id);
        return projectService.assignCrewToCategory(externalProjectId, catId, userIds);
      });
      const itemPromises = Object.entries(budgetItemAssignments).map(([itemId, crewList]) => {
        const userIds = crewList.map(c => c.id);
        return projectService.assignCrewToBudgetItem(externalProjectId, itemId, userIds);
      });
      await Promise.all([...deptPromises, ...catPromises, ...itemPromises]);

      invalidateCache(externalProjectId);

      initialDataRef.current = {
        values: JSON.stringify(values),
        breakdowns: JSON.stringify(breakdownData),
      };
      onDirtyChange(false);

      toast.success(`${data.message} saved successfully.`);
    } catch (err) {
      toast.error(`${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportTopSheet = () => {
    exportBudgetToPDF(displayHierarchy, values, projectName, versionName, "topsheet");
  };

  const handleExportDetailPDF = () => {
    exportBudgetToPDF(displayHierarchy, values, projectName, versionName, "detail");
  };

  const handleExportDetailExcel = () => {
    exportBudgetToExcel(displayHierarchy, values, projectName);
  };

  const handleClear = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClear = () => {
    setValues({});
    setShowClearConfirm(false);
  };

  const handleCancelClear = () => {
    setShowClearConfirm(false);
  };

  const actionsRef = useRef({});
  actionsRef.current = {
    exportTopSheet: handleExportTopSheet,
    exportDetailPDF: handleExportDetailPDF,
    exportDetailExcel: handleExportDetailExcel,
    clearAll: handleClear,
    submitAll: handleSubmit,
  };

  useEffect(() => {
    if (onActionsReady) {
      onActionsReady({
        exportTopSheet: () => actionsRef.current.exportTopSheet?.(),
        exportDetailPDF: () => actionsRef.current.exportDetailPDF?.(),
        exportDetailExcel: () => actionsRef.current.exportDetailExcel?.(),
        clearAll: () => actionsRef.current.clearAll?.(),
        submitAll: () => actionsRef.current.submitAll?.(),
        submitting,
        isReady: Boolean(!loading && externalProjectId && versionId && hierarchy.length > 0),
      });
    }
  }, [
    onActionsReady,
    submitting,
    loading,
    externalProjectId,
    versionId,
    hierarchy.length,
  ]);

  const showVersionWarning = externalProjectId && !versionId;
  const isReadOnly = showVersionWarning || (!!versionId && !canEdit);
  const canDrag = isAdmin && !isReadOnly;
  const showDrag = canDrag && !comparisonData;
  const headerColSpan = hideGrossAndAdd ? 4 : 6;
  const spacerColSpan = (showDrag ? 1 : 0) + headerColSpan + 1 + (comparisonData ? 2 : 0);

  return (
    <div className="bef-root" onClick={() => setActiveComment(null)}>
      {/* Floating Search & Branched Menu Navigation Stack */}
      {externalProjectId && versionId && displayHierarchy.length > 0 && (
        <div
          ref={widgetRef}
          className="bef-floating-widgets"
          style={{ transform: `translateY(${translateY}px)` }}
        >
          <BudgetSearchWidget
            searchOpen={searchOpen}
            setSearchOpen={handleSetSearchOpen}
            searchInputRef={searchInputRef}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleSearchKeyDown={handleSearchKeyDown}
            searchResults={searchResults}
            currentMatchIndex={currentMatchIndex}
            handleSearchPrev={handleSearchPrev}
            handleSearchNext={handleSearchNext}
          />
          <BudgetNavWidget
            hierarchy={displayHierarchy}
            versionId={versionId}
            navOpen={navOpen}
            setNavOpen={handleSetNavOpen}
            onNavigate={navigateToTarget}
          />
        </div>
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

        {!loading && externalProjectId && versionId && displayHierarchy.length === 0 && (
          <div className="bef-empty-version-state">
            <span className="material-symbols-outlined bef-empty-version-icon">inventory_2</span>
            <h3>No Published Budget Structure Found</h3>
            <p>This published version does not contain any budget phases or items.</p>
          </div>
        )}

        {!loading && externalProjectId && versionId && displayHierarchy.length > 0 && (
          <div
            id="admin-budget-pdf-content"
            className="fade-in-section bef-sheet-container"
          >
            {comparisonData && (
              <div className="budget-compare-banner">
                <div className="budget-compare-banner-info">
                  <div className="compare-banner-icon-bubble">
                    <Icon name="compare_arrows" modifiers="sm" />
                  </div>
                  <div className="compare-banner-text-wrap">
                    <div className="compare-banner-header">
                      <span className="compare-banner-title">Comparing Versions</span>
                      {isCompareLoading && <span className="compare-loading-pill">Updating...</span>}
                    </div>
                    <div className="compare-version-flow">
                      <div className="compare-version-block compare-block-baseline">
                        <span className="compare-version-label">Baseline</span>
                        <span className="compare-badge compare-badge-a">{comparisonData.versionNameA}</span>
                      </div>
                      <span className="compare-arrow-divider" aria-hidden="true">
                        <Icon name="arrow_forward" modifiers="xs" />
                      </span>
                      <div className="compare-version-block compare-block-target">
                        <span className="compare-version-label">Comparing</span>
                        <span className="compare-badge compare-badge-b">{comparisonData.versionNameB}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {onClearCompare && (
                  <NeoButton
                    type="button"
                    variant="cancel"
                    className="budget-compare-exit-btn"
                    onClick={onClearCompare}
                    icon="close"
                    title="Exit Version Comparison"
                  >
                    Exit Compare
                  </NeoButton>
                )}
              </div>
            )}

            <div className={`bef-sheet ${!canDrag ? "drag-disabled" : ""} ${comparisonData ? "is-compare-mode" : ""}`}>
              <DragDropContext onDragEnd={onDragEnd}>
                <table className="bef-table header-only-table">
                  <BudgetColGroup isCompareMode={!!comparisonData} hideGrossAndAdd={hideGrossAndAdd} canDrag={canDrag} />
                  <BudgetTableHeader isCompareMode={!!comparisonData} versionNameA={comparisonData?.versionNameA} versionNameB={comparisonData?.versionNameB} hideGrossAndAdd={hideGrossAndAdd} canDrag={canDrag} />
                </table>

                {displayHierarchy.map((phase) => {
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
                          {comparisonData ? (
                            <div className="phase-compare-totals">
                              <div className="phase-compare-cell">
                                <span className="phase-total-value">{formatCurrency(phaseTotal)}</span>
                              </div>
                              <div className="phase-compare-cell">
                                <span className="col-compare-total phase-total-value">{formatCurrency(getBudgetBPhaseTotal(phase))}</span>
                              </div>
                              <div className={`phase-compare-cell ${getVarianceClass(phaseTotal, getBudgetBPhaseTotal(phase))}`}>
                                <span className="phase-variance-value">
                                  {formatVariance(phaseTotal, getBudgetBPhaseTotal(phase))}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="phase-total-label">Subtotal: </span>
                              <span className="phase-total-value">
                                {formatCurrency(phaseTotal)}
                              </span>
                            </>
                          )}
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
                                        <BudgetColGroup isCompareMode={!!comparisonData} hideGrossAndAdd={hideGrossAndAdd} canDrag={canDrag} />
                                        <tbody className="bef-dept-body">
                                          <tr
                                            id={`dept-section-${dept.id}`}
                                            className="bef-dept-row"
                                          >
                                            {showDrag && (
                                              <td
                                                className="col-drag"
                                                {...providedDept.dragHandleProps}
                                              >
                                                <span className="material-symbols-outlined drag-handle-icon">
                                                  drag_indicator
                                                </span>
                                              </td>
                                            )}
                                            <td
                                              colSpan={headerColSpan}
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
                                                   {(!user || hasRole(["admin", "manager", "director"])) && (
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
                                            <td className="col-total dept-subtotal-val">
                                              {(() => {
                                                const totalA = getDeptSubtotal(dept);
                                                if (comparisonData) {
                                                  const totalB = getBudgetBDeptTotal(dept);
                                                  if (totalA === 0 && totalB === 0) return "—";
                                                  return formatCurrency(totalA);
                                                }
                                                return totalA > 0 ? formatCurrency(totalA) : "";
                                              })()}
                                            </td>
                                            {comparisonData && (
                                              <>
                                                <td className="col-compare-total dept-subtotal-val">
                                                  {(() => {
                                                    const totalA = getDeptSubtotal(dept);
                                                     const totalB = getBudgetBDeptTotal(dept);
                                                     if (totalA === 0 && totalB === 0) return "—";
                                                     return formatCurrency(totalB);
                                                  })()}
                                                </td>
                                                <td className={`col-compare-variance dept-subtotal-val ${getVarianceClass(getDeptSubtotal(dept), getBudgetBDeptTotal(dept))}`}>
                                                  {(() => {
                                                     const totalA = getDeptSubtotal(dept);
                                                     const totalB = getBudgetBDeptTotal(dept);
                                                     if (totalA === 0 && totalB === 0) return "—";
                                                     return formatVariance(totalA, totalB);
                                                   })()}
                                                </td>
                                              </>
                                            )}
                                          </tr>
                                        </tbody>
                                      </table>

                                      <Droppable
                                        droppableId={`dept-${dept.id}`}
                                        type="CATEGORY"
                                      >
                                        {(provided) => (
                                          <table
                                            className={`bef-table cat-list-table ${collapsedDepts.has(dept.id) ? "is-collapsed" : ""}`} ref={provided.innerRef} {...provided.droppableProps}
                                          >
                                            <BudgetColGroup isCompareMode={!!comparisonData} hideGrossAndAdd={hideGrossAndAdd} canDrag={canDrag} />
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
                                                          {showDrag && (
                                                            <td
                                                              className="col-drag"
                                                              {...providedCat.dragHandleProps}
                                                            >
                                                              <span className="material-symbols-outlined drag-handle-icon">
                                                                drag_indicator
                                                              </span>
                                                            </td>
                                                          )}
                                                          <td
                                                            colSpan={headerColSpan}
                                                            className="cat-name-cell"
                                                          >
                                                            <div className="cat-header-row">
                                                              <span className="cat-name">
                                                                {cat.category_name}
                                                              </span>
                                                              
                                                              {canEdit && !comparisonData && (
                                                                <div className="crew-assign-wrapper cat-crew-assign-wrapper">
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
                                                              )}

                                                            </div>
                                                          </td>
                                                          <td className="col-total cat-subtotal">
                                                            {(() => {
                                                              const subtotalA = getCategorySubtotal(cat);
                                                                if (comparisonData) {
                                                                  const subtotalB = getBudgetBCatTotal(cat);
                                                                  if (subtotalA === 0 && subtotalB === 0) return "—";
                                                                  return formatCurrency(subtotalA);
                                                                }
                                                                return subtotalA > 0 ? formatCurrency(subtotalA) : "";
                                                            })()}
                                                          </td>
                                                          {comparisonData && (
                                                            <>
                                                              <td className="col-compare-total cat-subtotal">
                                                                {(() => {
                                                                  const subtotalA = getCategorySubtotal(cat);
                                                                  const subtotalB = getBudgetBCatTotal(cat);
                                                                  if (subtotalA === 0 && subtotalB === 0) return "—";
                                                                  return formatCurrency(subtotalB);
                                                                })()}
                                                              </td>
                                                              <td className={`col-compare-variance cat-subtotal ${getVarianceClass(getCategorySubtotal(cat), getBudgetBCatTotal(cat))}`}>
                                                                {(() => {
                                                                  const subtotalA = getCategorySubtotal(cat);
                                                                  const subtotalB = getBudgetBCatTotal(cat);
                                                                  if (subtotalA === 0 && subtotalB === 0) return "—";
                                                                  return formatVariance(subtotalA, subtotalB);
                                                                })()}
                                                              </td>
                                                            </>
                                                          )}
                                                        </tr>

                                                        {loading &&
                                                        (!values ||
                                                          Object.keys(values).length ===
                                                            0) ? (
                                                          <>
                                                            <SkeletonRow hideGrossAndAdd={hideGrossAndAdd} canDrag={canDrag} isCompareMode={!!comparisonData} />
                                                            <SkeletonRow hideGrossAndAdd={hideGrossAndAdd} canDrag={canDrag} isCompareMode={!!comparisonData} />
                                                            <SkeletonRow hideGrossAndAdd={hideGrossAndAdd} canDrag={canDrag} isCompareMode={!!comparisonData} />
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
                                                                <BudgetRow comparisonData={comparisonData}
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
                                                                  isReadOnly={
                                                                    isReadOnly
                                                                  }
                                                                  canEdit={
                                                                    canEdit
                                                                  }
                                                                  grossDisplay={
                                                                    grossDisplay
                                                                  }
                                                                  totalDisplay={
                                                                    totalDisplay
                                                                  }
                                                                  totalRaw={
                                                                    totalRaw
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
                                                                  canDrag={canDrag}
                                                                  hideGrossAndAdd={hideGrossAndAdd}
                                                                />
                                                              );
                                                            },
                                                          )
                                                        )}
                                                        {providedItem.placeholder}
                                                        <tr className="bef-cat-spacer-row">
                                                          <td colSpan={spacerColSpan}></td>
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
                {comparisonData ? (
                  <div className="grand-total-compare-row">
                    <div className="grand-total-col">
                      <span className="grand-total-label">Grand Total: </span>
                      <strong className="grand-total-value">{formatCurrency(grandTotal)}</strong>
                    </div>
                    <div className="grand-total-col">
                      <span className="grand-total-label">{comparisonData.versionNameB}: </span>
                      <strong className="col-compare-total grand-total-value">{formatCurrency(getBudgetBGrandTotal())}</strong>
                    </div>
                    <div className="grand-total-col">
                      <span className="grand-total-label">Variance: </span>
                      <strong className={`grand-total-value ${getVarianceClass(grandTotal, getBudgetBGrandTotal())}`}>
                        {formatVariance(grandTotal, getBudgetBGrandTotal())}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <>
                    Grand Total:&nbsp;
                    <strong>{formatCurrency(grandTotal)}</strong>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && externalProjectId && versionId && hierarchy.length > 0 && !hideActionsFooter && (() => {
          const content = (
              <div className={actionsContainer ? "" : "bef-footer bef-actions-only-footer"}>
                <BudgetSubNav 
                  onExportTopSheet={handleExportTopSheet}
                  onExportDetailPDF={handleExportDetailPDF}
                  onExportDetailExcel={handleExportDetailExcel}
                  onPublish={onPublish}
                  versionId={versionId}
                  handleClear={handleClear}
                  submitting={submitting}
                  handleSubmit={handleSubmit}
                  externalProjectId={externalProjectId}
                  canEdit={canEdit}
                />
              </div>
          );

          return actionsContainer 
            ? createPortal(content, actionsContainer)
            : content;
        })()}

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
          isReadOnly={isReadOnly}
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
