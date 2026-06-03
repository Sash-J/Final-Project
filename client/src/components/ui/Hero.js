import React, { useEffect, useState } from 'react';
import monolithHero from '../../assets/monolith_hero.png';

const Hero = () => {
    const [processedBg, setProcessedBg] = useState('');

    useEffect(() => {
        const img = new Image();
        img.src = monolithHero;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            // Make the black sky transparent
            // Black sky is in the top 58% of the image
            const threshold = 20;
            const heightLimit = canvas.height * 0.58;

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const idx = (y * canvas.width + x) * 4;
                    if (y < heightLimit) {
                        const r = data[idx];
                        const g = data[idx + 1];
                        const b = data[idx + 2];
                        // If near black, set alpha to 0
                        if (r < threshold && g < threshold && b < threshold) {
                            data[idx + 3] = 0;
                        }
                    }
                }
            }

            ctx.putImageData(imgData, 0, 0);
            setProcessedBg(canvas.toDataURL());
        };
    }, []);

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

        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('wheel', handleActivity);

        timeoutId = setTimeout(() => {
            setShowScroll(true);
        }, 10000);

        return () => {
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('wheel', handleActivity);
            clearTimeout(timeoutId);
        };
    }, []);

    return (
        <section 
            id="hero" 
            className="reframe-hero"
            style={{ backgroundImage: processedBg ? `url(${processedBg})` : 'none' }}
        >
            <div className="reframe-hero-overlay"></div>
            <div className="reframe-hero-top">
                <p className="reframe-subtitle">
                    Everything has a perspective.
                </p>
            </div>
            
            <div className="reframe-hero-bg-text">
                VISION<span>·</span>DIVISION
            </div>

            <div className="reframe-hero-bottom">
                <h1 className="reframe-title">Vision Division</h1>
                <p className="reframe-tagline">Sri Lanka's 1st web-based production team</p>
            </div>

            <div 
                className={`reframe-scroll-indicator ${showScroll ? 'visible' : 'hidden'}`}
                onClick={() => {
                    const container = document.querySelector('.horizontal-scroll-container');
                    if (container) {
                        container.scrollTo({ left: window.innerWidth, behavior: 'smooth' });
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
