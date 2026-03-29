import React from 'react';
import Skeleton from './Skeleton';
import './Skeleton.css';

export const DashboardMetricsSkeleton = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="glass-panel" style={{ padding: '20px', minHeight: '120px' }}>
        <Skeleton width="40%" height="15px" style={{ marginBottom: '15px' }} />
        <Skeleton width="80%" height="30px" />
      </div>
    ))}
  </div>
);

export const DashboardTableSkeleton = ({ rows = 5 }) => (
  <div className="glass-panel" style={{ padding: '20px' }}>
    <Skeleton width="150px" height="24px" style={{ marginBottom: '20px' }} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      {[...Array(rows)].map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '15px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Skeleton width="50px" height="40px" borderRadius="4px" />
          <div style={{ flex: 1 }}>
            <Skeleton width="60%" height="15px" style={{ marginBottom: '8px' }} />
            <Skeleton width="30%" height="12px" />
          </div>
          <Skeleton width="80px" height="30px" borderRadius="15px" />
        </div>
      ))}
    </div>
  </div>
);

const DashboardSkeleton = () => {
  return (
    <div style={{ padding: '20px' }}>
      <DashboardMetricsSkeleton />
      <DashboardTableSkeleton />
    </div>
  );
};

export default DashboardSkeleton;
