import React, { createContext, useContext, useState, useCallback } from "react";
import { API } from "../config";

const ProjectContext = createContext();

//Code helping from OpenAI and Google
export const ProjectProvider = ({ children }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);

  const [detailsCache, setDetailsCache] = useState({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [budgetCache, setBudgetCache] = useState({});
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [paymentsCache, setPaymentsCache] = useState({});
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const [milestonesCache, setMilestonesCache] = useState({});
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [hierarchyCache, setHierarchyCache] = useState(null);
  const [phasesCache, setPhasesCache] = useState(null);
  const [deptsCache, setDeptsCache] = useState(null);
  const [catsCache, setCatsCache] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);

  const [versionsCache, setVersionsCache] = useState({});
  const [versionsLoading, setVersionsLoading] = useState(false);

  const refreshProjects = useCallback(
    async (force = false) => {
      if (isCached && !force) return;
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/projects`, {
          credentials: "include",
        });
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
        setIsCached(true);
      } catch (err) {
        console.error("ProjectContext: Failed to fetch projects", err);
      } finally {
        setLoading(false);
      }
    },
    [isCached],
  );

  const getProjectDetails = useCallback(
    async (projectId, force = false) => {
      if (detailsCache[projectId] && !force) return detailsCache[projectId];

      setDetailsLoading(true);
      try {
        const res = await fetch(`${API}/api/projects/${projectId}`, {
          credentials: "include",
        });
        const data = await res.json();

        setDetailsCache((prev) => ({ ...prev, [projectId]: data }));
        return data;
      } catch (err) {
        console.error(
          `ProjectContext: Failed to fetch details for ${projectId}`,
          err,
        );
      } finally {
        setDetailsLoading(false);
      }
    },
    [detailsCache],
  );

  const getProjectPayments = useCallback(
    async (projectId, force = false) => {
      if (paymentsCache[projectId] && !force) return paymentsCache[projectId];

      setPaymentsLoading(true);
      try {
        const res = await fetch(`${API}/api/projects/${projectId}/payments`, {
          credentials: "include",
        });
        const data = await res.json();

        setPaymentsCache((prev) => ({ ...prev, [projectId]: data }));
        return data;
      } catch (err) {
        console.error(
          `ProjectContext: Failed to fetch payments for ${projectId}`,
          err,
        );
      } finally {
        setPaymentsLoading(false);
      }
    },
    [paymentsCache],
  );

  const getProjectMilestones = useCallback(
    async (projectId, force = false) => {
      if (milestonesCache[projectId] && !force)
        return milestonesCache[projectId];

      setMilestonesLoading(true);
      try {
        const res = await fetch(`${API}/api/projects/${projectId}/milestones`, {
          credentials: "include",
        });
        const data = await res.json();

        setMilestonesCache((prev) => ({ ...prev, [projectId]: data }));
        return data;
      } catch (err) {
        console.error(
          `ProjectContext: Failed to fetch milestones for ${projectId}`,
          err,
        );
        return [];
      } finally {
        setMilestonesLoading(false);
      }
    },
    [milestonesCache],
  );

  const recordPayment = useCallback(
    async (projectId, paymentData) => {
      try {
        const res = await fetch(`${API}/api/projects/${projectId}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(paymentData),
          credentials: "include",
        });
        const data = await res.json();

        if (res.ok) {
          await getProjectPayments(projectId, true);
          await getProjectDetails(projectId, true);
          return { success: true, id: data.id };
        }
        return { success: false, error: data.error };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [getProjectPayments, getProjectDetails],
  );

  const getBudgetMetadata = useCallback(
    async (force = false) => {
      if (hierarchyCache && phasesCache && deptsCache && catsCache && !force) {
        return {
          hierarchy: hierarchyCache,
          phases: phasesCache,
          depts: deptsCache,
          cats: catsCache,
        };
      }

      setMetaLoading(true);
      try {
        const fetchOptions = { credentials: "include" };
        const [hRes, pRes, dRes, cRes] = await Promise.all([
          fetch(`${API}/api/hierarchy`, fetchOptions),
          fetch(`${API}/api/phases`, fetchOptions),
          fetch(`${API}/api/departments`, fetchOptions),
          fetch(`${API}/api/categories`, fetchOptions),
        ]);

        const hData = await hRes.json();
        const pData = await pRes.json();
        const dData = await dRes.json();
        const cData = await cRes.json();

        setHierarchyCache(hData);
        setPhasesCache(pData);
        setDeptsCache(dData);
        setCatsCache(cData);

        return { hierarchy: hData, phases: pData, depts: dData, cats: cData };
      } catch (err) {
        console.error("ProjectContext: Failed to fetch budget metadata", err);
      } finally {
        setMetaLoading(false);
      }
    },
    [hierarchyCache, phasesCache, deptsCache, catsCache],
  );

  const getBudgetVersions = useCallback(
    async (projectId, force = false) => {
      if (versionsCache[projectId] && !force) return versionsCache[projectId];

      setVersionsLoading(true);
      try {
        const res = await fetch(
          `${API}/api/projects/${projectId}/budget-versions`,
          { credentials: "include" },
        );
        const data = await res.json();
        const vData = Array.isArray(data) ? data : [];

        setVersionsCache((prev) => ({ ...prev, [projectId]: vData }));
        return vData;
      } catch (err) {
        console.error(
          `ProjectContext: Failed to fetch versions for project ${projectId}`,
          err,
        );
        return [];
      } finally {
        setVersionsLoading(false);
      }
    },
    [versionsCache],
  );

  const getBudgetData = useCallback(
    async (projectId, versionId, force = false) => {
      const projectCache = budgetCache[projectId] || {};
      if (projectCache[versionId] && !force) return projectCache[versionId];

      setBudgetLoading(true);
      try {
        const fetchOptions = { credentials: "include" };

        const [meta, vRes] = await Promise.all([
          getBudgetMetadata(force),
          fetch(
            `${API}/api/budget-values/project/${projectId}?version_id=${versionId}`,
            fetchOptions,
          ),
        ]);

        const vData = await vRes.json();

        const values = vData && !vData.error ? vData : {};
        const breakdownData = {};

        const itemizedIds = Object.keys(values).filter(
          (itemId) => !!values[itemId].is_itemized,
        );

        if (itemizedIds.length > 0) {
          await Promise.all(
            itemizedIds.map(async (itemId) => {
              try {
                const res = await fetch(
                  `${API}/api/budget-values/breakdown?project_id=${projectId}&version_id=${versionId}&item_id=${itemId}`,
                  fetchOptions,
                );
                if (res.ok) {
                  const bds = await res.json();
                  breakdownData[itemId] = bds;
                }
              } catch (e) {
                console.error(
                  `ProjectContext: Failed to fetch breakdown for item ${itemId}`,
                  e,
                );
              }
            }),
          );
        }

        const result = {
          hierarchy: meta.hierarchy,
          values: values,
          breakdowns: breakdownData,
        };

        setBudgetCache((prev) => ({
          ...prev,
          [projectId]: {
            ...(prev[projectId] || {}),
            [versionId]: result,
          },
        }));
        return result;
      } catch (err) {
        console.error("ProjectContext: Error caching budget data", err);
      } finally {
        setBudgetLoading(false);
      }
    },
    [budgetCache],
  );

  const invalidateCache = useCallback((projectId = null) => {
    setIsCached(false);
    if (projectId) {
      setDetailsCache((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
      setBudgetCache((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
      setPaymentsCache((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
      setMilestonesCache({});
      setHierarchyCache(null);
      setPhasesCache(null);
      setDeptsCache(null);
      setCatsCache(null);
      setVersionsCache({});
    }
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        loading,
        refreshProjects,

        detailsCache,
        detailsLoading,
        getProjectDetails,

        paymentsCache,
        paymentsLoading,
        getProjectPayments,
        recordPayment,

        budgetCache,
        budgetLoading,
        getBudgetData,

        hierarchyCache,
        phasesCache,
        deptsCache,
        catsCache,
        metaLoading,
        getBudgetMetadata,

        versionsCache,
        versionsLoading,
        getBudgetVersions,

        milestonesCache,
        milestonesLoading,
        getProjectMilestones,

        invalidateCache,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProjects must be used within a ProjectProvider");
  }
  return context;
};
