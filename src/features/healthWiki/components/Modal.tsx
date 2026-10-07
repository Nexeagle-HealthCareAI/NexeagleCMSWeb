import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Small accessible dialog: Escape and a click outside close it, focus moves in and returns on close. */
export default function Modal({ title, onClose, children }: Props) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>('input, select, textarea, button');
    first?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('keydown', esc); previous?.focus(); };
  }, [onClose]);

  return (
    <div className="hw-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="hw-modal-box" role="dialog" aria-modal="true" aria-labelledby={id} ref={box}>
        <h2 id={id}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
