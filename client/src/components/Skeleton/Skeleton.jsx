import React from 'react';
import './Skeleton.css';

const Skeleton = ({ width, height, borderRadius, style, className = '' }) => {
  const customStyle = {
    width: width || '100%',
    height: height || '20px',
    borderRadius: borderRadius || '8px',
    ...style
  };

  return (
    <div 
      className={`skeleton-base ${className}`} 
      style={customStyle}
    />
  );
};

export default Skeleton;
