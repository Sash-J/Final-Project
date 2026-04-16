import { useEffect, useRef } from "react";

export default function Starfield() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
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
        animate(); // Restart animation when visible
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

    // ⭐ Adaptive Star Density for Mobile
    const isMobile = width < 768;
    const densityMultiplier = isMobile ? 0.4 : 1;

    const layers = [
      { count: Math.floor(80 * densityMultiplier), speed: 0.05, size: 0.8 },
      { count: Math.floor(50 * densityMultiplier), speed: 0.1, size: 1.2 },
      { count: Math.floor(30 * densityMultiplier), speed: 0.2, size: 1.6 },
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

    // 🌠 Shooting stars
    let shootingStars = [];

    function createShootingStar() {
      shootingStars.push({
        x: Math.random() * width,
        y: 0,
        length: Math.random() * 50 + 30,
        speed: Math.random() * 1 + 2,
        life: 0,
        maxLife: 160, // total lifetime
      });
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // ⭐ Draw stars
      stars.forEach((star) => {
        star.angle += star.speed;

        const x = star.cx + Math.cos(star.angle) * star.radius;
        const y = star.cy + Math.sin(star.angle) * star.radius;

        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(x, y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

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

      // 🌠 Draw shooting stars
      shootingStars.forEach((s, index) => {
        s.x += s.speed;
        s.y += s.speed;
        s.life++;

        const opacity = Math.pow(1 - s.life / s.maxLife, 3);
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = isMobile ? 0.8 : 1;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.length, s.y - s.length);
        ctx.shadowBlur = isMobile ? 4 : 10;
        ctx.shadowColor = "white";
        ctx.stroke();

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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        background: "black",
      }}
    />
  );
}
