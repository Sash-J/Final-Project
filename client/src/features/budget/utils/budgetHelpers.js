/**
 * Generate strictly ordered arrays of departments from the budget hierarchy tree.
 * Retains phase information for each department.
 */
export const getSortedDepartments = (hierarchyCache, fallbackDepts) => {
  if (!hierarchyCache) return fallbackDepts || [];
  const arr = [];
  hierarchyCache.forEach(phase => {
    (phase.departments || []).forEach(dept => {
      arr.push({ ...dept, phase_name: phase.phase_name });
    });
  });
  return arr.length > 0 ? arr : fallbackDepts || [];
};

/**
 * Generate strictly ordered arrays of categories from the budget hierarchy tree.
 * Retains phase and department information for each category.
 */
export const getSortedCategories = (hierarchyCache, fallbackCats) => {
  if (!hierarchyCache) return fallbackCats || [];
  const arr = [];
  hierarchyCache.forEach(phase => {
    (phase.departments || []).forEach(dept => {
      (dept.categories || []).forEach(cat => {
        arr.push({ 
          ...cat, 
          department_name: dept.department_name, 
          phase_name: phase.phase_name 
        });
      });
    });
  });
  return arr.length > 0 ? arr : fallbackCats || [];
};
