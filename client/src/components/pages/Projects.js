import React from 'react';

const projects = [
    { id: 1, title: 'Neon Nights', category: 'Music Video', image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae' },
    { id: 2, title: 'Urban Flow', category: 'Commercial', image: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4' },
    { id: 3, title: 'Silent Peak', category: 'Documentary', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b' },
    { id: 4, title: 'Future Tech', category: 'Corporate', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475' },
    { id: 5, title: 'Golden Hour', category: 'Short Film', image: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8' },
    { id: 6, title: 'Velocity', category: 'Automotive', image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb' },
];

const Projects = () => {
    return (
        <section id="projects">
            <h2>Selected Works</h2>
            <div className="projects-grid">
                {projects.map((project) => (
                    <div key={project.id} className="project-card">
                        <div className="project-bg" style={{ backgroundImage: `url(${project.image})` }}></div>
                        <div className="project-info">
                            <h3>{project.title}</h3>
                            <p>{project.category}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Projects;
