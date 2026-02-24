import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Vision Verifier Example App</h1>
      <p>This app provides test components for the verification pipeline.</p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
