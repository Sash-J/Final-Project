import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import CompositeBentoCard from "../../../components/common/CompositeBentoCard";
import GlassSurface from "../../../components/common/GlassSurface";
import HoverTooltip from "../../../components/common/HoverTooltip";
import Icon from "../../../components/common/Icon";
import DarkVeil from "../../../components/effects/DarkVeil";
import BreakdownModal from "../../../components/modals/BreakdownModal";
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
      const newData = { ...data, hero: heroForm };
      setData(newData);
      setEditingHero(false);

      if (onSaveStatusChange) onSaveStatusChange("saving");
      try {
        await api.put(`/api/projects/${project.id}/equipment`, {
          equipmentData: { hero: heroForm, heroSecondary: data.heroSecondary },
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
      const newData = { ...data, heroSecondary: heroSecondaryForm };
      setData(newData);
      setEditingHeroSecondary(false);

      if (onSaveStatusChange) onSaveStatusChange("saving");
      try {
        await api.put(`/api/projects/${project.id}/equipment`, {
          equipmentData: { hero: data.hero, heroSecondary: heroSecondaryForm },
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

                  <div className="hero-name-row">
                    {editingHero ? (
                      <input
                        className="hero-inline-input h2-input"
                        value={heroForm.name || ""}
                        placeholder="Camera Name"
                        onChange={(e) =>
                          setHeroForm({ ...heroForm, name: e.target.value })
                        }
                      />
                    ) : (
                      <h2>{data.hero.name}</h2>
                    )}

                    {editingHero ? (
                      <div className="hero-action-buttons">
                        <HoverTooltip text="Save Changes">
                          <button
                            className="project-hero-btn edit hero-action-btn-save"
                            onClick={saveHero}
                          >
                            <Icon name="check" modifiers="sm" />
                          </button>
                        </HoverTooltip>
                        <HoverTooltip text="Cancel">
                          <button
                            className="project-hero-btn delete"
                            onClick={() => setEditingHero(false)}
                          >
                            <Icon name="close" modifiers="sm" />
                          </button>
                        </HoverTooltip>
                      </div>
                    ) : (
                      <>
                        <HoverTooltip text="Edit Camera">
                          <button
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
                      </>
                    )}
                  </div>

                  {editingHero ? (
                    <div className="hero-format-edit-row">
                      <span className="hero-format-label">Resolution:</span>
                      <input
                        className="hero-inline-input p-input format-input"
                        value={heroForm.resolution || ""}
                        placeholder="4K"
                        onChange={(e) =>
                          setHeroForm({
                            ...heroForm,
                            resolution: e.target.value,
                          })
                        }
                      />
                      <span className="hero-format-label spacing">Format:</span>
                      <input
                        className="hero-inline-input p-input format-input"
                        value={heroForm.format || ""}
                        placeholder="RAW"
                        onChange={(e) =>
                          setHeroForm({ ...heroForm, format: e.target.value })
                        }
                      />
                    </div>
                  ) : (
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
                  )}

                  <div className="hero-status">
                    {editingHero ? (
                      <div className="hero-edit-inputs">
                        <input
                          className="hero-inline-input hero-status-input"
                          value={heroForm.status || ""}
                          onChange={(e) =>
                            setHeroForm({ ...heroForm, status: e.target.value })
                          }
                          placeholder="Rental details..."
                        />
                        <input
                          className="hero-inline-input p-input"
                          value={heroForm.image || ""}
                          onChange={(e) =>
                            setHeroForm({ ...heroForm, image: e.target.value })
                          }
                          placeholder="Paste image URL here..."
                        />
                      </div>
                    ) : (
                      <span>{data.hero.status}</span>
                    )}
                  </div>
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

                      <div className="hero-name-row">
                        {editingHeroSecondary ? (
                          <input
                            className="hero-inline-input h2-input secondary"
                            value={heroSecondaryForm.name || ""}
                            placeholder="Camera Name"
                            onChange={(e) =>
                              setHeroSecondaryForm({
                                ...heroSecondaryForm,
                                name: e.target.value,
                              })
                            }
                          />
                        ) : (
                          <h2>{data.heroSecondary.name}</h2>
                        )}

                        {editingHeroSecondary ? (
                          <div className="hero-action-buttons">
                            <HoverTooltip text="Save Changes">
                              <button
                                className="project-hero-btn edit hero-action-btn-save"
                                onClick={saveHeroSecondary}
                              >
                                <Icon name="check" modifiers="sm" />
                              </button>
                            </HoverTooltip>
                            <HoverTooltip text="Cancel">
                              <button
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
                        ) : (
                          <div className="hero-action-buttons">
                            <HoverTooltip text="Edit Camera">
                              <button
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
                        )}
                      </div>

                      {editingHeroSecondary ? (
                        <div className="hero-format-edit-row">
                          <span className="hero-format-label">Resolution:</span>
                          <input
                            className="hero-inline-input p-input format-input"
                            value={heroSecondaryForm.resolution || ""}
                            placeholder="e.g. 4K"
                            onChange={(e) =>
                              setHeroSecondaryForm({
                                ...heroSecondaryForm,
                                resolution: e.target.value,
                              })
                            }
                          />
                          <span className="hero-format-label spacing">
                            Format:
                          </span>
                          <input
                            className="hero-inline-input p-input format-input"
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
                      ) : (
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
                      )}

                      <div className="hero-status">
                        {editingHeroSecondary ? (
                          <div className="hero-edit-inputs">
                            <input
                              className="hero-inline-input hero-status-input"
                              value={heroSecondaryForm.status || ""}
                              onChange={(e) =>
                                setHeroSecondaryForm({
                                  ...heroSecondaryForm,
                                  status: e.target.value,
                                })
                              }
                              placeholder="Rental details..."
                            />
                            <input
                              className="hero-inline-input p-input"
                              value={heroSecondaryForm.image || ""}
                              onChange={(e) =>
                                setHeroSecondaryForm({
                                  ...heroSecondaryForm,
                                  image: e.target.value,
                                })
                              }
                              placeholder="Paste image URL here..."
                            />
                          </div>
                        ) : (
                          <span>{data.heroSecondary.status}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="equipment-grid">
              {data.departments.map((dept) => {
                const { leadName, leadRole } = getDeptLead(dept.name);

                const itemCount = dept.items ? dept.items.length : 0;
                // Calculate height tightly wrapped to content:
                // Pill & Gap (~80px) + Padding (~48px) + Items (~30px each)
                const dynamicHeight = 128 + itemCount * 35;

                return (
                  <div
                    key={dept.id}
                    className="dept-bento-wrapper"
                    style={{ height: `${dynamicHeight}px` }}
                  >
                    <CompositeBentoCard
                      className="summary-bento-card"
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
                          </div>
                        </>
                      }
                      rightContent={
                        <>
                          <div className="summary-bento-top-right">
                            <GlassSurface
                              className="summary-selector"
                              width="100%"
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
