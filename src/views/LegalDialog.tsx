import { useEffect, useRef } from 'react';
import { useLang } from '../lib/i18n';
import { closeLegal, openLegal, useLegal, type LegalTab } from '../lib/legal';
import { ImprintContent, PrivacyContent } from './Legal';

// Imprint and privacy notice in one dialog with tabs, as on exitiq.atares.team.

const TEXT = {
  en: { title: { imprint: 'Imprint', privacy: 'Privacy Policy' }, tab: { imprint: 'Imprint', privacy: 'Privacy' }, close: 'Close', note: '' },
  de: {
    title: { imprint: 'Impressum', privacy: 'Datenschutzerklärung' }, tab: { imprint: 'Impressum', privacy: 'Datenschutz' }, close: 'Schließen',
    note: 'Diese rechtlichen Hinweise liegen derzeit auf Englisch vor.',
  },
};

export function LegalDialog() {
  const tab = useLegal();
  const lang = useLang();
  const t = TEXT[lang];
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  // Remember what had focus, move focus into the dialog, lock page scroll, close on Escape.
  useEffect(() => {
    if (!tab) return;
    opener.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLegal();
      if (e.key === 'Tab' && panel.current) {
        // Keep keyboard focus inside the dialog.
        const f = Array.from(panel.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute('disabled'));
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [tab]);

  // Switching tabs starts the text at the top.
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [tab]);

  if (!tab) return null;
  const pick = (v: LegalTab) => openLegal(v);

  return (
    <div className="legal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeLegal(); }}>
      <div className="legal-dialog" role="dialog" aria-modal="true" aria-labelledby="legal-title" ref={panel} tabIndex={-1}>
        <div className="legal-dialog-head">
          <h2 id="legal-title">{t.title[tab]}</h2>
          <button type="button" className="legal-close" onClick={closeLegal} aria-label={t.close}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="legal-dialog-body" ref={body}>
          <div className="legal-tabs" role="tablist" aria-label={t.title[tab]}>
            {(['imprint', 'privacy'] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={tab === v} className="legal-tab" onClick={() => pick(v)}>{t.tab[v]}</button>
            ))}
          </div>
          {t.note && <p className="legal-note">{t.note}</p>}
          <div role="tabpanel" className="legal-text">
            {tab === 'imprint' ? <ImprintContent /> : <PrivacyContent />}
          </div>
        </div>
      </div>
    </div>
  );
}
