import React from 'react';

const Navbar = () => {
    return (
        <nav className="navbar">
            <a href="#" className="logo">LUMOS PRODUCTIONS</a>
            <ul className="nav-links">
                <li><a href="#hero">Home</a></li>
                <li><a href="#projects">Work</a></li>
                <li><a href="#team">Crew</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
    );
};

export default Navbar;
