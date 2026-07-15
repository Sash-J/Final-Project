const fs = require('fs');
const path = 'g:/UoB/Research Methodologies/Project/Project/client/src/features/timeline/components/ScrollTimeline.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add state for svgPath
code = code.replace(
  "const [maxLineHeight, setMaxLineHeight] = useState('100%');",
  "const [maxLineHeight, setMaxLineHeight] = useState('100%');\n  const [svgPath, setSvgPath] = useState('');"
);

// 2. Rewrite updateHeights
const newUpdateHeights =     const updateHeights = () => {
      const active = Math.max(0, activeIndex);
      if (timelineRefs.current[active]) {
        const el = timelineRefs.current[active];
        setTargetHeight(el.offsetTop + el.offsetHeight / 2);
      }
      
      const last = events.length - 1;
      if (timelineRefs.current[last]) {
        const el = timelineRefs.current[last];
        setMaxLineHeight(el.offsetTop + el.offsetHeight / 2 + 100);
      }

      if (timelineRefs.current.length === events.length && scrollRef.current) {
        const containerWrap = timelineRefs.current[0].closest('.relative.z-20');
        if (!containerWrap) return;
        const containerWidth = containerWrap.offsetWidth;
        const centerX = containerWidth / 2;
        const cardGap = 20;
        
        let path = \\\M \\\ 0\\\;
        
        timelineRefs.current.forEach((el, i) => {
          if (!el) return;
          const y = el.offsetTop + el.offsetHeight / 2;
          
          let isLeft = false;
          if (cardAlignment === "alternating") {
            isLeft = i % 2 === 0;
          } else if (cardAlignment === "left") {
            isLeft = true;
          } else {
            isLeft = false;
          }
          
          const targetX = isLeft ? centerX - cardGap : centerX + cardGap;
          
          const prevY = i === 0 ? 0 : timelineRefs.current[i-1].offsetTop + timelineRefs.current[i-1].offsetHeight / 2;
          const prevX = i === 0 ? centerX : (
             cardAlignment === "alternating" ? ((i-1) % 2 === 0 ? centerX - cardGap : centerX + cardGap) 
             : (cardAlignment === "left" ? centerX - cardGap : centerX + cardGap)
          );
          
          const cpY1 = prevY + (y - prevY) * 0.5;
          const cpY2 = prevY + (y - prevY) * 0.5;
          
          path += \\\ C \\\ \\\, \\\ \\\, \\\ \\\\\\;
        });
        
        const lastEl = timelineRefs.current[events.length - 1];
        if (lastEl) {
           const finalY = lastEl.offsetTop + lastEl.offsetHeight / 2;
           const finalX = cardAlignment === "alternating" ? ((events.length-1) % 2 === 0 ? centerX - cardGap : centerX + cardGap) : (cardAlignment === "left" ? centerX - cardGap : centerX + cardGap);
           const extendedY = finalY + 100;
           const cpY1 = finalY + 50;
           const cpY2 = extendedY - 50;
           path += \\\ C \\\ \\\, \\\ \\\, \\\ \\\\\\;
        }
        
        setSvgPath(path);
      }
    };;

code = code.replace(
  /const updateHeights = \(\) => \{[\s\S]*?setMaxLineHeight\(el\.offsetTop \+ el\.offsetHeight \/ 2\);\n      \}\n    \};/,
  newUpdateHeights
);

// 3. Replace the static line and progress indicator in JSX
const newSvgRenderer =           <div className="relative z-20">
            {progressIndicator && svgPath && (
              <svg 
                className="absolute top-0 left-0 w-full h-full pointer-events-none" 
                style={{ zIndex: 0, height: maxLineHeight }}
              >
                <path d={svgPath} stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
                <motion.path 
                  d={svgPath} 
                  stroke="url(#timeline-gradient)" 
                  strokeWidth={progressLineWidth * 1.5} 
                  fill="none" 
                  strokeLinecap={progressLineCap}
                  style={{ pathLength: scrollYProgress }}
                />
                <defs>
                  <linearGradient id="timeline-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00c6e6" />
                    <stop offset="100%" stopColor="#00c6e6" />
                  </linearGradient>
                </defs>
              </svg>
            )};

code = code.replace(
  /<div\n            className=\{cn\(getConnectorClasses\(\), "absolute top-0 z-10"\)\}[\s\S]*?<\/motion\.div>\n            <\/>\n          \)}[\s\S]*?<div className="relative z-20">/,
  newSvgRenderer
);

// 4. Update the card alignment and dot placement in JSX
code = code.replace(
  /<div\n                    className=\{cn\(\n                      "absolute top-1\/2 transform -translate-y-1\/2 z-30",\n                      "left-1\/2 -translate-x-1\/2"\n                    \)\}/g,
  {(() => {
                    const isLeft = cardAlignment === "alternating" ? index % 2 === 0 : cardAlignment === "left";
                    return (
                  <div
                    className={cn(
                      "absolute top-1/2 transform -translate-y-1/2 z-30",
                      isLeft ? "left-[calc(50%-20px)] -translate-x-1/2" : "left-[calc(50%+20px)] -translate-x-1/2"
                    )}
);

code = code.replace(
  /                      \/>\n                    <\/div>\n                  <\/div>/g,
                        />
                    </div>
                  </div>
                  );
                  })()}
);

fs.writeFileSync(path, code);
console.log('Patched');
