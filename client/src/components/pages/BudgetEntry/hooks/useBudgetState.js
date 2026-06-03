import { useEffect, useRef, useState } from "react";

export const useBudgetState = ({
  externalProjectId,
  versionId,
  refreshKey,
  onDirtyChange,
  hierarchyCache,
  getBudgetData,
}) => {
  const [hierarchy, setHierarchy] = useState([]);
  const [expandedPhases, setExpandedPhases] = useState(new Set([2]));
  const [collapsedDepts, setCollapsedDepts] = useState(new Set());
  const [values, setValues] = useState({});

  const [activeComment, setActiveComment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [breakdownData, setBreakdownData] = useState({});
  const [activeBreakdownId, setActiveBreakdownId] = useState(null);
  const [activeBreakdownItem, setActiveBreakdownItem] = useState(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingDisableId, setPendingDisableId] = useState(null);
  const [commentAnchorRect, setCommentAnchorRect] = useState(null);
  const [focusedInput, setFocusedInput] = useState(null);

  const initialDataRef = useRef(null);

  useEffect(() => {
    if (!externalProjectId) {
      setHierarchy([]);
      setValues({});
      setBreakdownData({});
      return;
    }

    const loadBudget = async () => {
      setLoading(true);
      setStatus(null);
      try {
        if (hierarchyCache) {
          setHierarchy(hierarchyCache);
        }

        if (!versionId) {
          setValues({});
          setBreakdownData({});
          initialDataRef.current = { values: "{}", breakdowns: "{}" };
          onDirtyChange(false);
          setLoading(false);
          return;
        }

        const data = await getBudgetData(externalProjectId, versionId);
        if (data.hierarchy) {
          setHierarchy(data.hierarchy);
        }
        
        const serverValues = data.values || {};
        const initialValues = {};

        Object.keys(serverValues).forEach((itemId) => {
          const idNum = parseInt(itemId);
          const rowData = serverValues[itemId];
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
        });

        setValues(initialValues);
        setBreakdownData(data.breakdowns || {});

        initialDataRef.current = {
          values: JSON.stringify(initialValues),
          breakdowns: JSON.stringify(data.breakdowns || {}),
        };
        onDirtyChange(false);
      } catch (err) {
        console.error("BudgetEntryForm: Failed to load budget data", err);
        setStatus({
          type: "error",
          text: "Failed to load budget data from cache.",
        });
      } finally {
        setLoading(false);
      }
    };

    loadBudget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalProjectId, versionId, refreshKey, onDirtyChange]);

  //Budget unsaved changes tracking
  useEffect(() => {
    if (!initialDataRef.current) return;

    const isValuesDirty =
      initialDataRef.current.values !== JSON.stringify(values);
    const isBreakdownsDirty =
      initialDataRef.current.breakdowns !== JSON.stringify(breakdownData);

    onDirtyChange(isValuesDirty || isBreakdownsDirty);
  }, [values, breakdownData, onDirtyChange]);

  const togglePhase = (phaseId) => {
    const next = new Set(expandedPhases);
    if (next.has(phaseId)) next.delete(phaseId);
    else next.add(phaseId);
    setExpandedPhases(next);
  };

  const toggleDept = (deptId) => {
    setCollapsedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  };

  const getVal = (itemId, field) => {
    if (field === "all") return values[itemId] || {};
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

  return {
    hierarchy, setHierarchy,
    expandedPhases, setExpandedPhases, togglePhase,
    collapsedDepts, setCollapsedDepts, toggleDept,
    values, setValues, getVal, handleChange,
    activeComment, setActiveComment,
    loading, setLoading,
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
  };
};
