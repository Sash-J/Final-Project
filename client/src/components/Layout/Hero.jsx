import { useEffect, useState } from "react";

const Hero = () => {
  const [showScroll, setShowScroll] = useState(true);

  useEffect(() => {
    let timeoutId;

    const handleActivity = () => {
      setShowScroll(false);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setShowScroll(true);
      }, 3000);
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("wheel", handleActivity);

    timeoutId = setTimeout(() => {
      setShowScroll(true);
    }, 10000);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("wheel", handleActivity);
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <section
      id="hero"
      className="reframe-hero"
      style={{ backgroundImage: 'url("/monolith_hero.png")' }}
    >
      <div className="reframe-hero-overlay"></div>
      <div className="reframe-hero-top">
        <p className="reframe-subtitle">A New Era of Cinematic Expression</p>
      </div>

      <div className="reframe-hero-bg-text">
        Vision Division
      </div>

      <div className="reframe-hero-bottom">
        <h1 className="reframe-title">Vision Division</h1>
        <p className="reframe-tagline">
          Sri Lanka's 1st web-based production team
        </p>
      </div>

      <div
        className={`reframe-scroll-indicator ${showScroll ? "visible" : "hidden"}`}
        onClick={() => {
          const container = document.querySelector(
            ".horizontal-scroll-container",
          );
          if (container) {
            container.scrollTo({ left: window.innerWidth, behavior: "smooth" });
          }
        }}
      >
        <div className="mouse-wheel"></div>
        <span>SCROLL</span>
      </div>
    </section>
  );
};

export default Hero;
