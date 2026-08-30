import { useState, useEffect } from "react";
import { API } from "../../../config";

export const useBudgetAssignments = (externalProjectId, onDirtyChange) => {
  const [projectCrew, setProjectCrew] = useState([]);
  const [deptAssignments, setDeptAssignments] = useState({});
  const [categoryAssignments, setCategoryAssignments] = useState({});
  const [budgetItemAssignments, setBudgetItemAssignments] = useState({});

  const [activeAssignDeptId, setActiveAssignDeptId] = useState(null);
  const [activeAssignCatId, setActiveAssignCatId] = useState(null);
  const [activeAssignItemId, setActiveAssignItemId] = useState(null);
  
  const [isCrewEditing, setIsCrewEditing] = useState(false);

  useEffect(() => {
    setIsCrewEditing(false);
  }, [activeAssignDeptId, activeAssignCatId, activeAssignItemId]);

  useEffect(() => {
    const handleCloseDropdown = () => {
      setActiveAssignDeptId(null);
      setActiveAssignCatId(null);
      setActiveAssignItemId(null);
    };
    document.addEventListener("click", handleCloseDropdown);
    return () => document.removeEventListener("click", handleCloseDropdown);
  }, []);

  useEffect(() => {
    if (!externalProjectId) {
      setProjectCrew([]);
      setDeptAssignments({});
      setCategoryAssignments({});
      setBudgetItemAssignments({});
      return;
    }

    const fetchCrewAndAssignments = async () => {
      try {
        const res = await fetch(`${API}/api/projects/${externalProjectId}/budget-init`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setProjectCrew(data.project_crew || []);
          setDeptAssignments(data.department_crew || {});
          setCategoryAssignments(data.category_crew || {});
          setBudgetItemAssignments(data.budget_item_crew || {});
        }
      } catch (err) {
        console.error("Failed to load crew/assignments", err);
      }
    };

    fetchCrewAndAssignments();
  }, [externalProjectId]);

  const handleAssignCrew = (deptId, userId) => {
    const crewObj = projectCrew.find(c => c.id === userId);
    if (!crewObj) return;

    setDeptAssignments(prev => {
      const currentList = prev[deptId] || [];
      const isAssigned = currentList.some(item => item.id === userId);
      let newList;
      if (isAssigned) {
        newList = currentList.filter(item => item.id !== userId);
      } else {
        newList = [...currentList, crewObj];
      }
      return {
        ...prev,
        [deptId]: newList
      };
    });

    onDirtyChange(true);
  };

  const handleAssignCategoryCrew = (catId, userId) => {
    const crewObj = projectCrew.find(c => c.id === userId);
    if (!crewObj) return;

    setCategoryAssignments(prev => {
      const currentList = prev[catId] || [];
      const isAssigned = currentList.some(item => item.id === userId);
      let newList;
      if (isAssigned) {
        newList = currentList.filter(item => item.id !== userId);
      } else {
        newList = [...currentList, crewObj];
      }
      return {
        ...prev,
        [catId]: newList
      };
    });

    onDirtyChange(true);
  };

  const handleAssignBudgetItemCrew = (itemId, userId) => {
    const crewObj = projectCrew.find(c => c.id === userId);
    if (!crewObj) return;

    setBudgetItemAssignments(prev => {
      const currentList = prev[itemId] || [];
      const isAssigned = currentList.some(item => item.id === userId);
      let newList;
      if (isAssigned) {
        newList = currentList.filter(item => item.id !== userId);
      } else {
        newList = [...currentList, crewObj];
      }
      return {
        ...prev,
        [itemId]: newList
      };
    });

    onDirtyChange(true);
  };

  return {
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
  };
};
