/**
 * InfoTip - a small (i) button that explains what a heading or setting is,
 * instead of a paragraph of description under it (2026-10-14, the user's own
 * ask). Click or press it to open the text; click elsewhere or press Escape to
 * close. Works inside links and labels: it never passes the click on.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const INFO_PATH = 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z';

export default function InfoTip({ text, className = '' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!text) return null;

  return (
    <span ref={ref} className={`relative inline-flex shrink-0 ${className}`.trim()}>
      <button
        type="button"
        aria-label={t('common.moreInfo')}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="grid h-6 w-6 place-items-center rounded-full text-muted transition-colors hover:bg-border/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={INFO_PATH} />
        </svg>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute start-0 top-full z-50 mt-2 w-72 max-w-[80vw] rounded-xl border border-border bg-surface p-3 text-start text-sm font-normal normal-case leading-relaxed tracking-normal text-text shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
