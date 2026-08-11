import { Reorder } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import GlassDatePicker from "../../../components/common/GlassDatePicker";
import GlassDropdown from "../../../components/common/GlassDropdown";
import GlassSurface from "../../../components/common/GlassSurface";
import GlassTimePicker from "../../../components/common/GlassTimePicker";
import HoverTooltip from "../../../components/common/HoverTooltip";
import Icon from "../../../components/common/Icon";
import LiquidGlassCard from "../../../components/common/LiquidGlassCard";
import ModalPortal from "../../../components/common/ModalPortal";
import { projectService } from "../../../services/projectService";
import CrewAssignmentDropdown from "../../budget/components/CrewAssignmentDropdown";
import LeafletRouteMap from "../components/LeafletRouteMap";
import "./MapWidget.css";

const ROUTE_COLORS = [
  "#0969da", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#ef4444", // Red
  "#f59e0b", // Amber
];

const parseRoutes = (rawRoutes, defaultLocation) => {
  let parsed = [];
  try {
    parsed = Array.isArray(rawRoutes)
      ? rawRoutes
      : rawRoutes
        ? JSON.parse(rawRoutes)
        : [];
  } catch (e) {
    console.error("Failed to parse routeLocations", e);
  }

  if (
    Array.isArray(parsed) &&
    parsed.length > 0 &&
    Array.isArray(parsed[0].locations)
  ) {
    return parsed.map((route, idx) => ({
      id: route.id || Math.random().toString(),
      title: route.title || `Route ${idx + 1}`,
      color: route.color || ROUTE_COLORS[idx % ROUTE_COLORS.length],
      startTime: route.startTime || "08:00",
      startDate: route.startDate || "",
      vehicleType: route.vehicleType || "sedan",
      locations: Array.isArray(route.locations)
        ? route.locations.map((loc) => ({
            id: loc.id || Math.random().toString(),
            name: typeof loc === "string" ? loc : loc.name || "",
            address: typeof loc === "string" ? loc : loc.address || "",
          }))
        : [],
    }));
  }

  // Wrap old format or empty data into a single route
  const defaultLocs =
    Array.isArray(parsed) && parsed.length > 0
      ? parsed.map((loc) => ({
          id: Math.random().toString(),
          name: typeof loc === "string" ? loc : loc.name || "",
          address: typeof loc === "string" ? loc : loc.address || "",
        }))
      : [
          {
            id: Math.random().toString(),
            name:
              defaultLocation !== "Location not specified"
                ? defaultLocation
                : "",
            address:
              defaultLocation !== "Location not specified"
                ? defaultLocation
                : "",
          },
        ];

  return [
    {
      id: Math.random().toString(),
      title: "Route 1",
      color: ROUTE_COLORS[0],
      startTime: "08:00",
      startDate: "",
      vehicleType: "sedan",
      locations: defaultLocs,
    },
  ];
};

// Helper to fetch actual driving distance via OSRM API
const fetchRouteDistancesOSRM = async (routes) => {
  const routeInfo = {};
  for (const route of routes) {
    if (!route.locations || route.locations.length < 2) {
      routeInfo[route.id] = null;
      continue;
    }

    try {
      const coords = route.locations
        .map((loc) => {
          if (!loc.address) return null;
          const pts = loc.address.split(",").map((s) => parseFloat(s.trim()));
          if (pts.length !== 2 || isNaN(pts[0]) || isNaN(pts[1])) return null;
          return `${pts[1]},${pts[0]}`; // OSRM requires lon,lat
        })
        .filter(Boolean);

      if (coords.length < 2) {
        routeInfo[route.id] = null;
        continue;
      }

      const url = `https://router.project-osrm.org/route/v1/driving/${coords.join(";")}?overview=false`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        // Distance is in meters, convert to km
        // Duration is in seconds
        const sec = data.routes[0].duration;
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);

        routeInfo[route.id] = {
          distance: (data.routes[0].distance / 1000).toFixed(1),
          duration: h > 0 ? `${h} hr ${m} min` : `${m} min`,
        };
      }
    } catch (error) {
      console.error("Failed to fetch OSRM distance:", error);
    }
  }
  return routeInfo;
};

