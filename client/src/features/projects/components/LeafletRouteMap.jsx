import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import MapZoomControls from "../../../components/common/MapZoomControls";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";

// Helper component to auto-fit bounds
const AutoFitBounds = ({ bounds, paddingTopLeft = [380, 20] }) => {
  const map = useMap();
  const padTop = paddingTopLeft?.[0];
  const padLeft = paddingTopLeft?.[1];

  useEffect(() => {
    if (bounds && bounds.length > 0) {
      // Use setTimeout to ensure container is fully rendered before panning
      const timeout = setTimeout(() => {
        try {
          if (bounds.length === 1) {
            map.setView(bounds[0], 12, { animate: false });
          } else {
            map.fitBounds(bounds, {
              paddingTopLeft: [padTop, padLeft],
              paddingBottomRight: [40, 40],
              animate: false,
            });
          }
        } catch (e) {
          console.warn("Leaflet fitBounds error:", e);
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [bounds, map, padTop, padLeft]);
  return null;
};

// Helper component to fly to a specific location
const FlyToActiveLocation = ({ routesData, activeLocationInfo }) => {
  const map = useMap();
  useEffect(() => {
    if (
      activeLocationInfo &&
      activeLocationInfo.routeId !== null &&
      activeLocationInfo.locationIndex !== null
    ) {
      const route = routesData.find((r) => r.id === activeLocationInfo.routeId);
      if (route && route.coordinates[activeLocationInfo.locationIndex]) {
        const coord = route.coordinates[activeLocationInfo.locationIndex];

        // 1. Lock the map
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
        if (map.tap) map.tap.disable();

        // 2. Perform the animation
        map.flyTo([coord.lat, coord.lng], 16, { animate: true, duration: 1.5 });

        // 3. Unlock the map when animation completes
        map.once("zoomend", () => {
          map.dragging.enable();
          map.touchZoom.enable();
          map.doubleClickZoom.enable();
          map.scrollWheelZoom.enable();
          map.boxZoom.enable();
          map.keyboard.enable();
          if (map.tap) map.tap.enable();
        });
      }
    }
  }, [activeLocationInfo, routesData, map]);
  return null;
};

// Create custom icons for start, intermediate, and end
const createCustomIcon = (color) => {
  return L.divIcon({
    className: "custom-leaflet-icon",
    html: `<div style="background: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #1e1e1e; box-shadow: 0 0 0 2px rgba(255,255,255,0.2);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

const iconColors = {
  start: "#10b981",
  stop: "#f59e0b",
  end: "#ef4444",
};

// Global cache to prevent the modal map from re-fetching geocoding and flashing
const globalGeocodeCache = {};
const globalOsrmCache = {};

const LeafletRouteMap = ({
  routes,
  activeLocationInfo = null,
  isPreview = false,
}) => {
  const [routesData, setRoutesData] = useState([]);
  const [bounds, setBounds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoadingUI, setShowLoadingUI] = useState(false);
  const [isLightTheme, setIsLightTheme] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check initial state on mount
    setIsLightTheme(document.body.classList.contains("light-theme"));

    // Track theme changes on body
    const checkTheme = () => {
      setIsLightTheme(document.body.classList.contains("light-theme"));
    };

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Delay loading UI to prevent flashing if cached
  useEffect(() => {
    let timeout;
    if (isLoading) {
      timeout = setTimeout(() => setShowLoadingUI(true), 150);
    } else {
      setShowLoadingUI(false);
    }
    return () => clearTimeout(timeout);
  }, [isLoading]);

  useEffect(() => {
    let isMounted = true;

    const fetchAllRoutes = async () => {
      if (!routes || routes.length === 0) {
        if (isMounted) {
          setIsLoading(false);
          setRoutesData([]);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const processedRoutes = [];
        const allBounds = [];

        for (const route of routes) {
          const coords = [];
          for (const loc of route.locations) {
            const locName = loc.name;
            const locAddr = loc.address;
            const cacheKey = locAddr;

            if (!locAddr) continue;

            if (globalGeocodeCache[cacheKey]) {
              coords.push(globalGeocodeCache[cacheKey]);
            } else {
              // Check exact coordinates
              const coordMatch = locAddr.match(
                /(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/,
              );
              if (coordMatch) {
                const point = {
                  lat: parseFloat(coordMatch[1]),
                  lng: parseFloat(coordMatch[2]),
                  name: locName,
                };
                globalGeocodeCache[cacheKey] = point;
                coords.push(point);
                continue;
              }

              // Photon Geocoding fallback
              let queries = [locAddr];
              const noPlus = locAddr
                .replace(/\b[A-Z0-9]{4}\+[A-Z0-9]+\b/g, "")
                .replace(/,\s*,/g, ",")
                .trim();
              if (noPlus !== locAddr) queries.push(noPlus);

              let parts = noPlus
                .split(",")
                .map((p) => p.trim())
                .filter(Boolean);
              while (parts.length > 1) {
                parts.shift();
                queries.push(parts.join(", "));
              }

              let foundPoint = null;
              for (const q of queries) {
                if (!isMounted) break;
                const query = encodeURIComponent(`${q} Sri Lanka`);
                try {
                  const res = await fetch(
                    `https://photon.komoot.io/api/?q=${query}&limit=1`,
                  );
                  const data = await res.json();

                  if (data && data.features && data.features.length > 0) {
                    foundPoint = {
                      lat: data.features[0].geometry.coordinates[1],
                      lng: data.features[0].geometry.coordinates[0],
                      name: locName,
                    };
                    break;
                  }
                } catch (e) {
                  console.warn("Geocoding request failed:", e);
                }
                await new Promise((r) => setTimeout(r, 200));
              }

              if (foundPoint) {
                globalGeocodeCache[cacheKey] = foundPoint;
                coords.push(foundPoint);
              } else {
                console.warn(`Could not geocode location: ${locAddr}`);
              }
            }
          }

          if (!isMounted) break;

          let routeLineCoords = [];
          if (coords.length >= 2) {
            const waypoints = coords.map((c) => `${c.lng},${c.lat}`).join(";");
            if (globalOsrmCache[waypoints]) {
              routeLineCoords = globalOsrmCache[waypoints];
            } else {
              try {
                const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;
                const osrmRes = await fetch(osrmUrl);
                const osrmData = await osrmRes.json();
                if (osrmData.code === "Ok" && osrmData.routes.length > 0) {
                  routeLineCoords = osrmData.routes[0].geometry.coordinates.map(
                    (c) => [c[1], c[0]],
                  );
                  globalOsrmCache[waypoints] = routeLineCoords;
                }
              } catch (e) {
                console.error("OSRM fetch failed:", e);
              }
              await new Promise((r) => setTimeout(r, 200)); // Respect limits
            }
          }

          if (coords.length > 0) {
            allBounds.push(...coords.map((c) => [c.lat, c.lng]));
          }
          if (routeLineCoords.length > 0) {
            allBounds.push(...routeLineCoords);
          }

          processedRoutes.push({
            id: route.id,
            color: route.color,
            coordinates: coords,
            routeLine: routeLineCoords,
            isOverlapping: false,
          });
        }

        // Determine overlaps (if routes share exact address/name strings)
        for (let i = 0; i < processedRoutes.length; i++) {
          let hasOverlap = false;
          const routeI = routes.find(r => r.id === processedRoutes[i].id);
          
          if (routeI) {
            for (let j = 0; j < processedRoutes.length; j++) {
              if (i === j) continue;
              const routeJ = routes.find(r => r.id === processedRoutes[j].id);
              if (!routeJ) continue;

              const overlap = routeI.locations.some(loc1 => {
                const val1 = (loc1.address || loc1.name || "").trim().toLowerCase();
                if (!val1) return false;
                return routeJ.locations.some(loc2 => {
                  const val2 = (loc2.address || loc2.name || "").trim().toLowerCase();
                  return val1 === val2;
                });
              });

              if (overlap) {
                hasOverlap = true;
                break;
              }
            }
          }
          processedRoutes[i].isOverlapping = hasOverlap;
        }

        if (isMounted) {
          setRoutesData(processedRoutes);
          setBounds(allBounds);
        }
      } catch (err) {
        console.error("Error fetching map data:", err);
        if (isMounted) setError("Failed to load route data");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAllRoutes();

    return () => {
      isMounted = false;
    };
  }, [routes]);

  const center = bounds.length > 0 ? bounds[0] : [7.8731, 80.7718];

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {showLoadingUI && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            color: "white",
            paddingLeft: "400px",
          }}
        >
          Loading Map...
        </div>
      )}
      <MapContainer
        center={center}
        zoom={7}
        zoomSnap={0}
        zoomControl={false}
        attributionControl={false}
        dragging={!isPreview}
        touchZoom={!isPreview}
        scrollWheelZoom={!isPreview}
        doubleClickZoom={!isPreview}
        boxZoom={!isPreview}
        keyboard={!isPreview}
        style={{ width: "100%", height: "100%", background: isLightTheme ? "#f8f9fa" : "#0e0e0e" }}
      >
        <TileLayer
          key={isLightTheme ? "light" : "dark"}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={`https://{s}.basemaps.cartocdn.com/${isLightTheme ? 'light_all' : 'dark_all'}/{z}/{x}/{y}{r}.png`}
        />

        {[...routesData].reverse().map((route, idx) => {
          return (
            <div key={route.id}>
              {route.routeLine.length > 0 && (
                <Polyline
                  positions={route.routeLine}
                  color={route.color}
                  weight={6}
                  lineCap="round"
                  lineJoin="round"
                  pathOptions={{
                    className: route.isOverlapping ? `animated-route-line route-delay-${idx % 5}` : ""
                  }}
                />
              )}
              {route.coordinates.map((coord, i) => {
                const markerColor =
                  i === 0
                    ? route.color
                    : i === route.coordinates.length - 1
                      ? iconColors.end
                      : route.color;
                return (
                  <Marker
                    key={`${route.id}-${i}`}
                    position={[coord.lat, coord.lng]}
                    icon={createCustomIcon(markerColor)}
                  />
                );
              })}
            </div>
          );
        })}

        <AutoFitBounds bounds={bounds} paddingTopLeft={isPreview ? [20, 20] : [420, 20]} />
        <FlyToActiveLocation
          routesData={routesData}
          activeLocationInfo={activeLocationInfo}
        />
        {!isPreview && <MapZoomControls bounds={bounds} paddingTopLeft={[420, 20]} />}
      </MapContainer>
    </div>
  );
};

export default LeafletRouteMap;
