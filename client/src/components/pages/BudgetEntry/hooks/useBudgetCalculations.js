import { formatCurrency } from "../../../../utils/currencyUtils";

export const useBudgetCalculations = (values, hierarchy) => {
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

  //If itemized take itemaized total
  const totalRaw = (itemId) => {
    const itemValues = values[itemId] || {};
    if (itemValues.is_itemized) return parseFloat(itemValues.total) || 0;
    return calcItemTotal(itemValues);
  };

  const getCategorySubtotal = (category) => {
    return (category.items || []).reduce(
      (sum, item) => sum + totalRaw(item.id),
      0,
    );
  };

  const getDeptSubtotal = (dept) => {
    return (dept.categories || []).reduce((sum, cat) => {
      return sum + getCategorySubtotal(cat);
    }, 0);
  };

  const grossDisplay = (itemId) => grossRaw(itemId);

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

  return {
    calcGross,
    calcItemTotal,
    grossRaw,
    totalRaw,
    getCategorySubtotal,
    getDeptSubtotal,
    grossDisplay,
    totalDisplay,
    getPhaseSubtotal,
    grandTotal,
  };
};
