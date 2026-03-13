import React from 'react';

const Testimonials = () => {
    return (
        <section id="testimonials">
            <h2>Client Feedback</h2>
            <div className="testimonials-container">
                <div className="testimonial-card">
                    <p className="client-feedback">"Lumos Productions completely transformed our brand vision into a visual masterpiece. Their attention to detail and cinematic approach is unmatched in the industry."</p>
                    <p className="client-name">- Jessica Pearson, CEO of TechNova</p>
                </div>
                <div className="testimonial-card">
                    <p className="client-feedback">"Professional, creative, and incredibly talented crew. They made the entire filming process smooth and the final result exceeded our expectations."</p>
                    <p className="client-name">- Michael Ross, Director at Urban Arts</p>
                </div>
            </div>
        </section>
    );
};

export default Testimonials;
