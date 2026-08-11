import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { Calendar } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../../components/lib/utils";
import "./ScrollTimeline.css";

const Card = ({ className, children }) => (
  <div className={className}>{children}</div>
);

const CardContent = ({ className, children }) => (
  <div className={cn("p-6 pt-0", className)}>{children}</div>
);

const PulsingDot = ({
  preview,
  activeIndex,
  dotPercentages,
  svgPath,
  scrollYProgress,
  scrollData,
}) => {
  const rawPathProgress = useTransform(
    scrollYProgress,
    scrollData.input.length > 1 ? scrollData.input : [0, 1],
    scrollData.output.length > 1 ? scrollData.output : [1, 0],
  );

  const smoothPathProgress = useSpring(rawPathProgress, {
    stiffness: 100,
    damping: 20,
    restDelta: 0.001,
  });

  const pathProgressPercent = useTransform(
    smoothPathProgress,
    (v) => `${v * 100}%`,
  );

  return (
    <motion.div
      className="absolute z-50 pointer-events-none"
      style={{
        offsetDistance: preview ? undefined : pathProgressPercent,
        offsetPath: `path("${svgPath}")`,
        offsetRotate: "0deg",
        top: 0,
        left: 0,
      }}
      animate={
        preview
          ? {
              offsetDistance: `${(dotPercentages[activeIndex] ?? dotPercentages[0] ?? 1) * 100}%`,
            }
          : undefined
      }
      transition={
        preview ? { type: "spring", stiffness: 100, damping: 20 } : undefined
      }
    >
      <div className="w-5 h-5 rounded-full timeline-progress-dot" />
    </motion.div>
  );
};



