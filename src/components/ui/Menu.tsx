// LISA: Overflow menu — keeps secondary instrument actions out of the header
// without removing them. Dismisses on Escape, outside click, or selection.

import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
}

interface MenuProps {
  label: string;
  groups: MenuItem[][];
}

export const Menu: React.FC<MenuProps> = ({ label, groups }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="menu" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn--ghost btn--icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="btn__icon" size={18} aria-hidden="true" />
      </button>

      {open && (
        <div className="menu__panel" role="menu" aria-label={label}>
          {groups.map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <div className="menu__sep" role="separator" />}
              {group.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="menu__item"
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.icon && (
                    <span className="menu__item-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                  {item.hint && <span className="menu__item-hint">{item.hint}</span>}
                </button>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
