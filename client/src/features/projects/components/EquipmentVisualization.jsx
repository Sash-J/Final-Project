import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import Icon from "../../../components/common/Icon";
import HoverTooltip from "../../../components/common/HoverTooltip";
import api from "../../../services/api";
import "./EquipmentVisualization.css";

const EquipmentVisualization = forwardRef(
  ({ project, onUpdateEquipment, onSaveStatusChange }, ref) => {
    const [data, setData] = useState({
      hero: {
        label: "Primary Camera",
        name: "Add Camera Name",
        details: "Add camera details...",
        status: "Add rental details...",
      },
      heroSecondary: null,
      departments: [],
    });

    const [loading, setLoading] = useState(true);
    const [editingHero, setEditingHero] = useState(false);
    const [heroForm, setHeroForm] = useState({});
    const [editingHeroSecondary, setEditingHeroSecondary] = useState(false);
    const [heroSecondaryForm, setHeroSecondaryForm] = useState({});

    useEffect(() => {
      fetchData();
    }, [project]);

    const fetchData = async () => {
      if (!project?.id) return;
      setLoading(true);
      try {
        const res = await api.get(`/api/projects/${project.id}/equipment_full`);
        setData({
          hero: res.data.hero || data.hero,
          heroSecondary: res.data.heroSecondary || null,
          departments: res.data.departments || [],
        });
      } catch (err) {
        console.error("Error fetching equipment:", err);
      } finally {
        setLoading(false);
      }
    };

    const notifySave = () => {
      if (onUpdateEquipment) onUpdateEquipment();
      if (onSaveStatusChange) {
        onSaveStatusChange("saved");
        setTimeout(() => onSaveStatusChange("hiding"), 2000);
        setTimeout(() => onSaveStatusChange(""), 2500);
      }
    };

    const handleError = (err) => {
      console.error("Failed to save equipment", err);
      if (onSaveStatusChange) onSaveStatusChange("");
      alert("Failed to save equipment data.");
    };

    useImperativeHandle(ref, () => ({
      addDepartment,
    }));

    const addDepartment = async () => {
      if (!project?.id) return;
      if (onSaveStatusChange) onSaveStatusChange("saving");
      try {
        const res = await api.post(`/api/projects/${project.id}/departments`, {
          name: "New Department",
        });
        setData({ ...data, departments: [...data.departments, res.data] });
        notifySave();
      } catch (err) {
        handleError(err);
      }
    };

    const updateDepartmentName = async (deptId, newName) => {
      // Optimistic update
      const updated = data.departments.map((d) =>
        d.id === deptId ? { ...d, name: newName } : d,
      );
      setData({ ...data, departments: updated });

      if (onSaveStatusChange) onSaveStatusChange("saving");
      try {
        await api.put(`/api/departments/${deptId}`, { name: newName });
        notifySave();
      } catch (err) {
        handleError(err);
        fetchData(); // revert
      }
    };

    const removeDepartment = async (deptId) => {
      if (window.confirm("Are you sure you want to remove this department?")) {
        const updated = data.departments.filter((d) => d.id !== deptId);
        setData({ ...data, departments: updated });
        if (onSaveStatusChange) onSaveStatusChange("saving");
        try {
          await api.delete(`/api/departments/${deptId}`);
          notifySave();
        } catch (err) {
          handleError(err);
          fetchData();
        }
      }
    };

    const addItem = async (deptId) => {
      if (onSaveStatusChange) onSaveStatusChange("saving");
      try {
        const res = await api.post(`/api/departments/${deptId}/items`, {
          name: "New Equipment",
          qty: 1,
        });
        const updated = data.departments.map((d) => {
          if (d.id === deptId)
            return { ...d, items: [...(d.items || []), res.data] };
          return d;
        });
        setData({ ...data, departments: updated });
        notifySave();
      } catch (err) {
        handleError(err);
      }
    };

    const updateItem = async (deptId, itemId, field, value) => {
      const updated = data.departments.map((d) => {
        if (d.id === deptId) {
          const updatedItems = d.items.map((i) =>
            i.id === itemId ? { ...i, [field]: value } : i,
          );
          return { ...d, items: updatedItems };
        }
        return d;
      });
      setData({ ...data, departments: updated });

      const item = updated
        .find((d) => d.id === deptId)
        ?.items.find((i) => i.id === itemId);
      if (!item) return;

      if (onSaveStatusChange) onSaveStatusChange("saving");
      try {
        await api.put(`/api/equipment/${itemId}`, {
          name: item.name,
          qty: item.qty,
        });
        notifySave();
      } catch (err) {
        handleError(err);
        fetchData();
      }
    };

    const removeItem = async (deptId, itemId) => {
      const updated = data.departments.map((d) => {
        if (d.id === deptId) {
          return { ...d, items: d.items.filter((i) => i.id !== itemId) };
        }
        return d;
      });
      setData({ ...data, departments: updated });
      if (onSaveStatusChange) onSaveStatusChange("saving");
      try {
        await api.delete(`/api/equipment/${itemId}`);
        notifySave();
      } catch (err) {
        handleError(err);
        fetchData();
      }
    };

    const saveHero = async () => {
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
    };

    const saveHeroSecondary = async () => {
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
    };

    return (
      <div className="equipment-viz-container fade-in">
        {loading ? (
          <>
            <div
              className="equipment-hero-card glass-card"
              style={{ opacity: 0.7 }}
            >
              <div
                className="hero-camera-image skeleton-pulse global-glass-effect"
                style={{ width: 64, height: 64, borderRadius: "15%" }}
              ></div>
              <div className="hero-camera-details">
                <div
                  className="skeleton-pulse"
                  style={{
                    width: "100px",
                    height: "14px",
                    marginBottom: "12px",
                    borderRadius: "4px",
                  }}
                ></div>
                <div
                  className="skeleton-pulse"
                  style={{
                    width: "200px",
                    height: "28px",
                    marginBottom: "16px",
                    borderRadius: "4px",
                  }}
                ></div>
                <div
                  className="skeleton-pulse"
                  style={{
                    width: "300px",
                    height: "14px",
                    marginBottom: "24px",
                    borderRadius: "4px",
                  }}
                ></div>
                <div
                  className="skeleton-pulse"
                  style={{
                    width: "120px",
                    height: "14px",
                    borderRadius: "4px",
                  }}
                ></div>
              </div>
            </div>
            <div className="equipment-grid">
              <div
                className="equipment-category glass-card"
                style={{ height: "250px", opacity: 0.5 }}
              >
                <div
                  className="skeleton-pulse"
                  style={{
                    width: "150px",
                    height: "24px",
                    margin: "20px",
                    borderRadius: "4px",
                  }}
                ></div>
                <div
                  className="skeleton-pulse"
                  style={{
                    width: "90%",
                    height: "40px",
                    margin: "0 20px 10px",
                    borderRadius: "8px",
                  }}
                ></div>
                <div
                  className="skeleton-pulse"
                  style={{
                    width: "90%",
                    height: "40px",
                    margin: "0 20px",
                    borderRadius: "8px",
                  }}
                ></div>
              </div>
              <div
                className="equipment-category glass-card"
                style={{ height: "250px", opacity: 0.5 }}
              >
                <div
                  className="skeleton-pulse"
                  style={{
                    width: "150px",
                    height: "24px",
                    margin: "20px",
                    borderRadius: "4px",
                  }}
                ></div>
                <div
                  className="skeleton-pulse"
                  style={{
                    width: "90%",
                    height: "40px",
                    margin: "0 20px 10px",
                    borderRadius: "8px",
                  }}
                ></div>
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
                        style={{ flex: 1, minWidth: '150px' }}
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
                      <span className="hero-format-label">Format:</span>
                      <input
                        className="hero-inline-input p-input format-input"
                        value={heroForm.format || ""}
                        placeholder="RAW"
                        onChange={(e) =>
                          setHeroForm({ ...heroForm, format: e.target.value })
                        }
                      />
                      <span className="hero-format-label spacing">
                        Resolution:
                      </span>
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
                    </div>
                  ) : (
                    <div className="hero-format-display-row">
                      <span className="hero-format-text">
                        Format:{" "}
                        <strong className="hero-format-value">
                          {data.hero.format || "N/A"}
                        </strong>
                      </span>
                      <span className="hero-format-divider">|</span>
                      <span className="hero-format-text">
                        Resolution:{" "}
                        <strong className="hero-format-value">
                          {data.hero.resolution || "N/A"}
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
                            className="hero-inline-input h2-input"
                            style={{ flex: 1, minWidth: '100px' }}
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
                          <span className="hero-format-label">Format:</span>
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
                          <span className="hero-format-label spacing">
                            Resolution:
                          </span>
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
                        </div>
                      ) : (
                        <div className="hero-format-display-row">
                          <span className="hero-format-text">
                            Format:{" "}
                            <strong className="hero-format-value">
                              {data.heroSecondary.format || "N/A"}
                            </strong>
                          </span>
                          <span className="hero-format-divider">|</span>
                          <span className="hero-format-text">
                            Resolution:{" "}
                            <strong className="hero-format-value">
                              {data.heroSecondary.resolution || "N/A"}
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
              {data.departments.map((dept) => (
                <div key={dept.id} className="equipment-category glass-card">
                  <div className="cat-header editable-cat-header">
                    <Icon name="inventory_2" modifiers="sm" />
                    <input
                      className="dept-name-input"
                      value={dept.name}
                      onChange={(e) =>
                        updateDepartmentName(dept.id, e.target.value)
                      }
                      placeholder="Department Name"
                    />
                    <button
                      className="icon-btn-small delete-btn"
                      onClick={() => removeDepartment(dept.id)}
                      title="Remove Department"
                    >
                      <Icon name="delete" modifiers="sm" />
                    </button>
                  </div>

                  <ul className="equipment-list editable-eq-list">
                    {(dept.items || []).map((item) => (
                      <li key={item.id} className="equipment-item">
                        <div className="eq-item-content">
                          <input
                            className="eq-item-name-input"
                            value={item.name}
                            onChange={(e) =>
                              updateItem(
                                dept.id,
                                item.id,
                                "name",
                                e.target.value,
                              )
                            }
                            placeholder="Item name"
                          />
                          <div className="eq-qty-wrap">
                            <span>Qty:</span>
                            <input
                              type="number"
                              className="eq-qty-input"
                              value={item.qty}
                              onChange={(e) =>
                                updateItem(
                                  dept.id,
                                  item.id,
                                  "qty",
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              min="1"
                            />
                          </div>
                        </div>
                        <button
                          className="icon-btn-small remove-item-btn"
                          onClick={() => removeItem(dept.id, item.id)}
                        >
                          <Icon name="close" modifiers="sm" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="add-item-wrap">
                    <button
                      className="add-item-btn"
                      onClick={() => addItem(dept.id)}
                    >
                      <Icon name="add" modifiers="sm" /> Add Equipment
                    </button>
                  </div>
                </div>
              ))}
              {data.departments.length === 0 && (
                <div className="empty-equipment glass-card">
                  <Icon name="inventory_2" modifiers="lg" />
                  <h3>No Departments</h3>
                  <p>Add departments to start managing equipment lists.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  },
);

export default EquipmentVisualization;
