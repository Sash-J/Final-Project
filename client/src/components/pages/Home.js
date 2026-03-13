import React from 'react';
import Hero from '../ui/Hero';
import Projects from './Projects';
import Team from '../ui/Team';
import Testimonials from '../ui/Testimonials';

const Home = () => {
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
