import React from 'react';

interface ErrorComponentProps {
  shouldError?: boolean;
}

export default function ErrorComponent({
  shouldError = false,
}: ErrorComponentProps) {
  if (shouldError) {
    throw new Error('Intentional render error for testing');
  }

  return (
    <div style={{ padding: '16px', color: '#059669' }}>
      Component rendered successfully
    </div>
  );
}
