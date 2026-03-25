import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import "./BudgetEntryForm.css";

const API = "http://localhost:5000";

// ── Skeletal Loading Component ──────────────────────────────────────────────
const SkeletonTable = () => (
  <div className="bef-sheet skeleton-sheet">
    <table className="bef-table">
      <thead>
        <tr>
          <th style={{ width: "30px" }}></th>
          <th className="col-item-name">Item Name</th>
          <th className="col-num">Qty</th>
          <th className="col-rate-type">Type</th>
          <th className="col-num">Rate</th>
          <th className="col-num">Additional</th>
          <th className="col-num">Total (Rs.)</th>
        </tr>
      </thead>
      <tbody>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
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
            <td className="col-num">
              <div
                className="skeleton-box"
                style={{ width: "40px", height: "14px", marginLeft: "auto" }}
              ></div>
            </td>
            <td className="col-rate-type">
              <div
                className="skeleton-box"
                style={{ width: "80px", height: "24px", margin: "0 auto" }}
              ></div>
            </td>
            <td className="col-num">
              <div
                className="skeleton-box"
                style={{ width: "60px", height: "14px", marginLeft: "auto" }}
              ></div>
            </td>
            <td className="col-num">
              <div
                className="skeleton-box"
                style={{ width: "60px", height: "14px", marginLeft: "auto" }}
              ></div>
            </td>
            <td className="col-num">
              <div
                className="skeleton-box"
                style={{ width: "80px", height: "14px", marginLeft: "auto" }}
              ></div>
            </td>
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
}) => {
  const [hierarchy, setHierarchy] = useState([]); // departments → categories → items
  const [values, setValues] = useState({}); // { budget_item_id: { qty, rate, add1, add2, c1, c2 } }
  const [activeComment, setActiveComment] = useState(null); // { itemId, field }
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error', text }

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
  }, []);

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
        Object.keys(data).forEach((itemId) => {
          initialValues[itemId] = {
            qty: String(parseFloat(data[itemId].quantity) || ""),
            rate: String(parseFloat(data[itemId].rate) || ""),
            rate_type: data[itemId].rate_type || "day",
            multiplier: String(parseFloat(data[itemId].rate_multiplier) || "1"),
            add1: String(parseFloat(data[itemId].additional1) || ""),
            add2: String(parseFloat(data[itemId].additional2) || ""),
            c1: data[itemId].comment1 || "",
            c2: data[itemId].comment2 || "",
          };
        });
        setValues(initialValues);
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
    if (field === "day_cs") {
      setValues((prev) => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] || {
            qty: "",
            rate: "",
            rate_type: "day",
            multiplier: "1",
            add1: "",
            add2: "",
            c1: "",
            c2: "",
          }),
          rate_type: val,
        },
      }));
      return;
    }

    setValues((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {
          qty: "",
          rate: "",
          rate_type: "day",
          multiplier: "1",
          add1: "",
          add2: "",
          c1: "",
          c2: "",
        }),
        [field]: val,
      },
    }));
  };

  const calcItemTotal = (itemValues) => {
    const q = parseFloat(itemValues.qty) || 0;
    const m = parseFloat(itemValues.multiplier) || 1;
    const r = parseFloat(itemValues.rate) || 0;
    const a1 = parseFloat(itemValues.add1) || 0;
    const a2 = parseFloat(itemValues.add2) || 0;
    return +(q * m * r + a1 + a2).toFixed(2);
  };

  const totalRaw = (itemId) => {
    const itemValues = values[itemId] || {};
    return calcItemTotal(itemValues);
  };

  const getCategorySubtotal = (category) => {
    return category.items.reduce((sum, item) => sum + totalRaw(item.id), 0);
  };

  const formatCurrency = (val) => {
    return (val || 0).toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const totalDisplay = (itemId) => formatCurrency(totalRaw(itemId));

  const grandTotal = hierarchy.reduce((deptSum, dept) => {
    return (
      deptSum +
      dept.categories.reduce((catSum, cat) => {
        return catSum + getCategorySubtotal(cat);
      }, 0)
    );
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
      const a2 = parseFloat(v.add2) || 0;
      const c1 = v.c1 || "";
      const c2 = v.c2 || "";

      if (q > 0 || r > 0 || a1 > 0 || a2 > 0 || c1 || c2) {
        payload.push({
          budget_item_id: parseInt(itemId),
          quantity: q,
          rate: r,
          rate_type: v.rate_type || "day",
          rate_multiplier: m,
          additional1: a1,
          additional2: a2,
          comment1: c1,
          comment2: c2,
          total: calcItemTotal(v),
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

  const onDragEnd = async (result) => {
    const { source, destination, type } = result;
    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const newHierarchy = Array.from(hierarchy);

    if (type === "CATEGORY") {
      const deptId = parseInt(source.droppableId.replace("dept-", ""));
      const deptIdx = newHierarchy.findIndex((d) => d.id === deptId);
      if (deptIdx === -1) return;

      const newCategories = Array.from(newHierarchy[deptIdx].categories);
      const [removed] = newCategories.splice(source.index, 1);
      newCategories.splice(destination.index, 0, removed);

      newHierarchy[deptIdx].categories = newCategories;
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
    let deptIdx = -1;
    let catIdx = -1;
    let targetCat = null;

    for (let d = 0; d < newHierarchy.length; d++) {
      const c = newHierarchy[d].categories.findIndex(
        (cat) => `cat-${cat.id}` === destination.droppableId,
      );
      if (c !== -1) {
        deptIdx = d;
        catIdx = c;
        targetCat = newHierarchy[d].categories[c];
        break;
      }
    }

    if (!targetCat) return;

    const newItems = Array.from(targetCat.items);
    const [removed] = newItems.splice(source.index, 1);
    newItems.splice(destination.index, 0, removed);

    newHierarchy[deptIdx].categories[catIdx].items = newItems;
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
      (parseFloat(v.add1) || 0) > 0 ||
      (parseFloat(v.add2) || 0) > 0,
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
          <div className="bef-sheet">
            <DragDropContext onDragEnd={onDragEnd}>
              <table className="bef-table header-only-table">
                <thead>
                  <tr>
                    <th className="col-drag" style={{ width: "30px" }}></th>
                    <th className="col-item-name">Item Name</th>
                    <th className="col-num">Qty</th>
                    <th className="col-rate-type">Type</th>
                    <th className="col-num">Rate</th>
                    <th className="col-num">Additional</th>
                    <th className="col-num">Total (Rs.)</th>
                  </tr>
                </thead>
              </table>

              {hierarchy.map((dept, deptIdx) => (
                <div key={dept.id} className="dept-section">
                  <table className="bef-table dept-header-table">
                    <tbody className="bef-dept-body">
                      <tr className="bef-dept-row">
                        <td colSpan="7">
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
                                        <i className="fas fa-ellipsis-v"></i>
                                      </td>
                                      <td colSpan="5">
                                        <div className="cat-header-row">
                                          <span className="cat-name">
                                            {cat.category_name}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="col-num cat-subtotal">
                                        {getCategorySubtotal(cat) > 0
                                          ? formatCurrency(
                                              getCategorySubtotal(cat),
                                            )
                                          : ""}
                                      </td>
                                    </tr>

                                    {cat.items.map((item, index) => {
                                      const v = values[item.id] || {};
                                      const isFilled =
                                        (parseFloat(v.qty) || 0) > 0 ||
                                        (parseFloat(v.rate) || 0) > 0 ||
                                        (parseFloat(v.add1) || 0) > 0 ||
                                        (parseFloat(v.add2) || 0) > 0;

                                      return (
                                        <Draggable
                                          key={item.id}
                                          draggableId={String(item.id)}
                                          index={index}
                                        >
                                          {(providedRow, snapshotRow) => (
                                            <tr
                                              ref={providedRow.innerRef}
                                              {...providedRow.draggableProps}
                                              className={`bef-row ${isFilled ? "filled" : ""} ${snapshotRow.isDragging ? "dragging" : ""}`}
                                            >
                                              <td
                                                className="col-drag"
                                                {...providedRow.dragHandleProps}
                                              >
                                                <svg
                                                  width="16"
                                                  height="16"
                                                  viewBox="0 0 24 24"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="2"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                >
                                                  <line x1="8" y1="9" x2="16" y2="9"></line>
                                                  <line x1="8" y1="12" x2="16" y2="12"></line>
                                                  <line x1="8" y1="15" x2="16" y2="15"></line>
                                                </svg>
                                              </td>
                                              <td className="col-item-name">
                                                {item.item_name}
                                              </td>
                                              <td className="col-num">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="any"
                                                  placeholder="0"
                                                  value={getVal(item.id, "qty")}
                                                  onChange={(e) => {
                                                    if (showVersionWarning) return;
                                                    handleChange(item.id, "qty", e.target.value);
                                                  }}
                                                  disabled={showVersionWarning}
                                                />
                                              </td>
                                              <td className="col-rate-type">
                                                <div className="rate-type-column-content">
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    className="multiplier-input"
                                                    placeholder="1"
                                                    value={getVal(item.id, "multiplier")}
                                                    onChange={(e) => {
                                                      if (showVersionWarning) return;
                                                      handleChange(item.id, "multiplier", e.target.value);
                                                    }}
                                                    disabled={showVersionWarning}
                                                  />
                                                  <div className="rate-type-toggle">
                                                    <label className={`rt-option ${getVal(item.id, "rate_type") === "day" ? "active" : ""}`}>
                                                      <input
                                                        type="radio"
                                                        name={`rate_type-${item.id}`}
                                                        value="day"
                                                        checked={getVal(item.id, "rate_type") === "day"}
                                                        onChange={() => handleChange(item.id, "day_cs", "day")}
                                                      />
                                                      Day
                                                    </label>
                                                    <label className={`rt-option ${getVal(item.id, "rate_type") === "cs" ? "active" : ""}`}>
                                                      <input
                                                        type="radio"
                                                        name={`rate_type-${item.id}`}
                                                        value="cs"
                                                        checked={getVal(item.id, "rate_type") === "cs"}
                                                        onChange={() => handleChange(item.id, "day_cs", "cs")}
                                                      />
                                                      CS
                                                    </label>
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="col-num">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="any"
                                                  placeholder="0.00"
                                                  value={getVal(item.id, "rate")}
                                                  onChange={(e) => {
                                                    if (showVersionWarning) return;
                                                    handleChange(item.id, "rate", e.target.value);
                                                  }}
                                                  disabled={showVersionWarning}
                                                />
                                              </td>
                                              <td className="col-num bef-relative">
                                                <div className="add-input-group">
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    placeholder="0.00"
                                                    value={getVal(item.id, "add1")}
                                                    onChange={(e) => {
                                                      if (showVersionWarning) return;
                                                      handleChange(item.id, "add1", e.target.value);
                                                    }}
                                                    disabled={showVersionWarning}
                                                  />
                                                  <button
                                                    className={`bef-comment-btn ${getVal(item.id, "c1") ? "has-comment" : ""}`}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActiveComment({ itemId: item.id, field: "c1" });
                                                    }}
                                                  >
                                                    <svg className="comment-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                                                    </svg>
                                                    {getVal(item.id, "c1") && (
                                                      <div className="bef-comment-preview">{getVal(item.id, "c1")}</div>
                                                    )}
                                                  </button>
                                                  {activeComment?.itemId === item.id && activeComment?.field === "c1" && (
                                                    <div className="bef-comment-popover" onClick={(e) => e.stopPropagation()}>
                                                      <textarea
                                                        placeholder="Comment for Add. 1..."
                                                        value={getVal(item.id, "c1")}
                                                        onChange={(e) => handleChange(item.id, "c1", e.target.value)}
                                                        autoFocus
                                                      />
                                                      <button onClick={() => setActiveComment(null)}>Close</button>
                                                    </div>
                                                  )}
                                                </div>
                                              </td>
                                              <td className={`col-num total-cell ${isFilled ? "has-value" : ""}`}>
                                                {totalDisplay(item.id)}
                                              </td>
                                            </tr>
                                          )}
                                        </Draggable>
                                      );
                                    })}
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
            </DragDropContext>
          </div>
        )}

        {/* Footer bar */}
        {!loading && hierarchy.length > 0 && (
          <div className="bef-footer">
            <div className="bef-grand-total">
              Grand Total:&nbsp;
              <strong>Rs.{formatCurrency(grandTotal)}</strong>
            </div>
            <div className="bef-actions">
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

        {status && (
          <div className={`bef-status ${status.type}`}>{status.text}</div>
        )}
      </div>
    </div>
  );
};

export default BudgetEntryForm;
