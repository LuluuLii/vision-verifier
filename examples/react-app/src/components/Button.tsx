import React from 'react';

interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  onClick?: () => void;
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary: { backgroundColor: '#3b82f6', color: '#fff' },
  secondary: { backgroundColor: '#6b7280', color: '#fff' },
  danger: { backgroundColor: '#ef4444', color: '#fff' },
};

export default function Button({
  label,
  variant = 'primary',
  disabled = false,
  onClick,
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 16px',
        borderRadius: '6px',
        border: 'none',
        fontSize: '14px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...variantStyles[variant],
      }}
    >
      {label}
    </button>
  );
}
