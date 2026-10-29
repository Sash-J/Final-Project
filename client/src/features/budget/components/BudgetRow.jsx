import { Draggable } from "@hello-pangea/dnd";
import ReactDOM from "react-dom";
import { formatCurrency } from "../../../utils/currencyUtils";
import CrewAssignmentDropdown from "./CrewAssignmentDropdown";
import Icon from "../../../components/common/Icon";
import "./BudgetRow.css";


export const BudgetRow = ({
  item,
  index,
  getVal,
  handleChange,
  handleToggleItemize,
  setActiveBreakdownId,
  setActiveBreakdownItem,
  commentAnchorRect,
  setCommentAnchorRect,
  activeComment,
  setActiveComment,
  showVersionWarning,
  isReadOnly = false,
  canEdit = true,
  grossDisplay,
  totalDisplay,
  isFilled,
  focusedInput,
  setFocusedInput,
  isDragDisabled,
  projectCrew = [],
  budgetItemAssignments = {},
  activeAssignItemId,
  setActiveAssignItemId,
  isCrewEditing,
  setIsCrewEditing,
  handleAssignBudgetItemCrew,
  comparisonData = null,
  totalRaw,
  hideGrossAndAdd = false,
  canDrag = true,
}) => {
  const readOnly = isReadOnly || showVersionWarning || !canEdit;
  const v = getVal(item.id, "all") || {};
  const rateType = getVal(item.id, "rate_type");
  const isCompareMode = !!comparisonData;

  const valA = parseFloat(totalRaw ? totalRaw(item.id) : v.total) || 0;
  const valB = parseFloat(comparisonData?.budgetB?.[item.id]?.total) || 0;

  const q = parseFloat(v.qty) || 0;
  const m = parseFloat(v.multiplier) || 1;
  const unitsTotal = q * m;
  const itemTotal = valA;

  let displayedRate = v.is_itemized
    ? "—"
    : formatCurrency(getVal(item.id, "rate") || 0, false);

  if (hideGrossAndAdd && !v.is_itemized && unitsTotal > 0) {
    displayedRate = formatCurrency(itemTotal / unitsTotal, false);
  }
  
  const getVarianceClass = (valA, valB) => {
    const diff = valA - valB;
    if (diff > 0) return "variance-negative";
    if (diff < 0) return "variance-positive";
    return "variance-neutral";
  };
  
  const formatVariance = (valA, valB) => {
    const diff = valA - valB;
    if (diff === 0) return "+$0.00";
    const formatted = formatCurrency(Math.abs(diff));
    return diff > 0 ? `+${formatted}` : `-${formatted}`;
  };

  return (
    <Draggable draggableId={String(item.id)} index={index} isDragDisabled={isDragDisabled || isCompareMode}>
      {(providedRow, snapshotRow) => (
        <tr
          id={`budget-row-${item.id}`}
          ref={providedRow.innerRef}
          {...providedRow.draggableProps}
          className={`bef-row ${isFilled ? "filled" : ""} ${snapshotRow.isDragging ? "dragging" : ""}`}
        >
          {canDrag && !isCompareMode && (
            <td className="col-drag" {...providedRow.dragHandleProps}>
              <Icon name="drag_indicator" className="drag-handle-icon" />
            </td>
          )}
          <td className="col-item-name">
            <div className="item-name-cell-wrapper">
              {!isCompareMode && !readOnly && (
                <button
                  className={`item-itemize-toggle ${v.is_itemized ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleItemize(item.id, item.item_name);
                  }}
                  title={v.is_itemized ? "Disable Breakdown" : "Enable Breakdown"}
                />
              )}
              <span className="item-name-text">{item.item_name}</span>
              {v.is_itemized && (
                <span
                  className="breakdown-badge"
                  onClick={(e) => {
                    if (isCompareMode) return;
                    e.stopPropagation();
                    setActiveBreakdownId(item.id);
                    setActiveBreakdownItem(item.item_name);
                  }}
                  style={{ cursor: isCompareMode ? "default" : "pointer" }}
                >
                  Itemized
                </span>
              )}
              
              {canEdit && !readOnly && (
                <CrewAssignmentDropdown
                  assignedCrew={budgetItemAssignments[item.id] || []}
                  projectCrew={projectCrew}
                  isActive={activeAssignItemId === item.id}
                  onToggle={() => setActiveAssignItemId(activeAssignItemId === item.id ? null : item.id)}
                  onAssign={(crewId) => handleAssignBudgetItemCrew(item.id, crewId)}
                  isCrewEditing={isCrewEditing}
                  setIsCrewEditing={setIsCrewEditing}
                />
              )}

            </div>
          </td>
          <td className="col-units">
            <input
              type="number"
              min="0"
              step="any"
              placeholder={v.is_itemized ? "—" : "0"}
              value={v.is_itemized ? "" : getVal(item.id, "qty")}
              onChange={(e) => {
                if (readOnly) return;
                const val = e.target.value;
                if (val.length <= 3) {
                  handleChange(item.id, "qty", val);
                }
              }}
              disabled={readOnly || v.is_itemized || isCompareMode}
            />
          </td>
          <td className="col-rate-type">
            <div
              className={`rate-type-column-content ${v.is_itemized || readOnly ? "disabled" : ""}`}
            >
              <input
                type="number"
                min="0"
                step="any"
                className="multiplier-input"
                placeholder="1"
                value={getVal(item.id, "multiplier")}
                onChange={(e) => {
                  if (readOnly) return;
                  const val = e.target.value;
                  if (val.length <= 3) {
                    handleChange(item.id, "multiplier", val);
                  }
                }}
                disabled={readOnly || v.is_itemized || isCompareMode}
              />
              {readOnly ? (
                <div
                  className={`rate-type-selected-badge ${v.is_itemized ? "disabled" : ""}`}
                >
                  <span>{rateType === "cs" ? "CS" : "DAY"}</span>
                </div>
              ) : (
                <div
                  className={`rate-type-toggle ${v.is_itemized ? "disabled" : ""}`}
                >
                  <label
                    className={`rt-option ${rateType === "day" ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`rate_type-${item.id}`}
                      value="day"
                      checked={rateType === "day"}
                      onChange={() =>
                        !v.is_itemized &&
                        !readOnly &&
                        handleChange(item.id, "rate_type", "day")
                      }
                      disabled={v.is_itemized || isCompareMode}
                    />
                    DAY
                  </label>
                  <label
                    className={`rt-option ${rateType === "cs" ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`rate_type-${item.id}`}
                      value="cs"
                      checked={rateType === "cs"}
                      onChange={() =>
                        !v.is_itemized && !readOnly && handleChange(item.id, "rate_type", "cs")
                      }
                      disabled={v.is_itemized || isCompareMode}
                    />
                    CS
                  </label>
                </div>
              )}
            </div>
          </td>
          <td className="col-rate">
            {!readOnly && focusedInput?.itemId === item.id &&
            focusedInput?.field === "rate" ? (
              <input
                type="number"
                min="0"
                step="any"
                autoFocus
                placeholder={v.is_itemized ? "—" : "0.00"}
                value={v.is_itemized ? "" : getVal(item.id, "rate")}
                onBlur={() => setFocusedInput(null)}
                onChange={(e) => {
                  if (readOnly) return;
                  handleChange(item.id, "rate", e.target.value);
                }}
                disabled={readOnly || v.is_itemized || isCompareMode}
              />
            ) : (
              <div
                className="readability-input-proxy"
                onClick={() =>
                  !isCompareMode &&
                  !v.is_itemized &&
                  !readOnly &&
                  setFocusedInput({ itemId: item.id, field: "rate" })
                }
              >
                {displayedRate}
              </div>
            )}
          </td>
          {!hideGrossAndAdd && (
            <>
              <td className={`col-gross gross-cell ${isFilled ? "has-value" : ""}`}>
                {v.is_itemized ? "—" : formatCurrency(grossDisplay(item.id), false)}
              </td>
              <td className="col-add bef-relative">
                <div className="add-input-group">
                  {!readOnly && focusedInput?.itemId === item.id &&
                  focusedInput?.field === "add1" ? (
                    <input
                      type="number"
                      min="0"
                      step="any"
                      autoFocus
                      placeholder="0.00"
                      value={getVal(item.id, "add1")}
                      onBlur={() => setFocusedInput(null)}
                      onChange={(e) => {
                        if (readOnly) return;
                        handleChange(item.id, "add1", e.target.value);
                      }}
                      disabled={readOnly || isCompareMode}
                    />
                  ) : (
                    <div
                      className="readability-input-proxy"
                      onClick={() =>
                        !isCompareMode &&
                        !readOnly &&
                        setFocusedInput({ itemId: item.id, field: "add1" })
                      }
                    >
                      {formatCurrency(getVal(item.id, "add1") || 0, false)}
                    </div>
                  )}
                  {(!readOnly || getVal(item.id, "c1")) && (
                    <button
                      className={`bef-comment-btn ${getVal(item.id, "c1") ? "has-comment" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCommentAnchorRect(e.currentTarget.getBoundingClientRect());
                        setActiveComment({ itemId: item.id, field: "c1" });
                      }}
                    >
                      <Icon name="chat_bubble" className="comment-icon" />
                      {getVal(item.id, "c1") && (
                        <div className="bef-comment-preview">
                          {getVal(item.id, "c1")}
                        </div>
                      )}
                    </button>
                  )}
                  {activeComment?.itemId === item.id &&
                    activeComment?.field === "c1" &&
                    ReactDOM.createPortal(
                      <div
                        className="bef-comment-popover glass-sandblasted animated-popover"
                        style={{
                          top: commentAnchorRect
                            ? commentAnchorRect.bottom + 10
                            : 0,
                          left: commentAnchorRect
                            ? commentAnchorRect.right - 220
                            : 0,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <textarea
                          placeholder="Add a detailed note for this row..."
                          value={getVal(item.id, "c1")}
                          onChange={(e) =>
                            handleChange(item.id, "c1", e.target.value)
                          }
                          autoFocus
                        />
                        <div className="popover-footer">
                          <button
                            className="popover-done-btn"
                            onClick={() => setActiveComment(null)}
                          >
                            Done
                          </button>
                        </div>
                      </div>,
                      document.body,
                    )}
                </div>
              </td>
            </>
          )}
          <td className={`col-total total-cell ${isFilled ? "has-value" : ""} ${hideGrossAndAdd ? "bef-relative" : ""}`}>
            {hideGrossAndAdd ? (
              <div className="total-cell-content">
                <span>{totalDisplay(item.id)}</span>
                {(!readOnly || getVal(item.id, "c1")) && (
                  <button
                    className={`bef-comment-btn ${getVal(item.id, "c1") ? "has-comment" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCommentAnchorRect(e.currentTarget.getBoundingClientRect());
                      setActiveComment({ itemId: item.id, field: "c1" });
                    }}
                  >
                    <Icon name="chat_bubble" className="comment-icon" />
                    {getVal(item.id, "c1") && (
                      <div className="bef-comment-preview">
                        {getVal(item.id, "c1")}
                      </div>
                    )}
                  </button>
                )}
                {activeComment?.itemId === item.id &&
                  activeComment?.field === "c1" &&
                  ReactDOM.createPortal(
                    <div
                      className="bef-comment-popover glass-sandblasted animated-popover"
                      style={{
                        top: commentAnchorRect
                          ? commentAnchorRect.bottom + 10
                          : 0,
                        left: commentAnchorRect
                          ? commentAnchorRect.right - 220
                          : 0,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <textarea
                        placeholder="Add a detailed note for this row..."
                        value={getVal(item.id, "c1")}
                        onChange={(e) =>
                          handleChange(item.id, "c1", e.target.value)
                        }
                        autoFocus
                      />
                      <div className="popover-footer">
                        <button
                          className="popover-done-btn"
                          onClick={() => setActiveComment(null)}
                        >
                          Done
                        </button>
                      </div>
                    </div>,
                    document.body,
                  )}
              </div>
            ) : (
              totalDisplay(item.id)
            )}
          </td>
          {isCompareMode && (
            <>
              <td className="col-compare-total compare-value-cell">
                {valB > 0 ? formatCurrency(valB) : "-"}
              </td>
              <td className={`col-compare-variance compare-value-cell ${getVarianceClass(valA, valB)}`}>
                {valA > 0 || valB > 0 ? formatVariance(valA, valB) : "-"}
              </td>
            </>
          )}
        </tr>
      )}
    </Draggable>
  );
};

export default BudgetRow;
