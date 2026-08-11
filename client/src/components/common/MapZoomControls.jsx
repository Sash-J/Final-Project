import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import GlassSurface from "./GlassSurface";
import HoverTooltip from "./HoverTooltip";
import Icon from "./Icon";

const MapZoomControls = ({ bounds, paddingTopLeft = [380, 20] }) => {
  const map = useMap();
  const divRef = useRef(null);

  useEffect(() => {
    if (divRef.current) {
      L.DomEvent.disableClickPropagation(divRef.current);
      L.DomEvent.disableScrollPropagation(divRef.current);
    }
  }, []);

  return (
    <div
      ref={divRef}
      style={{ position: "absolute", bottom: 20, right: 20, zIndex: 1000 }}
    >
      <GlassSurface
        className="org-zoom-controls map-zoom-controls-override"
        width="max-content"
        height="max-content"
        borderRadius={12}
        blur={8}
        opacity={0.5}
        backgroundOpacity={0.2}
        distortionScale={80}
        displace={3}
      >
        <HoverTooltip text="Zoom Out">
          <button onClick={() => map.zoomOut()}>
            <Icon name="remove" modifiers="sm" />
          </button>
        </HoverTooltip>
        <HoverTooltip text="Fit to Screen">
          <button
            onClick={() => {
              if (bounds && bounds.length > 0) {
                map.fitBounds(bounds, { 
                  paddingTopLeft: [paddingTopLeft[0], paddingTopLeft[1]],
                  paddingBottomRight: [40, 40] 
                });
              } else {
                map.setZoom(7);
              }
            }}
          >
            <Icon name="fit_screen" modifiers="sm" />
          </button>
        </HoverTooltip>
        <HoverTooltip text="Zoom In">
          <button onClick={() => map.zoomIn()}>
            <Icon name="add" modifiers="sm" />
          </button>
        </HoverTooltip>
      </GlassSurface>
    </div>
  );
};

export default MapZoomControls;
