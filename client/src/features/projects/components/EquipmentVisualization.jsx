import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import CompositeBentoCard from "../../../components/common/CompositeBentoCard";
import GlassSurface from "../../../components/effects/GlassSurface";
import HoverTooltip from "../../../components/common/HoverTooltip";
import Icon from "../../../components/common/Icon";
import DarkVeil from "../../../components/effects/DarkVeil";
import BreakdownModal from "../../../components/modals/BreakdownModal";
import FloatingInput from "../../../components/common/FloatingInput";
import api from "../../../services/api";
import "./EquipmentVisualization.css";

const DEFAULT_ART_ITEMS = ["Art rentals", "Weapons & Ammo", "Props"];
const DEFAULT_ELECTRICAL_ITEMS = [
  "Location Rigs",
  "Power",
  "Generator Rentals",
  "Electrical Equipment",
  "Lights",
  "Studio Generators",
];

const equipmentCache = {};
const equipmentDataCache = {};

export const prefetchEquipment = (projectId) => {
  if (!equipmentCache[projectId]) {
    const req = api.get(`/api/projects/${projectId}/equipment_full`);
    equipmentCache[projectId] = req;
    req
      .then((res) => {
        if (res && res.data) {
          equipmentDataCache[projectId] = res.data;
        }
      })
      .catch(() => {});
  }
  return equipmentCache[projectId];
};

