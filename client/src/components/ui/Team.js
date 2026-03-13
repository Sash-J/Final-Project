import React from 'react';

const crew = [
    { id: 1, name: 'Alex Rivera', role: 'Director', image: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' },
    { id: 2, name: 'Sarah Chen', role: 'Cinematographer', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' },
    { id: 3, name: 'Marcus Johnson', role: 'Editor', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' },
    { id: 4, name: 'Emily Davis', role: 'Producer', image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' },
];

const Team = () => {
    return (
        <section id="team">
            <h2>Our Crew</h2>
            <div className="team-container">
                {crew.map((member) => (
                    <div key={member.id} className="team-member">
                        <img src={member.image} alt={member.name} className="member-img" />
                        <div className="member-name">{member.name}</div>
                        <div className="member-role">{member.role}</div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Team;
