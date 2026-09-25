// LISA: Modal primitive
// One consistent surface for every overlay in the product:
// Escape to dismiss, focus moved in and restored, Tab cycled inside, scroll locked.

import React, { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

type ModalSize = 'narrow' | 'default' | 'wide';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: ModalSize;
  /** Rendered to the left of the close button in the header. */
  headActions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  narrow: 'modal modal--narrow',
  default: 'modal',
  wide: 'modal modal--wide',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'default',
  headActions,
  footer,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = React.useId();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', handleKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        panel.querySelector<HTMLElement>('[data-autofocus]') ??
        panel.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(timer);
      restoreRef.current?.focus?.();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className={SIZE_CLASS[size]}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
            {subtitle && <p className="modal__sub">{subtitle}</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {headActions}
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="btn__icon" size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="modal__body">{children}</div>

        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
};
