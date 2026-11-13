import { useEffect, useState } from 'react';
import { navigate } from '../../App';
import { useT } from '../../i18n/ui';
import { useJT } from '../../i18n/ui-journey';
import { deepList, progressCounts } from '../../lib/journey';
import { locale, useLang } from '../../lib/i18n';
import { linkEmail } from '../../lib/remote';
import { deleteEverything, resume, startNew, syncAll, useAssessment } from '../../lib/store';
import { useBackupHealth } from './Banners';

export function Saved() {
  const s = useAssessment();
  const lang = useLang();
  const t = useT();
  const jt = useJT();
  const health = useBackupHealth();
  const [checking, setChecking] = useState(false);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'new' | null>(null);
  const { answered, open } = progressCounts(deepList(s.ctx), s.answers);
  // Saving and returning is the moment to make sure the online copy is complete.
  useEffect(() => {
    if (health.online === true) return;
    setChecking(true);
    void syncAll().finally(() => setChecking(false));
  }, []);
  const backup = health.online === true ? 'on' : checking || health.online === null ? 'checking' : 'off';
  const when = s.savedAt ? new Date(s.savedAt).toLocaleString(locale(lang), { dateStyle: 'medium', timeStyle: 'short' }) : null;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="kicker">{t.savedKicker}</div>
        <h1 className="h1">{jt.savedTitle}</h1>
        <p className="lead" style={{ color: 'rgba(255,255,255,0.86)', fontSize: 17 }}>
          {jt.savedLead(answered, open, when)}
        </p>
      </div>

      <dl className="save-status glass">
        <div><dt>{jt.onBrowser}</dt><dd><span className="status-dot on" aria-hidden="true" />{jt.savedYes}</dd></div>
        <div>
          <dt>{jt.onlineBackup}</dt>
          <dd><span className={`status-dot ${backup}`} aria-hidden="true" />{backup === 'on' ? jt.backupOn : backup === 'off' ? jt.backupOff : jt.backupChecking}</dd>
        </div>
        {backup === 'off' && (
          <div className="save-status-wide">
            <p>{jt.backupOffBody}</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setChecking(true); void syncAll().finally(() => setChecking(false)); }}>{jt.tryAgain}</button>
          </div>
        )}
        {backup === 'on' && <p className="save-status-wide">{jt.backupOnBody}</p>}
      </dl>

      {backup === 'on' && (
      <section className="glass" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-labelledby="link-title">
        <h2 id="link-title" style={{ margin: 0, fontSize: 18 }}>{t.linkTitle}</h2>
          <>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.8)' }}>
              {t.linkBody}
            </p>
            <form style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} onSubmit={async (e) => { e.preventDefault(); setBusy(true); setMsg(await linkEmail(email)); setBusy(false); }}>
              <label className="sr-only" htmlFor="save-email">{t.emailLabel}</label>
              <input id="save-email" className="input" style={{ flex: '1 1 260px' }} type="email" required autoComplete="email" placeholder={t.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" className="btn btn-lime" disabled={busy}>{busy ? t.sending : t.sendLink}</button>
            </form>
            {msg && <p role="status" title={msg.ok ? undefined : msg.message} style={{ margin: 0, fontSize: 14, color: msg.ok ? 'var(--lime)' : 'var(--lime-2)' }}>{msg.ok ? t.linkSent : jt.linkFailed}</p>}
          </>
      </section>
      )}

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
