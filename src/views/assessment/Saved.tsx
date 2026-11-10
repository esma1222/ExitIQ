import { useState } from 'react';
import { navigate } from '../../App';
import { useT } from '../../i18n/ui';
import { locale, useLang } from '../../lib/i18n';
import { linkEmail, remoteAvailable } from '../../lib/remote';
import { deleteEverything, resume, startNew, useAssessment } from '../../lib/store';

export function Saved() {
  const s = useAssessment();
  const lang = useLang();
  const t = useT();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'new' | null>(null);
  const answered = Object.keys(s.answers).length;
  const when = s.savedAt ? new Date(s.savedAt).toLocaleString(locale(lang), { dateStyle: 'medium', timeStyle: 'short' }) : null;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="kicker">{t.savedKicker}</div>
        <h1 className="h1">{t.savedTitle}</h1>
        <p className="lead" style={{ color: 'rgba(255,255,255,0.86)', fontSize: 17 }}>
          {t.savedLead(answered, when)}
        </p>
      </div>

      <section className="glass" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-labelledby="link-title">
        <h2 id="link-title" style={{ margin: 0, fontSize: 18 }}>{t.linkTitle}</h2>
        {remoteAvailable() ? (
          <>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.8)' }}>
              {t.linkBody}
            </p>
            <form style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} onSubmit={async (e) => { e.preventDefault(); setBusy(true); setMsg(await linkEmail(email)); setBusy(false); }}>
              <label className="sr-only" htmlFor="save-email">{t.emailLabel}</label>
              <input id="save-email" className="input" style={{ flex: '1 1 260px' }} type="email" required autoComplete="email" placeholder={t.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" className="btn btn-lime" disabled={busy}>{busy ? t.sending : t.sendLink}</button>
            </form>
            {msg && <p role="status" style={{ margin: 0, fontSize: 14, color: msg.ok ? 'var(--lime)' : 'var(--lime-2)' }}>{msg.ok ? t.linkSent : msg.message.startsWith('Online saving') ? t.linkOffline : msg.message}</p>}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.8)' }}>{t.offline}</p>
        )}
      </section>

      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>{t.backToStart}</button>
        <div className="right">
          <button type="button" className="btn btn-lime" onClick={resume}>{t.resume} <span aria-hidden="true">→</span></button>
        </div>
      </div>

      <section style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'rgba(255,255,255,0.74)', alignItems: 'center' }}>
        {confirm === null && (
          <>
            <button type="button" className="btn-link" style={{ background: 'none', cursor: 'pointer' }} onClick={() => setConfirm('new')}>{t.startNewLink}</button>
            <button type="button" className="btn-link" style={{ background: 'none', cursor: 'pointer', color: '#ff9c8f' }} onClick={() => setConfirm('delete')}>{t.deleteThis}</button>
          </>
        )}
        {confirm === 'new' && (
          <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {t.startOverQ}
            <button type="button" className="btn btn-lime btn-sm" onClick={() => startNew()}>{t.startNew}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>{t.cancel}</button>
          </span>
        )}
        {confirm === 'delete' && (
          <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {t.deleteWarn}
            <button type="button" className="btn btn-sm" style={{ background: 'var(--red)', color: 'var(--white)' }} onClick={async () => { await deleteEverything(); navigate('/'); }}>{t.delete}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>{t.cancel}</button>
          </span>
        )}
      </section>
    </>
  );
}
