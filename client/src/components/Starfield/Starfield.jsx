import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

export default function Starfield() {
  const canvasRef = useRef(null);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === "/";

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    let dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let isVisible = true;
    let lastSpawn = Date.now();
    let animationFrameId;

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        lastSpawn = Date.now();
        animate();
      } else {
        cancelAnimationFrame(animationFrameId);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      initStars();
    };

    const isMobile = width < 768;
    const densityMultiplier = isMobile ? 0.4 : 1;

    const layers = [
      { count: Math.floor(80 * densityMultiplier), speed: 0.06, size: 0.8 },
      { count: Math.floor(50 * densityMultiplier), speed: 0.1, size: 1.2 },
      { count: Math.floor(30 * densityMultiplier), speed: 0.15, size: 1.6 },
    ];

    let stars = [];

    function initStars() {
      stars = [];
      layers.forEach((layer) => {
        for (let i = 0; i < layer.count; i++) {
          stars.push({
            cx: width / 2,
            cy: height / 2,
            radius: (Math.random() * Math.max(width, height)) / 2,
            angle: Math.random() * Math.PI * 2,
            speed: layer.speed * 0.0015,
            size: layer.size,
          });
        }
      });
    }

    resize();

    let shootingStars = [];

    function createShootingStar() {
      shootingStars.push({
        x: Math.random() * width,
        y: 0,
        length: Math.random() * 50 + 30,
        speed: Math.random() * 1 + 2,
        life: 0,
        maxLife: 160,
      });
    }

    function animate() {
      // 1. Draw Background based on theme
      // Home page is always dark regardless of user theme preference
      if (isLightTheme && !isHomePage) {
        ctx.fillStyle = "#ffffff"; // pure white background
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.fillStyle = "#020407ff"; // dark theme background color
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Draw Stars based on theme
      stars.forEach((star) => {
        star.angle += star.speed;

        const x = star.cx + Math.cos(star.angle) * star.radius;
        const y = star.cy + Math.sin(star.angle) * star.radius;

        if (isLightTheme && !isHomePage) {
          ctx.fillStyle = "rgba(60, 60, 65, 0.8)"; // dark gray for light mode — no blue tint
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; // white particles for dark mode
        }

        ctx.beginPath();
        ctx.arc(x, y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Spawning Shooting Stars
      const now = Date.now();
      if (!isVisible) {
        lastSpawn = now;
      }

      if (isVisible && now - lastSpawn > 2000) {
        if (Math.random() < 0.4) {
          createShootingStar();
        }
        lastSpawn = now;
      }

      // 4. Draw Shooting Stars based on theme
      shootingStars.forEach((s, index) => {
        s.x += s.speed;
        s.y += s.speed;
        s.life++;

        const opacity = Math.pow(1 - s.life / s.maxLife, 3);
        
        if (isLightTheme && !isHomePage) {
          ctx.strokeStyle = `rgba(80, 80, 85, ${opacity})`; // neutral gray streak
          ctx.shadowColor = "rgba(80, 80, 85, 0.5)"; // subtle gray glow
        } else {
          ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`; // white
          ctx.shadowColor = "white"; // white glow
        }
        
        ctx.lineWidth = isMobile ? 0.8 : 1;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.length, s.y - s.length);
        ctx.shadowBlur = isMobile ? 4 : 10;
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow

        if (s.life >= s.maxLife) {
          shootingStars.splice(index, 1);
        }
      });

      if (isVisible) {
        animationFrameId = requestAnimationFrame(animate);
      }
    }

    animate();

    window.addEventListener("resize", resize);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isLightTheme, isHomePage]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
