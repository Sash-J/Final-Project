import { API } from "../../../config";

export const useBudgetDragAndDrop = (hierarchy, setHierarchy, invalidateHierarchyCache) => {
  const onDragEnd = async (result) => {
    const { source, destination, type } = result;
    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const newHierarchy = JSON.parse(JSON.stringify(hierarchy));

    // Department drag
    if (type === "DEPARTMENT") {
      if (source.droppableId !== destination.droppableId) return;

      const phaseId = parseInt(source.droppableId.replace("phase-", ""));
      const phaseIdx = newHierarchy.findIndex((p) => p.phase_id === phaseId);
      if (phaseIdx === -1) return;

      const newDepts = Array.from(newHierarchy[phaseIdx].departments);
      const [removed] = newDepts.splice(source.index, 1);
      newDepts.splice(destination.index, 0, removed);

      newHierarchy[phaseIdx].departments = newDepts;
      setHierarchy(newHierarchy);

      try {
        const orderedIds = newDepts.map((d) => d.id);
        const res = await fetch(`${API}/api/departments/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ordered_ids: orderedIds }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to reorder departments");
        }
        invalidateHierarchyCache();
      } catch (err) {
        console.error("Failed to persist department order:", err);
      }
      return;
    }

    //Category drag
    if (type === "CATEGORY") {
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
        const res = await fetch(`${API}/api/categories/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ordered_ids: orderedIds }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to reorder categories");
        }
        invalidateHierarchyCache();
      } catch (err) {
        console.error("Failed to persist category order:", err);
      }
      return;
    }

    //Item dragging
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
      const res = await fetch(`${API}/api/budget-items/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to reorder budget items");
      }
      invalidateHierarchyCache();
    } catch (err) {
      console.error("Failed to persist item order:", err);
    }
  };

  return { onDragEnd };
};
