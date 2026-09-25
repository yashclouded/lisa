// LISA: Disclosure — progressive disclosure for technical depth.
// Keeps the default surface calm while leaving every scientific detail one tap away.

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface DisclosureProps {
  label: string;
  /** Optional right-aligned summary shown while collapsed. */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const Disclosure: React.FC<DisclosureProps> = ({
  label,
  summary,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = React.useId();

  return (
    <div className="disclosure">
      <button
        type="button"
        className="disclosure__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight className="disclosure__chevron" size={15} aria-hidden="true" />
        <span>{label}</span>
        {!open && summary != null && (
          <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontWeight: 400 }}>
            {summary}
          </span>
        )}
      </button>
      {open && (
        <div className="disclosure__panel" id={panelId}>
          {children}
        </div>
      )}
    </div>
  );
};
