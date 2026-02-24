import React, { useState } from 'react';

interface CounterProps {
  initial?: number;
}

export default function Counter({ initial = 0 }: CounterProps) {
  const [count, setCount] = useState(initial);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <button
        onClick={() => setCount((c) => c - 1)}
        style={{ padding: '4px 12px', fontSize: '16px' }}
      >
        -
      </button>
      <span data-testid="count" style={{ fontSize: '24px', minWidth: '40px', textAlign: 'center' }}>
        {count}
      </span>
      <button
        onClick={() => setCount((c) => c + 1)}
        style={{ padding: '4px 12px', fontSize: '16px' }}
      >
        +
      </button>
    </div>
  );
}
