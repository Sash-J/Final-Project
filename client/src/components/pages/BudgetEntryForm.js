import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import "./BudgetEntryForm.css";
import html2pdf from "html2pdf.js";
import BreakdownModal from "../modals/BreakdownModal";
import ConfirmationModal from "../common/ConfirmationModal";
import Icon from "../common/Icon";
import { API } from "../../config";

// ── Shared Table Components ──────────────────────────────────────────────────
const BudgetColGroup = () => (
  <colgroup>
    <col style={{ width: "40px" }} />
    <col style={{ width: "30%" }} />
    <col style={{ width: "7%" }} />
    <col style={{ width: "14%" }} />
    <col style={{ width: "11%" }} />
    <col style={{ width: "11%" }} />
    <col style={{ width: "11%" }} />
    <col style={{ width: "16%" }} />
  </colgroup>
);

const BudgetTableHeader = () => (
  <thead>
    <tr>
      <th className="col-drag"></th>
      <th className="col-item-name">Item Name</th>
      <th className="col-units">Units</th>
      <th className="col-rate-type">Type</th>
      <th className="col-rate">Rate</th>
      <th className="col-gross">Gross (Rs.)</th>
      <th className="col-add">Additional</th>
      <th className="col-total">Total (Rs.)</th>
    </tr>
  </thead>
);