const formatTimeAMPM = (timeStr) => {
  if (!timeStr) return "08:00 AM";
  const [hourStr, minStr] = timeStr.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minStr || "00"} ${ampm}`;
};

// Helper to calculate distance in km using Haversine formula
const calculateRouteDistance = (locations) => {
  if (!locations || locations.length < 2) return "0.0";

  const toRad = (value) => (value * Math.PI) / 180;
  let totalDistance = 0;

  for (let i = 0; i < locations.length - 1; i++) {
    const loc1 = locations[i].address;
    const loc2 = locations[i + 1].address;

    if (!loc1 || !loc2) continue;

    const coords1 = loc1.split(",").map((s) => parseFloat(s.trim()));
    const coords2 = loc2.split(",").map((s) => parseFloat(s.trim()));

    if (
      coords1.length === 2 &&
      !isNaN(coords1[0]) &&
      !isNaN(coords1[1]) &&
      coords2.length === 2 &&
      !isNaN(coords2[0]) &&
      !isNaN(coords2[1])
    ) {
      const R = 6371; // km
      const dLat = toRad(coords2[0] - coords1[0]);
      const dLon = toRad(coords2[1] - coords1[1]);
      const lat1 = toRad(coords1[0]);
      const lat2 = toRad(coords2[0]);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) *
          Math.sin(dLon / 2) *
          Math.cos(lat1) *
          Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistance += R * c;
    }
  }
  return totalDistance.toFixed(1);
};

const MapWidget = ({
  location = "Location not specified",
  routeLocations = [],
  dateStr = null,
  projectId = null,
  projectData = null,
  onUpdate = null,
}) => {
  const [showModal, setShowModal] = useState(false);

  const [editRoutes, setEditRoutes] = useState(() =>
    parseRoutes(routeLocations, location),
  );
  const [savingRouteIds, setSavingRouteIds] = useState([]);

  const [editingRouteIds, setEditingRouteIds] = useState([]);
  const [expandedRouteIds, setExpandedRouteIds] = useState([]);
  const [closingRouteIds, setClosingRouteIds] = useState([]);
  const [routeToDelete, setRouteToDelete] = useState(null);

  const handleCloseExpandedRoute = (routeId) => {
    setClosingRouteIds((prev) => [...prev, routeId]);
    setTimeout(() => {
      setExpandedRouteIds((prev) => prev.filter((id) => id !== routeId));
      setClosingRouteIds((prev) => prev.filter((id) => id !== routeId));
    }, 300);
  };

  const [activeLocationInfo, setActiveLocationInfo] = useState({
    routeId: null,
    locationIndex: null,
  });

  const [activeAssignRouteId, setActiveAssignRouteId] = useState(null);
  const [isCrewEditing, setIsCrewEditing] = useState(false);
  const [routeCrewAssignments, setRouteCrewAssignments] = useState({});

  const handleAssignCrewToRoute = (routeId, crewId) => {
    setRouteCrewAssignments((prev) => {
      const assigned = prev[routeId] || [];
      const idx = assigned.findIndex((u) => String(u.id) === String(crewId));
      let newAssigned;
      if (idx > -1) {
        newAssigned = [...assigned.slice(0, idx), ...assigned.slice(idx + 1)];
      } else {
        const projectCrew = projectData?.crew || [];
        const userToAdd = projectCrew.find(
          (u) => String(u.id) === String(crewId),
        );
        newAssigned = userToAdd ? [...assigned, userToAdd] : assigned;
      }
      return { ...prev, [routeId]: newAssigned };
    });
  };

  const sidebarRef = useRef(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [routeDistances, setRouteDistances] = useState({});

  // --- Route State Helpers ---
  const updateRoute = (routeId, updates) => {
    setEditRoutes((prev) =>
      prev.map((r) => (r.id === routeId ? { ...r, ...updates } : r)),
    );
  };

  const updateLocation = (routeId, locationId, updates) => {
    setEditRoutes((prev) =>
      prev.map((r) => {
        if (r.id !== routeId) return r;
        return {
          ...r,
          locations: r.locations.map((loc) =>
            loc.id === locationId ? { ...loc, ...updates } : loc,
          ),
        };
      }),
    );
  };

  const addLocationToRoute = (routeId) => {
    setEditRoutes((prev) =>
      prev.map((r) => {
        if (r.id !== routeId) return r;
        return {
          ...r,
          locations: [
            ...r.locations,
            { id: Math.random().toString(), name: "", address: "" },
          ],
        };
      }),
    );
  };

  const removeLocationFromRoute = (routeId, locationId) => {
    setEditRoutes((prev) =>
      prev.map((r) => {
        if (r.id !== routeId) return r;
        return {
          ...r,
          locations: r.locations.filter((loc) => loc.id !== locationId),
        };
      }),
    );
  };

  const reorderLocations = (routeId, newLocationsArray) => {
    setEditRoutes((prev) =>
      prev.map((r) =>
        r.id === routeId ? { ...r, locations: newLocationsArray } : r,
      ),
    );
  };

  // --- UI Helpers ---
  const getLocationLabel = (index, total) => {
    if (index === 0) return "Start Location";
    if (index === total - 1) return "Destination";
    return `Stopover ${index}`;
  };

  useEffect(() => {
    let isMounted = true;
    fetchRouteDistancesOSRM(editRoutes).then((dists) => {
      if (isMounted) setRouteDistances(dists);
    });
    return () => {
      isMounted = false;
    };
  }, [editRoutes]);

  const checkScroll = () => {
    if (sidebarRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = sidebarRef.current;
      // Use Math.ceil/floor to prevent fractional pixel issues making arrows disappear early
      setCanScrollUp(Math.ceil(scrollTop) > 0);
      setCanScrollDown(Math.ceil(scrollTop + clientHeight) < scrollHeight);
    }
  };

  useEffect(() => {
    checkScroll();
    const observer = new ResizeObserver(() => {
      checkScroll();
    });

    if (sidebarRef.current) {
      observer.observe(sidebarRef.current);
      if (sidebarRef.current.firstChild) {
        observer.observe(sidebarRef.current.firstChild);
      }
    }

    return () => observer.disconnect();
  }, [editRoutes, expandedRouteIds]);

  const scrollSidebar = (direction) => {
    if (sidebarRef.current) {
      const scrollAmount = 250;
      sidebarRef.current.scrollBy({
        top: direction === "up" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
      setTimeout(checkScroll, 300);
    }
  };

  // Initialize editRoutes only when the prop changes (e.g. initial load or external update)
  useEffect(() => {
    setEditRoutes(parseRoutes(routeLocations, location));
    setEditingRouteIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLocations, location]);

  const handleSaveRoute = async (routeData) => {
    if (!projectId) {
      alert("Missing project ID");
      return;
    }
    const routeId = routeData.id;
    setSavingRouteIds((prev) => [...prev, routeId]);

    try {
      const cleanRoute = {
        id: routeData.id,
        title: routeData.title,
        color: routeData.color,
        startTime: routeData.startTime,
        startDate: routeData.startDate,
        vehicleType: routeData.vehicleType,
        locations: routeData.locations
          .filter((loc) => loc.name?.trim() || loc.address?.trim())
          .map((loc) => ({
            id: loc.id,
            name: loc.name?.trim(),
            address: loc.address?.trim(),
          })),
      };

      await projectService.updateProjectRoute(projectId, routeId, cleanRoute);

      // Close edit mode on success
      setEditingRouteIds((prev) => prev.filter((id) => id !== routeId));
    } catch (error) {
      console.error("Failed to save route", error);
      alert("Failed to save route");
    } finally {
      setSavingRouteIds((prev) => prev.filter((id) => id !== routeId));
    }
  };

  const handleDeleteRoute = async (routeId) => {
    if (!projectId) return;
    try {
      await projectService.deleteProjectRoute(projectId, routeId);
      setEditRoutes(editRoutes.filter((r) => r.id !== routeId));
      setEditingRouteIds(editingRouteIds.filter((id) => id !== routeId));
    } catch (error) {
      console.error("Failed to delete route", error);
      alert("Failed to delete route");
    }
  };

  const activeRoutes = useMemo(() => {
    return editRoutes
      .map((route) => {
        const list = route.locations.filter(
          (l) => l.name?.trim() || l.address?.trim(),
        );
        return {
          ...route,
          locations:
            list.length > 0
              ? list
              : location && location !== "Location not specified"
                ? [{ id: "fallback", name: location, address: location }]
                : [],
        };
      })
      .filter((r) => r.locations.length > 0);
  }, [editRoutes, location]);

  const grandTotalKm = useMemo(() => {
    return editRoutes.reduce((sum, route) => {
      const routeOsrm = routeDistances[route.id];
      const dist =
        parseFloat(
          routeOsrm
            ? routeOsrm.distance
            : calculateRouteDistance(route.locations),
        ) || 0;
      return sum + dist;
    }, 0);
  }, [editRoutes, routeDistances]);

  return (
    <>
      <div
        className="map-widget-container global-glass-effect"
        onClick={() => setShowModal(true)}
      >
        <div className="map-view-section">
          <div className="map-real-bg">
            <LeafletRouteMap
              routes={activeRoutes}
              activeLocationInfo={activeLocationInfo}
              isPreview={true}
            />
          </div>
        </div>
      </div>

      {/* Full Map Modal */}
      {showModal && (
        <ModalPortal
          onClose={() => setShowModal(false)}
          size="large"
          className="global-modal-glass map-glass-override"
        >
          <div className="map-modal-content-inner">
            <div className="modal-header-section map-modal-header-custom">
              <h2>Route Locations</h2>
              <p>
                Manage and visualize your project's shooting locations and
                routes.
              </p>
            </div>

            <div className="map-modal-map-container">
              <LeafletRouteMap
                routes={activeRoutes}
                activeLocationInfo={activeLocationInfo}
              />

              <GlassSurface
                className="map-add-route-glass"
                width={45}
                height={45}
                borderRadius={16}
                borderWidth={1}
                mixBlendMode="screen"
                blur={16}
                displace={1}
                greenOffset={0}
                blueOffset={0}
                distortionScale={-150}
              >
                <HoverTooltip
                  text="Add Route"
                  wrapperClassName="map-add-route-tooltip-wrapper"
                >
                  <button
                    className="map-add-location-btn"
                    onClick={() => {
                      const newId = Math.random().toString();
                      setEditRoutes([
                        ...editRoutes,
                        {
                          id: newId,
                          title: `Route ${editRoutes.length + 1}`,
                          color:
                            ROUTE_COLORS[
                              editRoutes.length % ROUTE_COLORS.length
                            ],
                          startTime: "08:00",
                          startDate: "",
                          locations: [
                            {
                              id: Math.random().toString(),
                              name: "",
                              address: "",
                            },
                          ],
                        },
                      ]);
                      setEditingRouteIds([...editingRouteIds, newId]);
                    }}
                  >
                    <Icon name="add_road" modifiers="md" />
                  </button>
                </HoverTooltip>
              </GlassSurface>

              {/* Scroll Arrows */}
              {canScrollUp && (
                <div
                  className="map-scroll-arrow up"
                  onClick={() => scrollSidebar("up")}
                >
                  <Icon name="keyboard_arrow_up" />
                </div>
              )}
              {canScrollDown && (
                <div
                  className="map-scroll-arrow down"
                  onClick={() => scrollSidebar("down")}
                >
                  <Icon name="keyboard_arrow_down" />
                </div>
              )}

              {/* Route Editing Sidebar Overlay */}
              <div
                className="map-modal-sidebar"
                ref={sidebarRef}
                onScroll={checkScroll}
              >
                <div className="map-modal-sidebar-content">
                  <div className="map-routes-container">
                    {[...editRoutes]
                      .sort((a, b) => {
                        const osrmA = routeDistances[a.id];
                        const distA =
                          parseFloat(
                            osrmA
                              ? osrmA.distance
                              : calculateRouteDistance(a.locations),
                          ) || 0;
                        const osrmB = routeDistances[b.id];
                        const distB =
                          parseFloat(
                            osrmB
                              ? osrmB.distance
                              : calculateRouteDistance(b.locations),
                          ) || 0;
                        return distB - distA;
                      })
                      .map((route, routeIdx) => {
                        const routeOsrm = routeDistances[route.id];
                        const totalKm = routeOsrm
                          ? routeOsrm.distance
                          : calculateRouteDistance(route.locations);
                        const displayDuration = routeOsrm
                          ? routeOsrm.duration
                          : `${route.locations.length * 25} min`;
                        const parsedTotalKm = parseFloat(totalKm) || 0;
                        const progressWidth =
                          grandTotalKm > 0
                            ? (parsedTotalKm / grandTotalKm) * 100
                            : 0;
                        return (
                          <div
                            key={route.id}
                            className="map-route-card-wrapper"
                          >
                            <div
                              className="map-route-widget"
                              onClick={() => {
                                if (expandedRouteIds.includes(route.id)) {
                                  handleCloseExpandedRoute(route.id);
                                  setEditingRouteIds(
                                    editingRouteIds.filter(
                                      (id) => id !== route.id,
                                    ),
                                  );
                                } else {
                                  const newExpanded = [
                                    ...expandedRouteIds,
                                    route.id,
                                  ];
                                  if (newExpanded.length > 2) {
                                    setExpandedRouteIds(
                                      newExpanded.slice(newExpanded.length - 2),
                                    );
                                  } else {
                                    setExpandedRouteIds(newExpanded);
                                  }
                                }
                              }}
                            >
                              <div className="mrw-top">
                                <div className="mrw-icon-wrapper">
                                  <Icon
                                    name="route"
                                    style={{
                                      color:
                                        route.color || "var(--accent-color)",
                                    }}
                                  />
                                </div>
                                <div
                                  className="mrw-title-col"
                                  style={{ flex: "none" }}
                                >
                                  <span className="mrw-title">
                                    Route {routeIdx + 1}
                                  </span>
                                  <span className="mrw-subtitle">
                                    <Icon
                                      name="local_fire_department"
                                      modifiers="sm"
                                    />{" "}
                                    Active
                                  </span>
                                </div>
                                <div
                                  className="dept-crew-container"
                                  style={{ marginLeft: "12px" }}
                                >
                                  {(() => {
                                    const firstCrew =
                                      routeCrewAssignments[route.id] &&
                                      routeCrewAssignments[route.id].length > 0
                                        ? routeCrewAssignments[route.id][0]
                                        : projectData?.crew?.[0] || {
                                            username: "A",
                                          };

                                    const initial = firstCrew.full_name
                                      ? firstCrew.full_name
                                          .charAt(0)
                                          .toUpperCase()
                                      : firstCrew.username
                                        ? firstCrew.username
                                            .charAt(0)
                                            .toUpperCase()
                                        : "?";
                                    return (
                                      <div
                                        className="crew-avatar-badge"
                                        style={{ "--badge-size": "24px" }}
                                      >
                                        {firstCrew.profile_image ? (
                                          <img
                                            src={firstCrew.profile_image}
                                            alt={firstCrew.username}
                                            className="crew-avatar-img"
                                          />
                                        ) : (
                                          <div className="crew-avatar-text">
                                            {initial}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                                <HoverTooltip text="Open in Google Maps">
                                  <div
                                    className="mrw-gmaps-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const validLocs = route.locations.filter(
                                        (l) =>
                                          l.name?.trim() || l.address?.trim(),
                                      );
                                      if (validLocs.length === 0) return;
                                      const getQuery = (loc) =>
                                        loc.lat && loc.lng
                                          ? `${loc.lat},${loc.lng}`
                                          : loc.address || loc.name;
                                      let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(getQuery(validLocs[0]))}`;
                                      if (validLocs.length > 1) {
                                        url += `&destination=${encodeURIComponent(getQuery(validLocs[validLocs.length - 1]))}`;
                                        if (validLocs.length > 2) {
                                          const waypoints = validLocs
                                            .slice(1, -1)
                                            .map(getQuery)
                                            .join("|");
                                          url += `&waypoints=${encodeURIComponent(waypoints)}`;
                                        }
                                      } else {
                                        url += `&destination=${encodeURIComponent(getQuery(validLocs[0]))}`;
                                      }
                                      window.open(
                                        url,
                                        "_blank",
                                        "noopener,noreferrer",
                                      );
                                    }}
                                  >
                                    <Icon name="map" modifiers="sm" />
                                  </div>
                                </HoverTooltip>
                                <div style={{ flex: 1 }} />
                                <div className="mrw-time-date-container">
                                  <div className="mrw-time">
                                    {formatTimeAMPM(route.startTime)}
                                  </div>
                                  {route.startDate && (
                                    <div className="mrw-date-text">
                                      {route.startDate}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="mrw-progress-bar">
                                <div
                                  className="mrw-progress-fill"
                                  style={{ width: `${progressWidth}%` }}
                                ></div>
                              </div>

                              <div className="mrw-stats-main">
                                <div className="mrw-big-number">
                                  {totalKm} <span className="mrw-unit">km</span>
                                </div>
                                <div className="mrw-graph mrw-graph-wrapper">
                                  {route.vehicleType && (
                                    <div
                                      key={route.vehicleType}
                                      className="vehicle-drive-in"
                                    >
                                      <img
                                        className="vehicle-icon-animate"
                                        src={require(
                                          `../../../assets/images/${route.vehicleType}.png`,
                                        )}
                                        alt={route.vehicleType}
                                        style={{
                                          width: "70px",
                                          height: "auto",
                                          objectFit: "contain",
                                          filter: `drop-shadow(0 4px 6px ${route.color || "var(--accent-color)"}40)`,
                                          animationDelay: `-${(Date.now() % 4000) / 1000}s`,
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="mrw-bottom-pill">
                                <div className="mrw-pill-col">
                                  <Icon name="location_on" modifiers="sm" />
                                  <div className="mrw-pill-val">
                                    {route.locations.length}
                                    <span>Stops</span>
                                  </div>
                                </div>
                                <div className="mrw-pill-divider"></div>
                                <div className="mrw-pill-col">
                                  <Icon name="schedule" modifiers="sm" />
                                  <div className="mrw-pill-val">
                                    {displayDuration}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Expanded Cards Container */}
              <div className="map-expanded-cards-container">
                {expandedRouteIds.map((id) => {
                  const route = editRoutes.find((r) => r.id === id);
                  const routeIdx = editRoutes.findIndex((r) => r.id === id);
                  if (!route) return null;
                  const isRouteEditing = editingRouteIds.includes(route.id);
                  if (isRouteEditing) {
                    return (
                      <LiquidGlassCard
                        key={route.id}
                        className={`map-route-edit-card map-route-edit-card-custom glass-overlay-card ${closingRouteIds.includes(route.id) ? "map-route-card-closing" : ""}`}
                        variant="dark"
                      >
                        <div className="map-route-edit-header map-route-edit-content">
                          <div className="map-route-edit-header">
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                              }}
                            >
                              <h4
                                className="map-route-display-title"
                                style={{ color: route.color }}
                              >
                                <Icon name="route" modifiers="sm" /> Route{" "}
                                {routeIdx + 1}
                              </h4>
                              <div
                                className="dept-crew-container"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <CrewAssignmentDropdown
                                  assignedCrew={
                                    routeCrewAssignments[route.id] || []
                                  }
                                  projectCrew={projectData?.crew || []}
                                  isActive={activeAssignRouteId === route.id}
                                  onToggle={() =>
                                    setActiveAssignRouteId(
                                      activeAssignRouteId === route.id
                                        ? null
                                        : route.id,
                                    )
                                  }
                                  onAssign={(crewId) =>
                                    handleAssignCrewToRoute(route.id, crewId)
                                  }
                                  isCrewEditing={isCrewEditing}
                                  setIsCrewEditing={setIsCrewEditing}
                                  badgeSize={20}
                                />
                              </div>
                            </div>
                            <div className="map-route-btn-container">
                              <button
                                className={`org-metadata-nav save-status-indicator ${savingRouteIds.includes(route.id) ? "saving" : "saved"}`}
                                disabled={savingRouteIds.includes(route.id)}
                                onClick={() => handleSaveRoute(route)}
                                style={{
                                  padding: "8px 16px",
                                  cursor: "pointer",
                                  display: "flex",
                                  gap: "6px",
                                  alignItems: "center",
                                  color: savingRouteIds.includes(route.id)
                                    ? "#eab308"
                                    : "#22c55e",
                                }}
                              >
                                <Icon
                                  name={
                                    savingRouteIds.includes(route.id)
                                      ? "sync"
                                      : "check_circle"
                                  }
                                  modifiers={
                                    savingRouteIds.includes(route.id)
                                      ? "spin sm"
                                      : "sm"
                                  }
                                />
                                {savingRouteIds.includes(route.id)
                                  ? "Saving..."
                                  : "Save"}
                              </button>
                              <button
                                className="modal-close-btn map-route-edit-close-btn"
                                onClick={() => {
                                  // Just close the edit mode without saving
                                  setEditingRouteIds(
                                    editingRouteIds.filter(
                                      (id) => id !== route.id,
                                    ),
                                  );
                                }}
                              >
                                <Icon name="close" modifiers="sm" />
                              </button>
                            </div>
                          </div>

                          <div className="map-route-edit-datetime-row">
                            <div>
                              <GlassTimePicker
                                id={`time-input-${route.id}`}
                                value={route.startTime || "08:00"}
                                onChange={(val) =>
                                  updateRoute(route.id, { startTime: val })
                                }
                                className=""
                                iconOnly={true}
                              />
                            </div>
                            <div>
                              <GlassDatePicker
                                value={route.startDate || ""}
                                onChange={(newDate) =>
                                  updateRoute(route.id, { startDate: newDate })
                                }
                                placeholder="Select Date"
                                className=""
                                iconOnly={true}
                              />
                            </div>
                            <div className="map-route-vehicle-container">
                              <GlassDropdown
                                className="map-route-time-input map-route-input-full"
                                value={route.vehicleType || "sedan"}
                                onChange={(val) =>
                                  updateRoute(route.id, { vehicleType: val })
                                }
                                options={[
                                  { label: "Mini Car", value: "mini_car" },
                                  { label: "Hatchback", value: "hatchback" },
                                  { label: "Sedan", value: "sedan" },
                                  { label: "MPV", value: "mpv" },
                                  { label: "Crossover", value: "crossover" },
                                  { label: "Minivan", value: "minivan" },
                                  { label: "Small SUV", value: "small_suv" },
                                  { label: "Large SUV", value: "large_suv" },
                                  { label: "Pickup", value: "pickup_truck" },
                                  {
                                    label: "Pass. Van",
                                    value: "passenger_van",
                                  },
                                  { label: "Box Truck", value: "box_truck" },
                                ]}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="map-route-edit-locations-scroll custom-scrollbar">
                          <Reorder.Group
                            axis="y"
                            values={route.locations}
                            onReorder={(newLocations) =>
                              reorderLocations(route.id, newLocations)
                            }
                            className="map-route-list"
                          >
                            <div className="map-route-line" />
                            {route.locations.map((loc, i, arr) => (
                              <Reorder.Item
                                key={loc.id}
                                value={loc}
                                className={`map-route-item map-route-item-custom ${i === arr.length - 1 ? "last-item" : ""}`}
                                style={{
                                  marginBottom:
                                    i === arr.length - 1 ? "0" : "12px",
                                }}
                              >
                                <div
                                  className={`map-route-node ${
                                    i === 0
                                      ? "start"
                                      : i === arr.length - 1
                                        ? "end"
                                        : "intermediate"
                                  }`}
                                  style={{ borderColor: route.color }}
                                />
                                <div className="map-route-item-card map-route-item-card-edit-padding">
                                  <div className="map-route-item-card-content map-route-item-card-content-edit">
                                    <input
                                      type="text"
                                      value={loc.name}
                                      onChange={(e) =>
                                        updateLocation(route.id, loc.id, {
                                          name: e.target.value,
                                        })
                                      }
                                      className="map-route-item-title-input"
                                      placeholder="Display Name (e.g. Vision Division)"
                                    />
                                    <div className="map-route-item-subtitle-row">
                                      <input
                                        type="text"
                                        value={loc.address}
                                        onChange={(e) =>
                                          updateLocation(route.id, loc.id, {
                                            address: e.target.value,
                                          })
                                        }
                                        className="map-route-item-subtitle-input"
                                        placeholder="Address or Coordinates"
                                      />
                                      <span className="map-route-item-stopover-label">
                                        {getLocationLabel(i, arr.length)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="map-route-item-actions">
                                    <Icon
                                      name="drag_indicator"
                                      className="map-route-item-drag-icon"
                                      modifiers="sm"
                                    />
                                    {route.locations.length > 1 && (
                                      <Icon
                                        name="delete"
                                        modifiers="sm"
                                        className="map-route-item-delete-icon"
                                        onClick={() =>
                                          removeLocationFromRoute(
                                            route.id,
                                            loc.id,
                                          )
                                        }
                                      />
                                    )}
                                  </div>
                                </div>
                              </Reorder.Item>
                            ))}
                          </Reorder.Group>
                        </div>

                        <div className="map-route-edit-actions-row">
                          <button
                            className="btn-outline map-add-location-btn-custom"
                            onClick={() => addLocationToRoute(route.id)}
                          >
                            <Icon name="add" modifiers="sm" /> Add Stop
                          </button>
                          <button
                            className="btn-danger map-route-btn-delete-icon-only"
                            onClick={() => setRouteToDelete(route.id)}
                            title="Delete Route"
                          >
                            <Icon name="delete" modifiers="sm" />
                          </button>
                        </div>
                      </LiquidGlassCard>
                    );
                  }

                  return (
                    <LiquidGlassCard
                      key={route.id}
                      className={`map-route-display-card map-route-display-card-custom glass-overlay-card ${closingRouteIds.includes(route.id) ? "map-route-card-closing" : ""}`}
                      variant="dark"
                    >
                      <div className="map-route-display-header">
                        <h4
                          className="map-route-display-title"
                          style={{ color: route.color }}
                        >
                          <Icon name="route" modifiers="sm" /> Route{" "}
                          {routeIdx + 1}
                          <span className="map-route-display-subtitle">
                            {formatTimeAMPM(route.startTime)}{" "}
                            {route.startDate ? `• ${route.startDate}` : ""}
                          </span>
                        </h4>
                        <div className="map-route-display-actions">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRouteIds([
                                ...editingRouteIds,
                                route.id,
                              ]);
                            }}
                            className="modal-close-btn map-route-edit-close-btn map-route-edit-action-btn"
                            title="Edit Route"
                          >
                            <Icon name="edit" modifiers="sm" />
                          </button>
                          <button
                            className="modal-close-btn map-route-edit-close-btn"
                            title="Collapse Route"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloseExpandedRoute(route.id);
                            }}
                          >
                            <Icon name="close" modifiers="sm" />
                          </button>
                        </div>
                      </div>
                      <div className="map-route-list">
                        <div className="map-route-line" />
                        {route.locations.map((loc, i, arr) => (
                          <div
                            key={loc.id}
                            className={`map-route-item map-route-item-custom ${i === arr.length - 1 ? "last-item" : ""}`}
                            style={{
                              marginBottom: i === arr.length - 1 ? "0" : "12px",
                            }}
                            onClick={() =>
                              setActiveLocationInfo({
                                routeId: route.id,
                                locationIndex: i,
                              })
                            }
                          >
                            <div
                              className={`map-route-node ${
                                i === 0
                                  ? "start"
                                  : i === arr.length - 1
                                    ? "end"
                                    : "intermediate"
                              }`}
                              style={{ borderColor: route.color }}
                            />
                            <div className="map-route-item-card">
                              <div className="map-route-item-card-content">
                                <div className="map-route-item-title">
                                  {loc.name ||
                                    loc.address ||
                                    "Unknown Location"}
                                </div>
                                <div className="map-route-item-subtitle">
                                  {getLocationLabel(i, arr.length)}
                                </div>
                              </div>
                              <Icon
                                name="chevron_right"
                                className="map-route-item-chevron"
                                modifiers="sm"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </LiquidGlassCard>
                  );
                })}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!routeToDelete}
        title="Delete Route"
        message="Are you sure you want to delete this route? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={() => {
          handleDeleteRoute(routeToDelete);
          setRouteToDelete(null);
        }}
        onCancel={() => setRouteToDelete(null)}
      />
    </>
  );
};

export default MapWidget;