const EquipmentVisualization = ({
  project,
  onUpdateEquipment,
  onSaveStatusChange,
}) => {
    const [data, setData] = useState(() => {
      const cachedData = equipmentDataCache[project?.id];
      if (cachedData) {
        return {
          hero: cachedData.hero || {
            label: "Primary Camera",
            name: "Add Camera Name",
            details: "Add camera details...",
            status: "Add rental details...",
          },
          heroSecondary: cachedData.heroSecondary || null,
          departments: cachedData.departments || [],
        };
      }
      return {
        hero: {
          label: "Primary Camera",
          name: "Add Camera Name",
          details: "Add camera details...",
          status: "Add rental details...",
        },
        heroSecondary: null,
        departments: [],
      };
    });

    const [loading, setLoading] = useState(!equipmentDataCache[project?.id]);
    const [editingHero, setEditingHero] = useState(false);
    const [heroForm, setHeroForm] = useState({});
    const [editingHeroSecondary, setEditingHeroSecondary] = useState(false);
    const [heroSecondaryForm, setHeroSecondaryForm] = useState({});

    // Breakdown Modal State
    const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);
    const [selectedItemForBreakdown, setSelectedItemForBreakdown] =
      useState(null);

    const deptLeads = useMemo(() => {
      const leads = {};
      if (!project?.crew_hierarchy_data) return leads;
      try {
        const parsed =
          typeof project.crew_hierarchy_data === "string"
            ? JSON.parse(project.crew_hierarchy_data)
            : project.crew_hierarchy_data;

        const traverse = (node) => {
          if (!node) return;
          if (node.department && node.members && node.members.length > 0) {
            leads[node.department] = {
              leadName: node.members[0].name || "TBD",
              leadRole: node.members[0].role || `${node.department} Dept Lead`,
            };
          }
          if (node.children && Array.isArray(node.children)) {
            for (let child of node.children) {
              traverse(child);
            }
          }
        };
        traverse(parsed);
      } catch (err) {
        console.error("Failed to parse crew hierarchy", err);
      }
      return leads;
    }, [project?.crew_hierarchy_data]);

    const getDeptLead = useCallback(
      (deptName) => {
        if (deptLeads[deptName]) return deptLeads[deptName];
        return { leadName: "TBD", leadRole: `${deptName} Dept Lead` };
      },
      [deptLeads],
    );

    // Ref to prevent race conditions during initialization (e.g. StrictMode double mount)
    const isInitializing = React.useRef(false);

    useEffect(() => {
      fetchData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project]);

    const fetchData = async () => {
      if (!project?.id) return;

      try {
        // Stale-While-Revalidate: If cache exists, use it instantly to avoid loading spinners
        if (equipmentCache[project.id]) {
          const cachedRes = await equipmentCache[project.id];
          if (cachedRes && cachedRes.data) {
            equipmentDataCache[project.id] = cachedRes.data;
            setData((prevData) => ({
              hero: cachedRes.data.hero || prevData.hero,
              heroSecondary: cachedRes.data.heroSecondary || null,
              departments: cachedRes.data.departments || [],
            }));
            setLoading(false); // Stop loading spinner immediately
          }
        } else {
          setLoading(true);
        }

        // Always fetch fresh data in the background
        const freshPromise = api.get(
          `/api/projects/${project.id}/equipment_full`,
        );
        equipmentCache[project.id] = freshPromise; // Update cache with fresh promise

        // Don't block on this if we already loaded from cache!
        // We'll await it to update data, but the UI is already visible.
        const res = await freshPromise;
        if (res && res.data) {
          equipmentDataCache[project.id] = res.data;
        }

        let fetchedDepts = res.data.departments || [];

        // Keep Art, Electrical, and Camera as default departments
        if (fetchedDepts.length === 0 && !isInitializing.current) {
          isInitializing.current = true;
          try {
            const resArt = await api.post(
              `/api/projects/${project.id}/departments`,
              { name: "Art" },
            );
            const resLight = await api.post(
              `/api/projects/${project.id}/departments`,
              { name: "Electrical" },
            );
            const resCamera = await api.post(
              `/api/projects/${project.id}/departments`,
              { name: "Camera" },
            );

            const artItemsPromises = DEFAULT_ART_ITEMS.map((name) =>
              api.post(`/api/departments/${resArt.data.id}/items`, {
                name,
                qty: 1,
              }),
            );
            const artItemsRes = await Promise.all(artItemsPromises);
            resArt.data.items = artItemsRes.map((r) => r.data);

            const elecItemsPromises = DEFAULT_ELECTRICAL_ITEMS.map((name) =>
              api.post(`/api/departments/${resLight.data.id}/items`, {
                name,
                qty: 1,
              }),
            );
            const elecItemsRes = await Promise.all(elecItemsPromises);
            resLight.data.items = elecItemsRes.map((r) => r.data);

            fetchedDepts = [resArt.data, resLight.data, resCamera.data];
          } finally {
            isInitializing.current = false;
          }
        } else if (fetchedDepts.length > 0 && !isInitializing.current) {
          const artDept = fetchedDepts.find((d) => d.name === "Art");
          if (artDept) {
            const existingNames = (artDept.items || []).map((i) => i.name);
            const missingItems = DEFAULT_ART_ITEMS.filter(
              (name) => !existingNames.includes(name),
            );
            if (missingItems.length > 0) {
              isInitializing.current = true;
              try {
                const newItemsPromises = missingItems.map((name) =>
                  api.post(`/api/departments/${artDept.id}/items`, {
                    name,
                    qty: 1,
                  }),
                );
                const newItemsRes = await Promise.all(newItemsPromises);
                artDept.items = [
                  ...(artDept.items || []),
                  ...newItemsRes.map((r) => r.data),
                ];
              } finally {
                isInitializing.current = false;
              }
            }
          }

          const elecDept = fetchedDepts.find((d) => d.name === "Electrical");
          if (elecDept) {
            const existingNames = (elecDept.items || []).map((i) => i.name);
            const missingItems = DEFAULT_ELECTRICAL_ITEMS.filter(
              (name) => !existingNames.includes(name),
            );
            if (missingItems.length > 0) {
              isInitializing.current = true;
              try {
                const newItemsPromises = missingItems.map((name) =>
                  api.post(`/api/departments/${elecDept.id}/items`, {
                    name,
                    qty: 1,
                  }),
                );
                const newItemsRes = await Promise.all(newItemsPromises);
                elecDept.items = [
                  ...(elecDept.items || []),
                  ...newItemsRes.map((r) => r.data),
                ];
              } finally {
                isInitializing.current = false;
              }
            }
          }

          const cameraDept = fetchedDepts.find((d) => d.name === "Camera");
          if (!cameraDept) {
            isInitializing.current = true;
            try {
              const resCamera = await api.post(
                `/api/projects/${project.id}/departments`,
                { name: "Camera" },
              );
              fetchedDepts.push(resCamera.data);
            } finally {
              isInitializing.current = false;
            }
          }
        }

        setData({
          hero: res.data.hero || data.hero,
          heroSecondary: res.data.heroSecondary || null,
          departments: fetchedDepts,
        });
      } catch (err) {
        console.error("Error fetching equipment:", err);
      } finally {
        setLoading(false);
      }
    };

    const notifySave = useCallback(() => {
      if (onUpdateEquipment) onUpdateEquipment();
      if (onSaveStatusChange) {
        onSaveStatusChange("saved");
        setTimeout(() => onSaveStatusChange("hiding"), 2000);
        setTimeout(() => onSaveStatusChange(""), 2500);
      }
    }, [onUpdateEquipment, onSaveStatusChange]);

    const handleError = useCallback(
      (err) => {
        console.error("Failed to save equipment", err);
        if (onSaveStatusChange) onSaveStatusChange("");
        alert("Failed to save equipment data.");
      },
      [onSaveStatusChange],
    );

    const updateItem = useCallback(
      async (deptId, itemId, field, value) => {
        setData((prevData) => {
          const updated = prevData.departments.map((d) => {
            if (d.id === deptId) {
              const updatedItems = d.items.map((i) =>
                i.id === itemId ? { ...i, [field]: value } : i,
              );
              return { ...d, items: updatedItems };
            }
            return d;
          });
          return { ...prevData, departments: updated };
        });

        // Find item to save
        const item = data.departments
          .find((d) => d.id === deptId)
          ?.items.find((i) => i.id === itemId);
        if (!item) return;

        if (onSaveStatusChange) onSaveStatusChange("saving");
        try {
          await api.put(`/api/equipment/${itemId}`, {
            name: field === "name" ? value : item.name,
            qty: field === "qty" ? value : item.qty,
          });
          notifySave();
        } catch (err) {
          handleError(err);
          fetchData();
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [data.departments, onSaveStatusChange, notifySave, handleError],
    );

    const handleOpenBreakdown = useCallback((deptId, item) => {
      setSelectedItemForBreakdown({ deptId, item });
      setBreakdownModalOpen(true);
    }, []);

    const handleSaveBreakdown = useCallback(
      (items, grandTotal) => {
        if (!selectedItemForBreakdown) return;
        const { deptId, item } = selectedItemForBreakdown;
        updateItem(deptId, item.id, "breakdown", items);
        updateItem(deptId, item.id, "total", grandTotal);
      },
      [selectedItemForBreakdown, updateItem],
    );

    const saveHero = useCallback(async () => {
      const name = (heroForm.name || "").trim();
      if (!name) {
        handleError(new Error("Camera name is required."));
        return;
      }
      const cleanHero = { ...heroForm, name };
      const newData = { ...data, hero: cleanHero };
      setData(newData);
      setEditingHero(false);

      if (onSaveStatusChange) onSaveStatusChange("saving");
      try {
        await api.put(`/api/projects/${project.id}/equipment`, {
          equipmentData: { hero: cleanHero, heroSecondary: data.heroSecondary },
        });
        notifySave();
      } catch (err) {
        handleError(err);
      }
    }, [
      data,
      heroForm,
      project?.id,
      onSaveStatusChange,
      notifySave,
      handleError,
    ]);

    const saveHeroSecondary = useCallback(async () => {
      const name = (heroSecondaryForm.name || "").trim();
      if (!name) {
        handleError(new Error("Secondary camera name is required."));
        return;
      }
      const cleanSecondary = { ...heroSecondaryForm, name };
      const newData = { ...data, heroSecondary: cleanSecondary };
      setData(newData);
      setEditingHeroSecondary(false);

      if (onSaveStatusChange) onSaveStatusChange("saving");
      try {
        await api.put(`/api/projects/${project.id}/equipment`, {
          equipmentData: { hero: data.hero, heroSecondary: cleanSecondary },
        });
        notifySave();
      } catch (err) {
        handleError(err);
      }
    }, [
      data,
      heroSecondaryForm,
      project?.id,
      onSaveStatusChange,
      notifySave,
      handleError,
    ]);

    return (
      <div className="equipment-viz-container fade-in">
        {loading ? (
          <>
            <div className="equipment-hero-card glass-card">
              <div className="hero-camera-image skeleton-pulse global-glass-effect"></div>
              <div className="hero-camera-details">
                <div className="skeleton-pulse"></div>
                <div className="skeleton-pulse"></div>
                <div className="skeleton-pulse"></div>
                <div className="skeleton-pulse"></div>
              </div>
            </div>
            <div className="equipment-grid">
              <div className="glass-card">
                <div className="skeleton-pulse"></div>
                <div className="skeleton-pulse"></div>
                <div className="skeleton-pulse"></div>
              </div>
              <div className="glass-card">
                <div className="skeleton-pulse"></div>
                <div className="skeleton-pulse"></div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="equipment-hero-card glass-card">
              <div className="hero-camera-section">
                <div className="hero-camera-image global-glass-effect">
                  {(editingHero ? heroForm.image : data.hero.image) ? (
                    <img
                      src={editingHero ? heroForm.image : data.hero.image}
                      alt="Primary Camera"
                    />
                  ) : (
                    <Icon name="videocam" modifiers="xl" />
                  )}
                </div>
                <div className="hero-camera-details">
                  <span className="hero-label">{data.hero.label}</span>

                  {editingHero ? (
                    <div className="hero-edit-form">
                      <div className="hero-name-edit-wrap">
                        <FloatingInput
                          label="Camera Name"
                          value={heroForm.name || ""}
                          placeholder="e.g. Sony FX III"
                          onChange={(e) =>
                            setHeroForm({ ...heroForm, name: e.target.value })
                          }
                          required
                        />
                        <div className="hero-action-buttons">
                          <HoverTooltip text="Save Changes">
                            <button
                              type="button"
                              className="project-hero-btn edit hero-action-btn-save"
                              onClick={saveHero}
                            >
                              <Icon name="check" modifiers="sm" />
                            </button>
                          </HoverTooltip>
                          <HoverTooltip text="Cancel">
                            <button
                              type="button"
                              className="project-hero-btn delete"
                              onClick={() => setEditingHero(false)}
                            >
                              <Icon name="close" modifiers="sm" />
                            </button>
                          </HoverTooltip>
                        </div>
                      </div>

                      <div className="hero-format-grid">
                        <FloatingInput
                          label="Resolution"
                          value={heroForm.resolution || ""}
                          placeholder="e.g. 4K"
                          onChange={(e) =>
                            setHeroForm({
                              ...heroForm,
                              resolution: e.target.value,
                            })
                          }
                        />
                        <FloatingInput
                          label="Format"
                          value={heroForm.format || ""}
                          placeholder="e.g. RAW"
                          onChange={(e) =>
                            setHeroForm({ ...heroForm, format: e.target.value })
                          }
                        />
                      </div>

                      <FloatingInput
                        label="Rental Details / Provider"
                        value={heroForm.status || ""}
                        placeholder="e.g. Pathi Camera Rental"
                        onChange={(e) =>
                          setHeroForm({ ...heroForm, status: e.target.value })
                        }
                      />

                      <FloatingInput
                        label="Image URL (Optional)"
                        value={heroForm.image || ""}
                        placeholder="https://..."
                        onChange={(e) =>
                          setHeroForm({ ...heroForm, image: e.target.value })
                        }
                      />
                    </div>
                  ) : (
                    <>
                      <div className="hero-name-row">
                        <h2>{data.hero.name}</h2>
                        <div className="hero-action-buttons">
                          <HoverTooltip text="Edit Camera">
                            <button
                              type="button"
                              className="project-hero-btn edit"
                              onClick={() => {
                                setHeroForm(data.hero);
                                setEditingHero(true);
                                setEditingHeroSecondary(false);
                              }}
                            >
                              <Icon name="edit" modifiers="sm" />
                            </button>
                          </HoverTooltip>
                          {!data.heroSecondary && (
                            <HoverTooltip text="Add Secondary Camera">
                              <button
                                type="button"
                                className="project-hero-btn edit add-secondary"
                                onClick={() => {
                                  const newSecondary = {
                                    label: "Secondary Camera",
                                    name: "Add Camera Name",
                                    details: "Add camera details...",
                                    status: "Add rental details...",
                                  };
                                  setData({
                                    ...data,
                                    heroSecondary: newSecondary,
                                  });
                                  setHeroSecondaryForm(newSecondary);
                                  setEditingHeroSecondary(true);
                                  setEditingHero(false);
                                }}
                              >
                                <Icon name="add" modifiers="sm" />
                              </button>
                            </HoverTooltip>
                          )}
                        </div>
                      </div>

                      <div className="hero-format-display-row">
                        <span className="hero-format-text">
                          Resolution:{" "}
                          <strong className="hero-format-value">
                            {data.hero.resolution || "N/A"}
                          </strong>
                        </span>
                        <span className="hero-format-divider">|</span>
                        <span className="hero-format-text">
                          Format:{" "}
                          <strong className="hero-format-value">
                            {data.hero.format || "N/A"}
                          </strong>
                        </span>
                      </div>

                      <div className="hero-status">
                        <span>{data.hero.status}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {data.heroSecondary && (
                <>
                  <div className="hero-divider"></div>
                  <div className="hero-camera-section secondary">
                    <div className="hero-camera-image global-glass-effect">
                      <Icon name="videocam" modifiers="xl" />
                    </div>
                    <div className="hero-camera-details">
                      <span className="hero-label">
                        {data.heroSecondary.label}
                      </span>

                      {editingHeroSecondary ? (
                        <div className="hero-edit-form">
                          <div className="hero-name-edit-wrap">
                            <FloatingInput
                              label="Camera Name"
                              value={heroSecondaryForm.name || ""}
                              placeholder="e.g. Secondary Camera"
                              onChange={(e) =>
                                setHeroSecondaryForm({
                                  ...heroSecondaryForm,
                                  name: e.target.value,
                                })
                              }
                              required
                            />
                            <div className="hero-action-buttons">
                              <HoverTooltip text="Save Changes">
                                <button
                                  type="button"
                                  className="project-hero-btn edit hero-action-btn-save"
                                  onClick={saveHeroSecondary}
                                >
                                  <Icon name="check" modifiers="sm" />
                                </button>
                              </HoverTooltip>
                              <HoverTooltip text="Cancel">
                                <button
                                  type="button"
                                  className="project-hero-btn delete"
                                  onClick={() => {
                                    if (
                                      data.heroSecondary.name ===
                                      "Add Camera Name"
                                    ) {
                                      setData({ ...data, heroSecondary: null });
                                    }
                                    setEditingHeroSecondary(false);
                                  }}
                                >
                                  <Icon name="close" modifiers="sm" />
                                </button>
                              </HoverTooltip>
                            </div>
                          </div>

                          <div className="hero-format-grid">
                            <FloatingInput
                              label="Resolution"
                              value={heroSecondaryForm.resolution || ""}
                              placeholder="e.g. 4K"
                              onChange={(e) =>
                                setHeroSecondaryForm({
                                  ...heroSecondaryForm,
                                  resolution: e.target.value,
                                })
                              }
                            />
                            <FloatingInput
                              label="Format"
                              value={heroSecondaryForm.format || ""}
                              placeholder="e.g. RAW"
                              onChange={(e) =>
                                setHeroSecondaryForm({
                                  ...heroSecondaryForm,
                                  format: e.target.value,
                                })
                              }
                            />
                          </div>

                          <FloatingInput
                            label="Rental Details / Provider"
                            value={heroSecondaryForm.status || ""}
                            placeholder="e.g. Rental details..."
                            onChange={(e) =>
                              setHeroSecondaryForm({
                                ...heroSecondaryForm,
                                status: e.target.value,
                              })
                            }
                          />

                          <FloatingInput
                            label="Image URL (Optional)"
                            value={heroSecondaryForm.image || ""}
                            placeholder="https://..."
                            onChange={(e) =>
                              setHeroSecondaryForm({
                                ...heroSecondaryForm,
                                image: e.target.value,
                              })
                            }
                          />
                        </div>
                      ) : (
                        <>
                          <div className="hero-name-row">
                            <h2>{data.heroSecondary.name}</h2>
                            <div className="hero-action-buttons">
                              <HoverTooltip text="Edit Camera">
                                <button
                                  type="button"
                                  className="project-hero-btn edit"
                                  onClick={() => {
                                    setHeroSecondaryForm(data.heroSecondary);
                                    setEditingHeroSecondary(true);
                                    setEditingHero(false);
                                  }}
                                >
                                  <Icon name="edit" modifiers="sm" />
                                </button>
                              </HoverTooltip>
                              <HoverTooltip text="Remove Camera">
                                <button
                                  type="button"
                                  className="project-hero-btn delete"
                                  onClick={async () => {
                                    const newData = {
                                      ...data,
                                      heroSecondary: null,
                                    };
                                    setData(newData);
                                    if (onSaveStatusChange)
                                      onSaveStatusChange("saving");
                                    try {
                                      await api.put(
                                        `/api/projects/${project.id}/equipment`,
                                        {
                                          equipmentData: {
                                            hero: data.hero,
                                            heroSecondary: null,
                                          },
                                        },
                                      );
                                      notifySave();
                                    } catch (err) {
                                      handleError(err);
                                    }
                                  }}
                                >
                                  <Icon name="delete" modifiers="sm" />
                                </button>
                              </HoverTooltip>
                            </div>
                          </div>

                          <div className="hero-format-display-row">
                            <span className="hero-format-text">
                              Resolution:{" "}
                              <strong className="hero-format-value">
                                {data.heroSecondary.resolution || "N/A"}
                              </strong>
                            </span>
                            <span className="hero-format-divider">|</span>
                            <span className="hero-format-text">
                              Format:{" "}
                              <strong className="hero-format-value">
                                {data.heroSecondary.format || "N/A"}
                              </strong>
                            </span>
                          </div>

                          <div className="hero-status">
                            <span>{data.heroSecondary.status}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="equipment-grid">
              {data.departments.map((dept) => {
                const { leadName, leadRole } = getDeptLead(dept.name);
                return (
                  <div
                    key={dept.id}
                    className="dept-bento-wrapper"
                  >
                    <CompositeBentoCard
                      singleOverlay={true}
                      pillClassName=""
                      overlayComponent={<DarkVeil globalSync={true} />}
                      pillContent={
                        <>
                          <div className="dept-title-container">
                            <div className="dept-title-text">
                              <span className="dept-title-main">
                                {dept.name}
                              </span>
                              <span className="dept-title-sub">Department</span>
                            </div>
                          </div>
                        </>
                      }
                      bottomContent={
                        <>
                          <div className="dept-bento-content-scroll">
                            {(dept.items || []).length > 0 ? (
                              <ul className="equipment-list">
                                {(dept.items || []).map((item) => {
                                return (
                                  <li key={item.id} className="equipment-item">
                                    <div
                                      className="eq-item-content clickable-item"
                                      onClick={() =>
                                        handleOpenBreakdown(dept.id, item)
                                      }
                                    >
                                      <span className="eq-item-name-text">
                                        {item.name}
                                      </span>
                                      <div className="eq-qty-wrap">
                                        <span>Qty:</span>
                                        <span className="eq-qty-text">
                                          {item.qty}
                                        </span>
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                            ) : (
                              <div className="dept-empty-items">
                                <Icon name="inventory_2" modifiers="sm" />
                                <span>No equipment assigned</span>
                              </div>
                            )}
                          </div>
                        </>
                      }
                      rightContent={
                        <>
                          <div className="summary-bento-top-right">
                            <GlassSurface
                              className="summary-selector"
                              width="max-content"
                              height="auto"
                              borderRadius="20px"
                              blur={8}
                              opacity={0.4}
                              backgroundOpacity={0.2}
                            >
                              <div className="summary-selector-icon">
                                <Icon name="groups" modifiers="sm" />
                              </div>
                              <div className="eq-summary-lead-text">
                                <span className="eq-summary-lead-name">
                                  {leadName}
                                </span>
                                <span className="eq-summary-lead-role">
                                  {leadRole}
                                </span>
                              </div>
                              <Icon name="expand_more" modifiers="sm" />
                            </GlassSurface>
                          </div>
                        </>
                      }
                    />
                  </div>
                );
              })}
            </div>

            <BreakdownModal
              isOpen={breakdownModalOpen}
              onClose={() => {
                setBreakdownModalOpen(false);
                setSelectedItemForBreakdown(null);
              }}
              onSave={handleSaveBreakdown}
              initialItems={selectedItemForBreakdown?.item?.breakdown || []}
              itemName={selectedItemForBreakdown?.item?.name || ""}
            />
          </>
        )}
      </div>
    );
  };

export default EquipmentVisualization;
