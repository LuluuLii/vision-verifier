import React, { useState } from 'react';

interface DropdownProps {
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export default function Dropdown({
  options,
  defaultValue = '',
  onChange,
}: DropdownProps) {
  const [selected, setSelected] = useState(defaultValue);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelected(e.target.value);
    onChange?.(e.target.value);
  };

  return (
    <div>
      <select
        value={selected}
        onChange={handleChange}
        style={{
          padding: '8px 12px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontSize: '14px',
          minWidth: '200px',
        }}
      >
        <option value="" disabled>
          Select an option
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {selected && (
        <p data-testid="selected-value" style={{ marginTop: '8px', color: '#6b7280' }}>
          Selected: {selected}
        </p>
      )}
    </div>
  );
}
