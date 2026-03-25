import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Hero from '../ui/Hero';
import Projects from './Projects';
import Team from '../ui/Team';
import Testimonials from '../ui/Testimonials';

const Home = () => {
    const { user, loading } = useAuth();

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
            <Hero />
            <Projects />
            <Team />
            <Testimonials />
        </>
    );
};

export default Home;
