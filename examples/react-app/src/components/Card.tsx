import React, { useState } from 'react';

interface CardProps {
  title: string;
  description: string;
}

export default function Card({ title, description }: CardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '16px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: hovered
          ? '0 4px 12px rgba(0,0,0,0.15)'
          : '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'box-shadow 0.2s',
        maxWidth: '320px',
        backgroundColor: hovered ? '#f9fafb' : '#fff',
      }}
      data-testid="card"
      data-hovered={hovered}
    >
      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{title}</h3>
      <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
        {description}
      </p>
    </div>
  );
}
