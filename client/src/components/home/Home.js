import React, { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from './Navbar';
import Hero from './Hero';
import Projects from './Projects';
import Team from '../ui/Team';
import Testimonials from '../ui/Testimonials';
import Footer from './Footer';
import './Home.css';

const Home = () => {
    const { user, loading } = useAuth();
    const containerRef = useRef(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e) => {
            if (e.deltaY === 0) return;
            container.scrollLeft += e.deltaY;
            e.preventDefault();
        };

        const handleKeyDown = (e) => {
            // Don't hijack keyboard inputs if user is focused on interactive inputs
            if (e.target.matches('input, textarea, select, button, [contenteditable="true"]')) {
                return;
            }

            const scrollAmount = window.innerWidth;
            const arrowScrollAmount = 150;

            if (e.key === 'PageDown' || e.key === ' ') {
                container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
                e.preventDefault();
            } else if (e.key === 'PageUp') {
                container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                container.scrollBy({ left: arrowScrollAmount, behavior: 'smooth' });
                e.preventDefault();
            } else if (e.key === 'ArrowLeft') {
                container.scrollBy({ left: -arrowScrollAmount, behavior: 'smooth' });
                e.preventDefault();
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            container.removeEventListener('wheel', handleWheel);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    if (loading) return null;

    if (user) {
        if (user.role === 'admin' || user.role === 'manager') {
            return <Navigate to="/admin" />;
        }
        if (user.role === 'production_crew') {
            return <Navigate to="/crew-dashboard" />;
        }
        return <Navigate to="/dashboard" />;
    }

    return (
        <>
            <Navbar />
            <div className="horizontal-scroll-container" ref={containerRef}>
                <div className="horizontal-section">
                    <Hero />
                </div>
                <div className="horizontal-section">
                    <Projects />
                </div>
                <div className="horizontal-section">
                    <Team />
                </div>
                <div className="horizontal-section">
                    <Testimonials />
                </div>
                <div className="horizontal-section footer-slide">
                    <Footer />
                </div>
            </div>
        </>
    );
};

export default Home;
