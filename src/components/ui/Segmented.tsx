// LISA: Segmented control — a radio group styled as a single quiet surface.

import React from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  title?: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** Stretch to fill the container, splitting width evenly between options. */
  block?: boolean;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  block = false,
}: SegmentedProps<T>) {
  return (
    <div className={`segmented${block ? ' segmented--block' : ''}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__item"
          aria-pressed={value === option.value}
          title={option.title}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