export const ScrollTimeline = ({
  events: initialEvents = [],
  animationOrder = "sequential",
  cardAlignment = "alternating",
  lineColor = "bg-primary-muted",
  progressIndicator = true,
  parallaxIntensity = 0.2,
  progressLineWidth = 2,
  progressLineCap = "round",
  dateFormat = "badge",
  revealAnimation = "fade",
  className = "",
  connectorStyle = "line",
  perspective = false,
  darkMode = false,
  smoothScroll = true,
  onEventClick,
  viewMode = "detailed",
  preview = false,
}) => {
  const events = useMemo(() => [...initialEvents].reverse(), [initialEvents]);
  const scrollRef = useRef(null);

  const [hasScrolled, setHasScrolled] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timelineRefs = useRef([]);

  useEffect(() => {
    if (
      !hasScrolled &&
      timelineRefs.current.length === events.length &&
      events.length > 0
    ) {
      const timeoutId = setTimeout(() => {
        if (!preview) {
          const latestCompletedIndex = events.findIndex(
            (e) =>
              e.originalMilestone && e.originalMilestone.status === "completed",
          );

          const targetIndex =
            latestCompletedIndex !== -1
              ? latestCompletedIndex
              : events.length - 1;

          const targetEl = timelineRefs.current[targetIndex];
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: "auto", block: "center" });
          }
        }

        // Delay hasScrolled so trailing async scroll events from
        // scrollIntoView are ignored by the listener, keeping dots inactive.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setHasScrolled(true);
          });
        });
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [events, hasScrolled, preview]);

  const [activeScrollContainer, setActiveScrollContainer] = useState(undefined);

  useEffect(() => {
    if (scrollRef.current) {
      let parent = scrollRef.current.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        if (
          style.overflowY === "auto" ||
          style.overflowY === "scroll" ||
          style.overflow === "auto"
        ) {
          setActiveScrollContainer({ current: parent });
          return;
        }
        parent = parent.parentElement;
      }
    }
  }, []);

  const { scrollYProgress } = useScroll({
    target: scrollRef,
    container: activeScrollContainer,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const yOffset = useTransform(
    smoothProgress,
    [0, 1],
    [parallaxIntensity * 100, -parallaxIntensity * 100],
  );

  const [maxLineHeight, setMaxLineHeight] = useState("100%");
  const [svgPath, setSvgPath] = useState("");
  const pathRef = useRef(null);
  const [dotCoords, setDotCoords] = useState([]);
  const [dotPercentages, setDotPercentages] = useState([]);
  const [scrollData, setScrollData] = useState({
    input: [0, 1],
    output: [1, 0],
  });

  useEffect(() => {
    const updateHeights = () => {
      const active = Math.max(0, activeIndex);
      if (timelineRefs.current[active]) {
        // legacy tracking removed
      }

      if (timelineRefs.current.length === events.length && scrollRef.current) {
        const svgContainer = scrollRef.current.querySelector(
          ".pointer-events-none.z-40",
        );
        if (svgContainer) {
          const svgRect = svgContainer.getBoundingClientRect();
          const unscaledWidth = svgContainer.offsetWidth || 1;
          let scale = svgRect.width / unscaledWidth;
          if (!scale || isNaN(scale) || scale === 0) scale = 1;

          const containerWidth = unscaledWidth;
          const centerX = containerWidth / 2;
          const dots = [];
          const parent = svgContainer.offsetParent;
          timelineRefs.current.forEach((el, i) => {
            if (!el) return;
            let top = 0;
            let left = 0;
            let current = el;
            while (current && current !== parent && current !== document.body) {
              top += current.offsetTop;
              left += current.offsetLeft;
              current = current.offsetParent;
            }

            const y = top;
            const x = left;

            dots.push({ x, y, isLeft: x < centerX });
          });

          if (dots.length > 0) {
            const tangentScale = 0.4;
            const getTangentX = (dot) => (dot.isLeft ? -1.5 : 1.5);

            // We want the path to start at the bottom and go UP.
            // Since we reversed the events array, the oldest event is at the bottom.
            // dots[dots.length - 1] is the bottom dot.

            const lastDot = dots[dots.length - 1]; // Bottom dot
            const tLast_x = getTangentX(lastDot);

            const scrollRect = scrollRef.current.getBoundingClientRect();
            const svgTopOffset = (svgRect.top - scrollRect.top) / scale;
            const maxAvailableHeight = scrollRect.height / scale - svgTopOffset;

            // Extend the line to the bottom of the scroll container
            // In preview mode, extend much further so the curve reaches the container edge
            const extraBottom = preview ? 2000 : 0;
            const dyLast =
              Math.max(150, maxAvailableHeight - lastDot.y) + extraBottom;
            const extendedY = lastDot.y + dyLast;

            const scaleLast = dyLast * tangentScale;

            let path = `M ${centerX} ${extendedY}`;

            // From bottom origin to bottom dot (N-1)
            const cp0_1 = { x: centerX, y: extendedY - dyLast * 0.3 };
            const cp0_2 = {
              x: lastDot.x + tLast_x * scaleLast,
              y: lastDot.y + scaleLast,
            };
            path += ` C ${cp0_1.x} ${cp0_1.y}, ${cp0_2.x} ${cp0_2.y}, ${lastDot.x} ${lastDot.y}`;

            // Between dots, going UP from N-1 to 0
            for (let i = dots.length - 1; i > 0; i--) {
              const curr = dots[i]; // Lower dot
              const next = dots[i - 1]; // Higher dot
              const dy = curr.y - next.y; // Positive distance
              const scale = dy * tangentScale;

              const tx_curr = getTangentX(curr);
              const tx_next = getTangentX(next);

              const cp1 = { x: curr.x - tx_curr * scale, y: curr.y - scale };
              const cp2 = { x: next.x + tx_next * scale, y: next.y + scale };
              path += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${next.x} ${next.y}`;
            }

            // From top dot (0) to top origin
            // In preview mode, extend far above so the curve reaches the container edge
            const topTarget = preview ? -2000 : 0;
            const d0 = dots[0];
            const t0_x = getTangentX(d0);
            const dy0 = d0.y - topTarget;
            const scale0 = dy0 * tangentScale;

            const cpT_1 = { x: d0.x - t0_x * scale0, y: d0.y - scale0 };
            const cpT_2 = { x: centerX, y: topTarget + dy0 * 0.3 };
            path += ` C ${cpT_1.x} ${cpT_1.y}, ${cpT_2.x} ${cpT_2.y}, ${centerX} ${topTarget}`;

            setMaxLineHeight(extendedY);
            setSvgPath(path);
            setDotCoords(dots);
          }
        }
      }
    };
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateHeights, 150);
    };

    const timeoutId = setTimeout(updateHeights, 0);
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, JSON.stringify(events.map((e) => e.description + e.note))]);

  useEffect(() => {
    if (pathRef.current && svgPath && dotCoords.length > 0) {
      const pathEl = pathRef.current;
      const totalLen = pathEl.getTotalLength();

      if (totalLen > 0) {
        const percentages = dotCoords.map((coord) => {
          let min = 0;
          let max = totalLen;
          let bestLen = 0;
          for (let i = 0; i < 20; i++) {
            const mid = (min + max) / 2;
            const pt = pathEl.getPointAtLength(mid);
            if (pt.y > coord.y) {
              min = mid;
            } else {
              max = mid;
            }
            bestLen = mid;
          }
          return bestLen / totalLen;
        });
        setDotPercentages(percentages);

        if (!preview) {
          const containerHeight = activeScrollContainer?.current
            ? activeScrollContainer.current.clientHeight
            : window.innerHeight;

          const maxScroll = activeScrollContainer?.current
            ? Math.max(
                1,
                activeScrollContainer.current.scrollHeight - containerHeight,
              )
            : Math.max(
                1,
                (scrollRef.current?.offsetHeight || 1) - containerHeight,
              );

          let input = [];
          let output = [];

          dotCoords.forEach((d, i) => {
            let v_i = (d.y - containerHeight / 2) / maxScroll;
            v_i = Math.max(0, Math.min(1, v_i));

            if (input.length === 0 || v_i > input[input.length - 1] + 0.001) {
              input.push(v_i);
              output.push(percentages[i]);
            }
          });

          if (input.length === 0) {
            input = [0, 1];
            output = [1, 0];
          }

          setScrollData({ input, output });
        }
      }
    }
  }, [svgPath, dotCoords, preview, activeScrollContainer]);

  useEffect(() => {
    if (preview) {
      let lastCompletedIndex = -1;
      for (let i = 0; i < events.length; i++) {
        if (events[i].originalMilestone?.status === "completed") {
          lastCompletedIndex = i;
          break;
        }
      }
      setActiveIndex(lastCompletedIndex !== -1 ? lastCompletedIndex : 0);
      return;
    }

    if (!hasScrolled) return;

    const evaluateActiveIndex = (v) => {
      if (dotCoords.length === 0 || dotPercentages.length === 0) return;

      // Interpolate the pulsing dot's current path percentage from scrollYProgress
      // using the same scrollData mapping that drives the PulsingDot component.
      const { input, output } = scrollData;
      let dotPathPercent;
      if (input.length < 2) {
        dotPathPercent = 1 - v; // fallback linear
      } else {
        // Clamp v to input range
        const clampedV = Math.max(
          input[0],
          Math.min(input[input.length - 1], v),
        );
        // Find segment
        let segIdx = 0;
        for (let i = 0; i < input.length - 1; i++) {
          if (clampedV >= input[i] && clampedV <= input[i + 1]) {
            segIdx = i;
            break;
          }
        }
        const t =
          (clampedV - input[segIdx]) / (input[segIdx + 1] - input[segIdx] || 1);
        dotPathPercent =
          output[segIdx] + t * (output[segIdx + 1] - output[segIdx]);
      }

      // dotPercentages: each milestone's position along the path (0 = bottom, 1 = top).
      // The pulsing dot has "passed" a milestone if its path percent is >= the milestone's percent.
      // We scan from top (index 0) to bottom, looking for the first milestone we've reached.
      let newActive = events.length - 1; // default: only bottom dot
      for (let i = 0; i < dotPercentages.length; i++) {
        if (dotPercentages[i] <= dotPathPercent + 0.01) {
          newActive = i;
          break;
        }
      }

      setActiveIndex((prev) => (prev !== newActive ? newActive : prev));
    };

    // Evaluate immediately for the current scroll position
    evaluateActiveIndex(scrollYProgress.get());

    // Subscribe to future changes
    const unsubscribe = scrollYProgress.onChange(evaluateActiveIndex);
    return () => unsubscribe();
  }, [
    scrollYProgress,
    events,
    preview,
    dotCoords,
    dotPercentages,
    scrollData,
    hasScrolled,
  ]);

  const getCardVariants = (index) => {
    const baseDelay =
      animationOrder === "simultaneous"
        ? 0
        : animationOrder === "staggered"
          ? index * 0.2
          : index * 0.3;

    const initialStates = {
      fade: { opacity: 0, y: 20 },
      slide: {
        x:
          cardAlignment === "left"
            ? -100
            : cardAlignment === "right"
              ? 100
              : index % 2 === 0
                ? -100
                : 100,
        opacity: 0,
      },
      scale: { scale: 0.8, opacity: 0 },
      flip: { rotateY: 90, opacity: 0 },
      none: { opacity: 1 },
    };

    return {
      initial: initialStates[revealAnimation],
      whileInView: {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        rotateY: 0,
        transition: {
          duration: 0.7,
          delay: baseDelay,
          ease: [0.25, 0.1, 0.25, 1.0],
        },
      },
      viewport: { once: false, margin: "-100px" },
    };
  };



  const getCardClasses = (index) => {
    const baseClasses = "relative z-30";

    const alignmentClassesDesktop =
      cardAlignment === "alternating"
        ? index % 2 === 0
          ? "lg-mr-alternating"
          : "lg-ml-alternating"
        : cardAlignment === "left"
          ? "lg-mr-auto lg-ml-0"
          : "lg-ml-auto lg-mr-0";

    const perspectiveClass = perspective ? "hover-perspective" : "";

    return cn(
      baseClasses,
      alignmentClassesDesktop,
      perspectiveClass,
      "w-full lg-w-card",
    );
  };

  return (
    <div
      ref={scrollRef}
      className={cn(
        "relative w-full scroll-timeline-container",
        preview ? "preview-mode" : "overflow-hidden min-h-screen",
        darkMode ? "text-foreground" : "light-theme text-gray-900",
        className,
      )}
    >
      <div
        className={cn(
          "relative max-w-6xl mx-auto px-4 pt-15",
          preview ? "pb-4" : "pb-24",
        )}
      >
        <div className="relative mx-auto">
          <div
            className="absolute top-0 left-0 w-full z-40 pointer-events-none"
            style={{ height: maxLineHeight }}
          >
            {progressIndicator && svgPath && (
              <>
                <svg
                  className="w-full h-full"
                  preserveAspectRatio="none"
                  style={preview ? { overflow: "visible" } : undefined}
                >
                  <motion.path
                    ref={pathRef}
                    d={svgPath}
                    initial={{ d: svgPath }}
                    animate={{ d: svgPath }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    stroke={
                      darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
                    }
                    strokeWidth="4"
                    fill="none"
                  />
                  <motion.path
                    d={svgPath}
                    initial={{ d: svgPath }}
                    stroke="url(#timeline-gradient)"
                    strokeWidth={progressLineWidth * 1.5}
                    fill="none"
                    strokeLinecap={progressLineCap}
                    animate={{
                      d: svgPath,
                      pathLength:
                        activeIndex === 0
                          ? 1
                          : 1 - (dotPercentages[activeIndex] || 0),
                    }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  />
                  <defs>
                    <linearGradient
                      id="timeline-gradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={darkMode ? "var(--accent-color)" : "#0969da"} />
                      <stop
                        offset="100%"
                        stopColor={darkMode ? "var(--accent-color)" : "#0969da"}
                        stopOpacity="0.1"
                      />
                    </linearGradient>
                  </defs>
                </svg>
                <PulsingDot
                  key={`${viewMode}-${scrollData.input.join(",")}`}
                  preview={preview}
                  activeIndex={activeIndex}
                  dotPercentages={dotPercentages}
                  svgPath={svgPath}
                  scrollYProgress={scrollYProgress}
                  scrollData={scrollData}
                />
              </>
            )}
          </div>

          <div className="relative z-20">
            {events.map((event, index) => {
              return (
                <motion.div
                  layout
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  key={event.id || index}
                  className={cn(
                    "relative flex items-center mb-10 py-4",
                    "flex-col lg-flex-row",
                    cardAlignment === "alternating"
                      ? index % 2 === 0
                        ? "lg-justify-start"
                        : "lg-flex-row-reverse lg-justify-start"
                      : cardAlignment === "left"
                        ? "lg-justify-start"
                        : "lg-flex-row-reverse lg-justify-start",
                  )}
                >
                  {(() => {
                    const isLeft =
                      cardAlignment === "alternating"
                        ? index % 2 === 0
                        : cardAlignment === "left";
                    return (
                      <div
                        ref={(el) => {
                          timelineRefs.current[index] = el;
                        }}
                        className={cn(
                          "absolute top-1/2 transform -translate-y-1/2 z-30",
                          isLeft
                            ? "timeline-dot-left -translate-x-1/2"
                            : "timeline-dot-right -translate-x-1/2",
                        )}
                      >
                        <div
                          className={cn(
                            "timeline-dot",
                            index >= activeIndex && activeIndex >= 0
                              ? "active"
                              : "inactive",
                          )}
                        />
                      </div>
                    );
                  })()}
                  <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    className={cn(
                      getCardClasses(index),
                      "w-full lg-w-1-2",
                      cardAlignment === "alternating"
                        ? index % 2 === 0
                          ? "lg-pr-12"
                          : "lg-pl-12"
                        : cardAlignment === "left"
                          ? "lg-pr-12"
                          : "lg-pl-12",
                    )}
                    custom={index}
                    variants={getCardVariants(index)}
                    initial="initial"
                    whileInView="whileInView"
                    viewport={{ once: false, margin: "-100px" }}
                    style={
                      !preview && parallaxIntensity > 0
                        ? { y: yOffset }
                        : undefined
                    }
                    onClick={() =>
                      onEventClick &&
                      onEventClick(event.originalMilestone || event)
                    }
                  >
                    <Card
                      className={cn(
                        "premium-glass-card",
                        viewMode === "simple" ? "simple-view" : "",
                      )}
                    >
                      <div
                        className={cn(
                          "premium-card-number",
                          viewMode === "simple" ? "simple-view" : "",
                        )}
                      >
                        {events.length - index}
                      </div>
                      <CardContent className="premium-glass-content">
                        {dateFormat === "badge" ? (
                          <div className="flex items-center" style={{ marginBottom: "8px" }}>
                            <div className="premium-badge" style={{ marginBottom: 0 }}>
                              {event.icon || (
                                <Calendar className="h-4 w-4 mr-2 text-primary" />
                              )}
                              <span
                                className={event.color}
                                style={
                                  event.color && event.color.startsWith("#")
                                    ? { color: event.color }
                                    : {}
                                }
                              >
                                {event.year}
                              </span>
                            </div>
                            {event.originalMilestone?.status && (
                              <div
                                className={cn(
                                  "timeline-status-indicator",
                                  event.originalMilestone.status.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-')
                                )}
                                title={event.originalMilestone.status}
                              />
                            )}
                          </div>
                        ) : null}
                        <h3 className="premium-title">{event.title}</h3>
                        {event.subtitle && (
                          <h4 className="text-sm font-medium text-primary mb-4">
                            {event.subtitle}
                          </h4>
                        )}
                        <p className="premium-description">
                          {event.description}
                        </p>
                        {event.note && (
                          <div className="premium-note-container">
                            {(() => {
                              const match =
                                event.note.match(/^\[(.*?)\]\s*(.*)$/);
                              if (match) {
                                return (
                                  <>
                                    <span className="premium-note-tag">
                                      {match[1]} Note
                                    </span>
                                    <div className="premium-note-text">
                                      {match[2]}
                                    </div>
                                  </>
                                );
                              }
                              return (
                                <div className="premium-note-text">
                                  {event.note}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
