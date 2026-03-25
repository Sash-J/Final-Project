import { useEffect, useRef } from "react";

export default function Starfield() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let width = window.innerWidth;
    let height = window.innerHeight;
    let isVisible = true;
    let lastSpawn = Date.now();

    if (!isVisible) {
      lastSpawn = Date.now(); // reset timer when hidden
    }

    document.addEventListener("visibilitychange", () => {
      isVisible = !document.hidden;
    });

    canvas.width = width;
    canvas.height = height;

    // ⭐ Star layers for parallax
    const layers = [
      { count: 80, speed: 0.05, size: 1 },
      { count: 50, speed: 0.1, size: 1.5 },
      { count: 30, speed: 0.2, size: 2 },
    ];

    let stars = [];

    layers.forEach((layer) => {
      for (let i = 0; i < layer.count; i++) {
        stars.push({
          cx: width / 2,
          cy: height / 2,
          radius: (Math.random() * Math.max(width, height)) / 2,
          angle: Math.random() * Math.PI * 2,
          speed: layer.speed * 0.0015, // slower rotation
          size: layer.size,
        });
      }
    });

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

        // 👇 Fade calculation
        const opacity = Math.pow(1 - s.life / s.maxLife, 3);

        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.length, s.y - s.length);
        ctx.shadowBlur = 10;
        ctx.shadowColor = "white";
        ctx.stroke();

        // Remove when faded out
        if (s.life >= s.maxLife) {
          shootingStars.splice(index, 1);
        }
      });

      requestAnimationFrame(animate);
    }

    animate();

    // Resize handling
    window.addEventListener("resize", () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    });
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