// ── Skeletal Loading Component ──────────────────────────────────────────────
const SkeletonTable = () => (
  <div className="bef-sheet skeleton-sheet">
    <table className="bef-table">
      <BudgetColGroup />
      <BudgetTableHeader />
    </table>

    {/* Mock Phase 1 */}
    <div className="skeleton-phase-header">
      <div
        className="skeleton-box"
        style={{ width: "150px", height: "18px" }}
      ></div>
    </div>
    <div className="skeleton-dept-header"></div>
    <table className="bef-table">
      <BudgetColGroup />
      <tbody>
        {[1, 2, 3].map((i) => (
          <tr key={i} className="skeleton-row">
            <td className="col-drag">
              <div
                className="skeleton-box"
                style={{ width: "16px", height: "16px", margin: "0 auto" }}
              ></div>
            </td>
            <td className="col-item-name">
              <div
                className="skeleton-box"
                style={{ width: "70%", height: "14px" }}
              ></div>
            </td>
            <td className="col-units">
              <div
                className="skeleton-box"
                style={{ width: "40px", height: "14px", marginLeft: "auto" }}
              ></div>
            </td>
            <td className="col-rate-type">
              <div
                className="skeleton-box"
                style={{ width: "65px", height: "22px", margin: "0 auto" }}
              ></div>
            </td>
            <td className="col-rate">
              <div
                className="skeleton-box"
                style={{ width: "60px", height: "14px", marginLeft: "auto" }}
              ></div>
            </td>
            <td className="col-gross">
              <div
                className="skeleton-box"
                style={{ width: "60px", height: "14px", marginLeft: "auto" }}
              ></div>
            </td>
            <td className="col-add">
              <div
                className="skeleton-box"
                style={{ width: "60px", height: "14px", marginLeft: "auto" }}
              ></div>
            </td>
            <td className="col-total">
              <div
                className="skeleton-box"
                style={{ width: "80px", height: "14px", marginLeft: "auto" }}
              ></div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    {/* Mock Phase 2 */}
    <div className="skeleton-phase-header" style={{ marginTop: "20px" }}>
      <div
        className="skeleton-box"
        style={{ width: "180px", height: "18px" }}
      ></div>
    </div>
    <div className="skeleton-dept-header"></div>
    <table className="bef-table">
      <BudgetColGroup />
      <tbody>
        {[1, 2, 3, 4, 5].map((i) => (
          <tr key={`p2-${i}`} className="skeleton-row">
            <td className="col-drag">
              <div
                className="skeleton-box"
                style={{ width: "16px", height: "16px", margin: "0 auto" }}
              ></div>
            </td>
            <td className="col-item-name">
              <div
                className="skeleton-box"
                style={{ width: "65%", height: "14px" }}
              ></div>
            </td>
            <td colSpan="6"></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const BudgetEntryForm = ({
  embedded = false,
  externalProjectId = "",
  versionId = "",
  projectName = "",
  versionName = "",
  refreshKey = 0,
}) => {
  const [hierarchy, setHierarchy] = useState([]); // phases → departments → categories → items
  const [expandedPhases, setExpandedPhases] = useState(new Set([2])); // Default: Production (id=2) open
  const [values, setValues] = useState({}); // { budget_item_id: { qty, rate, add1, c1 } }
  const [activeComment, setActiveComment] = useState(null); // { itemId, field }
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error', text }
  const [breakdownData, setBreakdownData] = useState({}); // { itemId: [sub-items] }
  const [activeBreakdownId, setActiveBreakdownId] = useState(null);
  const [activeBreakdownItem, setActiveBreakdownItem] = useState(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [pendingDisableId, setPendingDisableId] = useState(null);
  const [commentAnchorRect, setCommentAnchorRect] = useState(null);

  const togglePhase = (phaseId) => {
    const next = new Set(expandedPhases);
    if (next.has(phaseId)) next.delete(phaseId);
    else next.add(phaseId);
    setExpandedPhases(next);
  };

  // ── Load hierarchy once ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchOptions = { credentials: "include" };
    fetch(`${API}/api/hierarchy`, fetchOptions)
      .then((r) => r.json())
      .then((h) => {
        if (Array.isArray(h)) setHierarchy(h);
      })
      .catch((err) => {
        console.error("Error loading hierarchy:", err);
        setStatus({
          type: "error",
          text: "Error loading hierarchy data.",
        });
      });
  }, [refreshKey]);

  // ── Load existing values when externalProjectId changes ───────────────────
  useEffect(() => {
    if (!externalProjectId || !versionId) {
      setValues({});
      setStatus(null);
      return;
    }
    const loadValues = async () => {
      setLoading(true);
      setStatus(null);
      try {
        const fetchOptions = { credentials: "include" };
        const url = versionId
          ? `${API}/api/budget-values/project/${externalProjectId}?version_id=${versionId}`
          : `${API}/api/budget-values/project/${externalProjectId}`;

        const res = await fetch(url, fetchOptions);
        const vText = await res.text();
        let data = {};
        try {
          data = JSON.parse(vText);
          if (data.error) throw new Error(data.error);
        } catch (e) {
          if (!res.ok) throw new Error("Unauthorized or Session Expired");
        }
        // Backend returns a dict keyed by budget_item_id
        const initialValues = {};
        const itemsWithBreakdowns = [];

        Object.keys(data).forEach((itemId) => {
          const idNum = parseInt(itemId);
          const rowData = data[itemId];
          initialValues[idNum] = {
            qty: String(parseFloat(rowData.quantity) || ""),
            rate: String(parseFloat(rowData.rate) || ""),
            rate_type: rowData.rate_type || "day",
            multiplier: String(
              parseFloat(rowData.rate_multiplier || rowData.multiplier) || "1",
            ),
            gross: String(parseFloat(rowData.gross_revenue) || ""),
            add1: String(parseFloat(rowData.additional1) || ""),
            c1: rowData.comment1 || "",
            is_itemized: !!rowData.is_itemized,
            total: String(parseFloat(rowData.total) || "0"),
          };
          if (rowData.is_itemized) {
            itemsWithBreakdowns.push(idNum);
          }
        });

        console.log(
          `[BudgetLoader] Loaded ${Object.keys(initialValues).length} rows. Itemized IDs:`,
          itemsWithBreakdowns,
        );
        setValues(initialValues);

        // Fetch breakdowns for itemized rows
        if (itemsWithBreakdowns.length > 0) {
          const bdData = {};
          await Promise.all(
            itemsWithBreakdowns.map(async (idNum) => {
              try {
                const res = await fetch(
                  `${API}/api/budget-values/breakdown?project_id=${externalProjectId}&version_id=${versionId}&item_id=${idNum}`,
                  fetchOptions,
                );
                if (res.ok) {
                  const bds = await res.json();
                  bdData[idNum] = bds;
                  if (bds && bds.length > 0) {
                    const subTotal = bds.reduce(
                      (sum, bitm) => sum + (parseFloat(bitm.total) || 0),
                      0,
                    );
                    // Single source of truth update
                    initialValues[idNum].total = String(subTotal);
                    initialValues[idNum].is_itemized = true;
                    console.log(
                      `[BudgetLoader] Item ${idNum} auto-corrected: total ${subTotal}`,
                    );
                  }
                }
              } catch (e) {
                console.error(`[BudgetLoader] Failed for item ${idNum}:`, e);
              }
            }),
          );
          setBreakdownData(bdData);
          setValues({ ...initialValues });
        } else {
          setBreakdownData({});
        }
      } catch (err) {
        console.error("Error loading project values:", err);
        setStatus({
          type: "error",
          text: "Failed to load project values.",
        });
      } finally {
        setLoading(false);
      }
    };
    loadValues();
  }, [externalProjectId, versionId]);

  // ── Row value helpers ─────────────────────────────────────────────────────
  const getVal = (itemId, field) => {
    if (field === "rate_type") return values[itemId]?.rate_type || "day";
    return values[itemId]?.[field] || "";
  };

  const handleChange = (itemId, field, val) => {
    setValues((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {
          qty: "",
          rate: "",
          rate_type: "day",
          multiplier: "1",
          add1: "",
          c1: "",
          is_itemized: false,
        }),
        [field]: val,
      },
    }));
  };

  const handleToggleItemize = async (itemId, itemName) => {
    if (showVersionWarning) return;

    const currentIsItemized = values[itemId]?.is_itemized || false;
    const nextIsItemized = !currentIsItemized;

    if (nextIsItemized) {
      // Clear manual values as requested
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
      // Open modal automatically when first toggled on
      setActiveBreakdownId(itemId);
      setActiveBreakdownItem(itemName);
    } else {
      // Set state for custom confirmation modal
      setPendingDisableId(itemId);
      setShowDisableConfirm(true);
    }
  };

  const handleConfirmDisable = async () => {
    const itemId = pendingDisableId;
    if (!itemId) return;

    setValues((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        is_itemized: false,
        total: 0, // Reset total since breakdown is gone
      },
    }));
    setBreakdownData((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

    // Delete from backend immediately
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
    } catch (e) {
      console.error(e);
    } finally {
      setShowDisableConfirm(false);
      setPendingDisableId(null);
    }
  };

  const handleCancelDisable = () => {
    setShowDisableConfirm(false);
    setPendingDisableId(null);
  };

  const handleBreakdownSave = (validItems, grandTotal) => {
    const itemId = activeBreakdownId;

    // Save to state
    setBreakdownData((prev) => ({
      ...prev,
      [itemId]: validItems,
    }));

    // Update parent row total in values
    setValues((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        total: grandTotal,
        is_itemized: true,
      },
    }));

    // Save to backend immediately
    fetch(`${API}/api/budget-values/breakdown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: parseInt(externalProjectId),
        version_id: parseInt(versionId),
        item_id: parseInt(itemId),
        breakdown_items: validItems,
      }),
    }).catch((err) => console.error("Failed to save breakdown:", err));
  };

  const calcGross = (itemValues) => {
    const q = parseFloat(itemValues.qty) || 0;
    const m = parseFloat(itemValues.multiplier) || 1;
    const r = parseFloat(itemValues.rate) || 0;
    return +(q * m * r).toFixed(2);
  };

  const calcItemTotal = (itemValues) => {
    const grossVal = calcGross(itemValues);
    const a1 = parseFloat(itemValues.add1) || 0;
    return +(grossVal + a1).toFixed(2);
  };

  const grossRaw = (itemId) => {
    const itemValues = values[itemId] || {};
    return calcGross(itemValues);
  };

  const totalRaw = (itemId) => {
    const itemValues = values[itemId] || {};
    // If itemized, return the stored total which is derived from breakdown
    if (itemValues.is_itemized) return parseFloat(itemValues.total) || 0;
    return calcItemTotal(itemValues);
  };

  const getCategorySubtotal = (category) => {
    return (category.items || []).reduce(
      (sum, item) => sum + totalRaw(item.id),
      0,
    );
  };

  const formatCurrency = (val) => {
    return (val || 0).toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const grossDisplay = (itemId) => formatCurrency(grossRaw(itemId));

  const totalDisplay = (itemId) => formatCurrency(totalRaw(itemId));

  const getPhaseSubtotal = (phase) => {
    if (!phase.departments) return 0;
    return phase.departments.reduce((deptSum, dept) => {
      return (
        deptSum +
        (dept.categories || []).reduce((catSum, cat) => {
          return catSum + getCategorySubtotal(cat);
        }, 0)
      );
    }, 0);
  };

  const grandTotal = hierarchy.reduce((total, phase) => {
    return total + getPhaseSubtotal(phase);
  }, 0);

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

    const payload = [];
    Object.entries(values).forEach(([itemId, v]) => {
      const q = parseFloat(v.qty) || 0;
      const r = parseFloat(v.rate) || 0;
      const m = parseFloat(v.multiplier) || 1;
      const a1 = parseFloat(v.add1) || 0;
      const c1 = v.c1 || "";

      if (q > 0 || r > 0 || a1 > 0 || c1) {
        payload.push({
          budget_item_id: parseInt(itemId),
          quantity: q,
          rate: r,
          rate_type: v.rate_type || "day",
          rate_multiplier: m,
          additional1: a1,
          comment1: c1,
          gross_revenue: calcGross(v),
          total: totalRaw(itemId),
          is_itemized: v.is_itemized ? 1 : 0,
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
      setStatus({
        type: "success",
        text: `✅ ${data.message} saved successfully.`,
      });
    } catch (err) {
      setStatus({ type: "error", text: `❌ ${err.message}` });
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

  const onDragEnd = async (result) => {
    const { source, destination, type } = result;
    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const newHierarchy = JSON.parse(JSON.stringify(hierarchy)); // Deep clone for 4-level nest

    if (type === "CATEGORY") {
      // Find which phase and dept this belongs to
      let foundPhaseIdx = -1;
      let foundDeptIdx = -1;
      for (let p = 0; p < newHierarchy.length; p++) {
        const d = newHierarchy[p].departments.findIndex(
          (dept) => `dept-${dept.id}` === source.droppableId,
        );
        if (d !== -1) {
          foundPhaseIdx = p;
          foundDeptIdx = d;
          break;
        }
      }
      if (foundDeptIdx === -1) return;

      const newCategories = Array.from(
        newHierarchy[foundPhaseIdx].departments[foundDeptIdx].categories,
      );
      const [removed] = newCategories.splice(source.index, 1);
      newCategories.splice(destination.index, 0, removed);

      newHierarchy[foundPhaseIdx].departments[foundDeptIdx].categories =
        newCategories;
      setHierarchy(newHierarchy);

      try {
        const orderedIds = newCategories.map((c) => c.id);
        await fetch(`${API}/api/categories/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ordered_ids: orderedIds }),
        });
      } catch (err) {
        console.error("Failed to persist category order:", err);
      }
      return;
    }

    // Item dragging
    let phaseIdx = -1;
    let deptIdx = -1;
    let catIdx = -1;
    let targetCat = null;

    for (let p = 0; p < newHierarchy.length; p++) {
      for (let d = 0; d < newHierarchy[p].departments.length; d++) {
        const c = newHierarchy[p].departments[d].categories.findIndex(
          (cat) => `cat-${cat.id}` === destination.droppableId,
        );
        if (c !== -1) {
          phaseIdx = p;
          deptIdx = d;
          catIdx = c;
          targetCat = newHierarchy[p].departments[d].categories[c];
          break;
        }
      }
      if (targetCat) break;
    }

    if (!targetCat) return;

    const newItems = Array.from(targetCat.items);
    const [removed] = newItems.splice(source.index, 1);
    newItems.splice(destination.index, 0, removed);

    newHierarchy[phaseIdx].departments[deptIdx].categories[catIdx].items =
      newItems;
    setHierarchy(newHierarchy);

    try {
      const orderedIds = newItems.map((item) => item.id);
      await fetch(`${API}/api/budget-items/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
    } catch (err) {
      console.error("Failed to persist item order:", err);
    }
  };

  const handleClear = () => {
    setValues({});
    setStatus(null);
  };

  const filledCount = Object.values(values).filter(
    (v) =>
      (parseFloat(v.qty) || 0) > 0 ||
      (parseFloat(v.rate) || 0) > 0 ||
      (parseFloat(v.add1) || 0) > 0,
  ).length;

  const showVersionWarning = externalProjectId && !versionId;

  return (
    <div className="bef-root" onClick={() => setActiveComment(null)}>
      <div className="bef-main-content">
        {!embedded && (
          <div className="bef-header">
            <h2>Budget Entry</h2>
            <p>
              Fill in quantities, rates, and additional costs relative to the
              selected project.
            </p>
          </div>
        )}

        {showVersionWarning && (
          <div className="bef-version-warning">
            <span className="warning-icon">⚠️</span>
            Please select the budget version before proceeding
          </div>
        )}

        {loading && <SkeletonTable />}

        {!loading && hierarchy.length > 0 && (
          <div
            id="admin-budget-pdf-content"
            className="fade-in-section"
            style={{
              padding: "20px",
              backgroundColor: "#0d0e15",
              borderRadius: "12px",
            }}
          >
            <div className="bef-sheet">
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
                          <span
                            className={`phase-toggle-icon ${isExpanded ? "open" : ""}`}
                          ></span>
                          <h3>{phase.phase_name}</h3>
                        </div>
                        <div className="phase-header-right">
                          <span className="phase-total-label">Subtotal: </span>
                          <span className="phase-total-value">
                            Rs. {formatCurrency(phaseTotal)}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="phase-content">
                          {phase.departments.map((dept, deptIdx) => (
                            <div key={dept.id} className="dept-section">
                              <table className="bef-table dept-header-table">
                                <BudgetColGroup />
                                <tbody className="bef-dept-body">
                                  <tr className="bef-dept-row">
                                    <td colSpan="8">
                                      <div className="dept-header-content">
                                        <span className="dept-id">
                                          {String(deptIdx + 1).padStart(2, "0")}
                                        </span>
                                        <span className="dept-name">
                                          {dept.department_name}
                                        </span>
                                      </div>
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
                                  >
                                    <BudgetColGroup />
                                    {dept.categories.map((cat, catIdx) => (
                                      <Draggable
                                        key={cat.id}
                                        draggableId={`cat-${cat.id}`}
                                        index={catIdx}
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
                                                <tr className="bef-cat-row">
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
                                                    <div className="cat-header-row">
                                                      <span className="cat-name">
                                                        {cat.category_name}
                                                      </span>
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

                                                {cat.items.map(
                                                  (item, index) => {
                                                    const v =
                                                      values[item.id] || {};
                                                    const isFilled =
                                                      (parseFloat(v.qty) || 0) >
                                                        0 ||
                                                      (parseFloat(v.rate) ||
                                                        0) > 0 ||
                                                      (parseFloat(v.add1) ||
                                                        0) > 0;

                                                    return (
                                                      <Draggable
                                                        key={item.id}
                                                        draggableId={String(
                                                          item.id,
                                                        )}
                                                        index={index}
                                                      >
                                                        {(
                                                          providedRow,
                                                          snapshotRow,
                                                        ) => (
                                                          <tr
                                                            ref={
                                                              providedRow.innerRef
                                                            }
                                                            {...providedRow.draggableProps}
                                                            className={`bef-row ${isFilled ? "filled" : ""} ${snapshotRow.isDragging ? "dragging" : ""}`}
                                                          >
                                                            <td
                                                              className="col-drag"
                                                              {...providedRow.dragHandleProps}
                                                            >
                                                              <span className="material-symbols-outlined drag-handle-icon">
                                                                drag_indicator
                                                              </span>
                                                            </td>
                                                            <td className="col-item-name">
                                                              <div className="item-name-cell-wrapper">
                                                                <button
                                                                  className={`item-itemize-toggle ${v.is_itemized ? "active" : ""}`}
                                                                  onClick={(
                                                                    e,
                                                                  ) => {
                                                                    e.stopPropagation();
                                                                    handleToggleItemize(
                                                                      item.id,
                                                                      item.item_name,
                                                                    );
                                                                  }}
                                                                  title={
                                                                    v.is_itemized
                                                                      ? "Disable Breakdown"
                                                                      : "Enable Breakdown"
                                                                  }
                                                                >
                                                                  <i
                                                                    className={`fas ${v.is_itemized ? "fa-list-ul" : "fa-list"}`}
                                                                  ></i>
                                                                </button>
                                                                <span className="item-name-text">
                                                                  {
                                                                    item.item_name
                                                                  }
                                                                </span>
                                                                {v.is_itemized && (
                                                                  <span
                                                                    className="breakdown-badge"
                                                                    onClick={(
                                                                      e,
                                                                    ) => {
                                                                      e.stopPropagation();
                                                                      setActiveBreakdownId(
                                                                        item.id,
                                                                      );
                                                                      setActiveBreakdownItem(
                                                                        item.item_name,
                                                                      );
                                                                    }}
                                                                  >
                                                                    Itemized
                                                                  </span>
                                                                )}
                                                              </div>
                                                            </td>
                                                            <td className="col-units">
                                                              <input
                                                                type="number"
                                                                min="0"
                                                                step="any"
                                                                placeholder={
                                                                  v.is_itemized
                                                                    ? "—"
                                                                    : "0"
                                                                }
                                                                value={
                                                                  v.is_itemized
                                                                    ? ""
                                                                    : getVal(
                                                                        item.id,
                                                                        "qty",
                                                                      )
                                                                }
                                                                onChange={(
                                                                  e,
                                                                ) => {
                                                                  if (
                                                                    showVersionWarning
                                                                  )
                                                                    return;
                                                                  handleChange(
                                                                    item.id,
                                                                    "qty",
                                                                    e.target
                                                                      .value,
                                                                  );
                                                                }}
                                                                disabled={
                                                                  showVersionWarning ||
                                                                  v.is_itemized
                                                                }
                                                              />
                                                            </td>
                                                            <td className="col-rate-type">
                                                              <div
                                                                className={`rate-type-column-content ${v.is_itemized ? "disabled" : ""}`}
                                                              >
                                                                <input
                                                                  type="number"
                                                                  min="0"
                                                                  step="any"
                                                                  className="multiplier-input"
                                                                  placeholder="1"
                                                                  value={getVal(
                                                                    item.id,
                                                                    "multiplier",
                                                                  )}
                                                                  onChange={(
                                                                    e,
                                                                  ) => {
                                                                    if (
                                                                      showVersionWarning
                                                                    )
                                                                      return;
                                                                    handleChange(
                                                                      item.id,
                                                                      "multiplier",
                                                                      e.target
                                                                        .value,
                                                                    );
                                                                  }}
                                                                  disabled={
                                                                    showVersionWarning ||
                                                                    v.is_itemized
                                                                  }
                                                                />
                                                                <div
                                                                  className={`rate-type-toggle ${v.is_itemized ? "disabled" : ""}`}
                                                                >
                                                                  <label
                                                                    className={`rt-option ${getVal(item.id, "rate_type") === "day" ? "active" : ""}`}
                                                                  >
                                                                    <input
                                                                      type="radio"
                                                                      name={`rate_type-${item.id}`}
                                                                      value="day"
                                                                      checked={
                                                                        getVal(
                                                                          item.id,
                                                                          "rate_type",
                                                                        ) ===
                                                                        "day"
                                                                      }
                                                                      onChange={() =>
                                                                        !v.is_itemized &&
                                                                        handleChange(
                                                                          item.id,
                                                                          "rate_type",
                                                                          "day",
                                                                        )
                                                                      }
                                                                      disabled={
                                                                        v.is_itemized ||
                                                                        showVersionWarning
                                                                      }
                                                                    />
                                                                    Day
                                                                  </label>
                                                                  <label
                                                                    className={`rt-option ${getVal(item.id, "rate_type") === "cs" ? "active" : ""}`}
                                                                  >
                                                                    <input
                                                                      type="radio"
                                                                      name={`rate_type-${item.id}`}
                                                                      value="cs"
                                                                      checked={
                                                                        getVal(
                                                                          item.id,
                                                                          "rate_type",
                                                                        ) ===
                                                                        "cs"
                                                                      }
                                                                      onChange={() =>
                                                                        !v.is_itemized &&
                                                                        handleChange(
                                                                          item.id,
                                                                          "rate_type",
                                                                          "cs",
                                                                        )
                                                                      }
                                                                      disabled={
                                                                        v.is_itemized ||
                                                                        showVersionWarning
                                                                      }
                                                                    />
                                                                    CS
                                                                  </label>
                                                                </div>
                                                              </div>
                                                            </td>
                                                            <td className="col-rate">
                                                              <input
                                                                type="number"
                                                                min="0"
                                                                step="any"
                                                                placeholder={
                                                                  v.is_itemized
                                                                    ? "—"
                                                                    : "0.00"
                                                                }
                                                                value={
                                                                  v.is_itemized
                                                                    ? ""
                                                                    : getVal(
                                                                        item.id,
                                                                        "rate",
                                                                      )
                                                                }
                                                                onChange={(
                                                                  e,
                                                                ) => {
                                                                  if (
                                                                    showVersionWarning
                                                                  )
                                                                    return;
                                                                  handleChange(
                                                                    item.id,
                                                                    "rate",
                                                                    e.target
                                                                      .value,
                                                                  );
                                                                }}
                                                                disabled={
                                                                  showVersionWarning ||
                                                                  v.is_itemized
                                                                }
                                                              />
                                                            </td>
                                                            <td
                                                              className={`col-gross gross-cell ${isFilled ? "has-value" : ""}`}
                                                            >
                                                              {v.is_itemized
                                                                ? "—"
                                                                : grossDisplay(
                                                                    item.id,
                                                                  )}
                                                            </td>
                                                            <td className="col-add bef-relative">
                                                              <div className="add-input-group">
                                                                <input
                                                                  type="number"
                                                                  min="0"
                                                                  step="any"
                                                                  placeholder="0.00"
                                                                  value={getVal(
                                                                    item.id,
                                                                    "add1",
                                                                  )}
                                                                  onChange={(
                                                                    e,
                                                                  ) => {
                                                                    if (
                                                                      showVersionWarning
                                                                    )
                                                                      return;
                                                                    handleChange(
                                                                      item.id,
                                                                      "add1",
                                                                      e.target
                                                                        .value,
                                                                    );
                                                                  }}
                                                                  disabled={
                                                                    showVersionWarning
                                                                  }
                                                                />
                                                                <button
                                                                  className={`bef-comment-btn ${getVal(item.id, "c1") ? "has-comment" : ""}`}
                                                                  onClick={(
                                                                    e,
                                                                  ) => {
                                                                    e.stopPropagation();
                                                                    setCommentAnchorRect(
                                                                      e.currentTarget.getBoundingClientRect(),
                                                                    );
                                                                    setActiveComment(
                                                                      {
                                                                        itemId:
                                                                          item.id,
                                                                        field:
                                                                          "c1",
                                                                      },
                                                                    );
                                                                  }}
                                                                >
                                                                  <svg
                                                                    className="comment-icon"
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    viewBox="0 0 24 24"
                                                                    width="16"
                                                                    height="16"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                  >
                                                                    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                                                                  </svg>
                                                                  {getVal(
                                                                    item.id,
                                                                    "c1",
                                                                  ) && (
                                                                    <div className="bef-comment-preview">
                                                                      {getVal(
                                                                        item.id,
                                                                        "c1",
                                                                      )}
                                                                    </div>
                                                                  )}
                                                                </button>
                                                                {activeComment?.itemId ===
                                                                  item.id &&
                                                                  activeComment?.field ===
                                                                    "c1" &&
                                                                  ReactDOM.createPortal(
                                                                    <div
                                                                      className="bef-comment-popover glass-sandblasted animated-popover"
                                                                      style={{
                                                                        top: commentAnchorRect
                                                                          ? commentAnchorRect.bottom +
                                                                            10
                                                                          : 0,
                                                                        left: commentAnchorRect
                                                                          ? commentAnchorRect.right -
                                                                            220
                                                                          : 0,
                                                                      }}
                                                                      onClick={(
                                                                        e,
                                                                      ) =>
                                                                        e.stopPropagation()
                                                                      }
                                                                    >
                                                                      <textarea
                                                                        placeholder="Add a detailed note for this row..."
                                                                        value={getVal(
                                                                          item.id,
                                                                          "c1",
                                                                        )}
                                                                        onChange={(
                                                                          e,
                                                                        ) =>
                                                                          handleChange(
                                                                            item.id,
                                                                            "c1",
                                                                            e
                                                                              .target
                                                                              .value,
                                                                          )
                                                                        }
                                                                        autoFocus
                                                                      />
                                                                      <div className="popover-footer">
                                                                        <button
                                                                          className="popover-done-btn"
                                                                          onClick={() =>
                                                                            setActiveComment(
                                                                              null,
                                                                            )
                                                                          }
                                                                        >
                                                                          Done
                                                                        </button>
                                                                      </div>
                                                                    </div>,
                                                                    document.body,
                                                                  )}
                                                              </div>
                                                            </td>
                                                            <td
                                                              className={`col-total total-cell ${isFilled ? "has-value" : ""}`}
                                                            >
                                                              {totalDisplay(
                                                                item.id,
                                                              )}
                                                            </td>
                                                          </tr>
                                                        )}
                                                      </Draggable>
                                                    );
                                                  },
                                                )}
                                                {providedItem.placeholder}
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
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </DragDropContext>
            </div>
            <div className="bef-footer">
              <div className="bef-grand-total">
                Grand Total:&nbsp;
                <strong>Rs.{formatCurrency(grandTotal)}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Footer actions bar (outside PDF) */}
        {!loading && hierarchy.length > 0 && (
          <div className="bef-footer bef-actions-only-footer">
            <div className="bef-actions" style={{ marginLeft: "auto" }}>
                <button
                  className="bef-btn-submit"
                  onClick={handleDownloadPDF}
                  style={{
                    background: "#4bc0c0",
                    marginRight: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Icon name="download" modifiers="sm" />
                  Download PDF
                </button>
              <button
                className="bef-btn-clear"
                onClick={handleClear}
                disabled={submitting}
              >
                Clear All
              </button>
              <button
                className="bef-btn-submit"
                onClick={handleSubmit}
                disabled={submitting || !externalProjectId}
              >
                {submitting
                  ? "Saving…"
                  : `Submit All${filledCount ? ` (${filledCount})` : ""}`}
              </button>
            </div>
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
      </div>
    </div>
  );
};

export default BudgetEntryForm;
