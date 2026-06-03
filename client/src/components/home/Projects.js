import React, { useState } from "react";

const projects = [
  {
    id: 1,
    title: "Echoes of Silence",
    category: "Cinematic Short Film",
    tag: "Latest Release",
    year: "2024",
    image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5",
    youtubeId: "aqz-KE-bpKQ"
  },
  {
    id: 2,
    title: "Urban Pulse",
    category: "Commercial Film",
    tag: "Commercial",
    year: "2024",
    image: "https://images.unsplash.com/photo-1514565131-fce0801e5785",
    youtubeId: "Y4pI1sCgN88"
  },
  {
    id: 3,
    title: "Beyond the Light",
    category: "Music Video",
    tag: "Music Video",
    year: "2024",
    image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7",
    youtubeId: "d9S5hS_l08A"
  },
  {
    id: 4,
    title: "Silent Peak",
    category: "Documentary Film",
    tag: "Documentary",
    year: "2023",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
    youtubeId: "8z5R4x6C9sM"
  },
  {
    id: 5,
    title: "Future Tech",
    category: "Corporate Film",
    tag: "Corporate",
    year: "2023",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa",
    youtubeId: "tO01J-M3g0U"
  },
  {
    id: 6,
    title: "Velocity",
    category: "Automotive Showreel",
    tag: "Automotive",
    year: "2024",
    image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb",
    youtubeId: "_t431JjG1aU"
  }
];

const Projects = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const handlePrev = (e) => {
    e.stopPropagation();
    setPlayingIndex(null);
    setActiveIndex((prev) => (prev - 1 + projects.length) % projects.length);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setPlayingIndex(null);
    setActiveIndex((prev) => (prev + 1) % projects.length);
  };

  const handleSlideClick = (index) => {
    if (index === activeIndex) {
      if (playingIndex === null) {
        setPlayingIndex(index);
      }
    } else {
      setPlayingIndex(null);
      setActiveIndex(index);
    }
  };

  return (
    <section
      id="projects"
      className="reframe-projects-section"
      style={{ backgroundImage: "url(/dunes_background1.png)" }}
    >
      <div className="section-header">
        <h2 className="section-title">Our Latest Work</h2>
      </div>
      
      <div className={`carousel-wrapper ${isMaximized ? "is-maximized" : ""}`}>
        <button className="carousel-control prev" onClick={handlePrev} aria-label="Previous Project">
          <span className="control-arrow">&#8592;</span>
        </button>

        <div className="carousel-container">
          {projects.map((project, index) => {
            let offset = index - activeIndex;
            // Handle loop offset
            if (offset < -projects.length / 2) {
              offset += projects.length;
            } else if (offset > projects.length / 2) {
              offset -= projects.length;
            }

            let positionClass = "";
            if (offset === 0) {
              positionClass = "active";
            } else if (offset === -1) {
              positionClass = "left";
            } else if (offset === 1) {
              positionClass = "right";
            } else if (offset < -1) {
              positionClass = "hidden-left";
            } else if (offset > 1) {
              positionClass = "hidden-right";
            }

            const isPlaying = playingIndex === index;

            return (
              <div
                key={project.id}
                className={`carousel-slide ${positionClass} ${isPlaying ? "playing" : ""}`}
                onClick={() => handleSlideClick(index)}
              >
                {positionClass === "active" && (
                  <button 
                    className="card-maximize-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMaximized(!isMaximized);
                    }}
                    aria-label="Maximize Card"
                  >
                    {isMaximized ? (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M4 14h6v6H8v-4H4v-2zm10-10h2v4h4v2h-6V4zm0 10h6v2h-4v4h-2v-6zM4 4h4v4H4V4z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                      </svg>
                    )}
                  </button>
                )}

                {isPlaying ? (
                  <>
                    <iframe
                      src={`https://www.youtube.com/embed/${project.youtubeId}?autoplay=1&rel=0`}
                      title={project.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="project-video-iframe"
                    ></iframe>
                    <button 
                      className="close-video-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlayingIndex(null);
                      }} 
                      aria-label="Close Video"
                    >
                      &times;
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      className="project-bg"
                      style={{ backgroundImage: `url(${project.image})` }}
                    ></div>
                    <div className="play-button-overlay">
                      <div className="play-button-circle">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    <div className="project-info">
                      <span className="project-tag-pill">{project.tag}</span>
                      <h3 className="project-title-text">{project.title}</h3>
                      <p className="project-subtitle-text">{project.category}</p>
                      <span className="project-year">{project.year}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <button className="carousel-control next" onClick={handleNext} aria-label="Next Project">
          <span className="control-arrow">&#8594;</span>
        </button>
      </div>

      <div className="carousel-dots">
        {projects.map((_, index) => (
          <button
            key={index}
            className={`carousel-dot ${index === activeIndex ? "active" : ""}`}
            onClick={() => selectIndex(index)}
            aria-label={`Go to slide ${index + 1}`}
          ></button>
        ))}
      </div>
    </section>
  );

  function selectIndex(index) {
    setPlayingIndex(null);
    setActiveIndex(index);
  }
};

export default Projects;
