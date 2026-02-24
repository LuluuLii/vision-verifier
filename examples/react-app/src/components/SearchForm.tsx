import React, { useState } from 'react';

interface SearchFormProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
}

export default function SearchForm({
  placeholder = 'Search...',
  onSearch,
}: SearchFormProps) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    onSearch?.(query);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '8px 12px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontSize: '14px',
          flex: 1,
        }}
      />
      <button
        type="submit"
        style={{
          padding: '8px 16px',
          backgroundColor: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Search
      </button>
      {submitted && (
        <span data-testid="search-result" style={{ alignSelf: 'center', color: '#6b7280' }}>
          Searched: {query}
        </span>
      )}
    </form>
  );
}
