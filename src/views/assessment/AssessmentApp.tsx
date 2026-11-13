import { useEffect, useState } from 'react';
import { Brand, LangSwitch } from '../../components/ui';
import { useT } from '../../i18n/ui';
import { useJT } from '../../i18n/ui-journey';
import { locale, useLang } from '../../lib/i18n';
import { assessmentComplete, stepStates } from '../../lib/journey';
import { onSyncStatus, type BackupHealth, type SyncStatus } from '../../lib/remote';
import { go, hasProgress, hydrateFromRemote, syncAll, useAssessment, type Screen } from '../../lib/store';
import { ContextScreen, SetupScreen } from './Context';
import { Deep } from './Deep';
import { Discovery } from './Discovery';
import { Picture } from './Picture';
import { Result } from './Result';
import { Saved } from './Saved';
import { Summary } from './Summary';
import { Banners, useBackupHealth } from './Banners';

/** Question screens get the calmer, uniform surface; landing-like screens keep the brand artwork. */
const CALM: Screen[] = ['discovery', 'setup', 'specialist', 'deep'];

function useSync(): SyncStatus {
  const [s, set] = useState<SyncStatus>('idle');
  useEffect(() => onSyncStatus((a) => set(a)), []);
  return s;
}

export default function AssessmentApp() {
  const state = useAssessment();
  const sync = useSync();
  const health = useBackupHealth();
  const [ready, setReady] = useState(hasProgress(state));
  const lang = useLang();
  const t = useT();
  const jt = useJT();

  useEffect(() => {
    document.title = t.docTitle;
  }, [t]);

  useEffect(() => {
    if (ready) return;
    // A returning visitor on a fresh browser tab (or after confirming their email) gets their saved assessment back.
    void hydrateFromRemote().finally(() => setReady(true));
  }, [ready]);

  // On opening with progress, reconcile once so the backup notice reflects reality and offline work goes up.
  useEffect(() => {
    if (ready && hasProgress()) void syncAll();
  }, [ready]);

  const steps = stepStates(state.screen, assessmentComplete(state.ctx, state.answers), state.resumeTo);
  const time = state.savedAt ? new Date(state.savedAt).toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' }) : null;
  // Calm wording: the browser copy is what is guaranteed; infrastructure detail never shows here.
  const saveLabel = !time ? t.saveIdle
    : sync === 'saving' && health.online !== false ? t.saving
    : health.online === true ? t.saved(time)
    : jt.savedBrowserAt(time);

  return (
    <div className={`app-bg${CALM.includes(state.screen) ? ' calm' : ''}`}>
      <a href="#main" className="sr-only">{t.skip}</a>
      <header className="app-header no-print">
        <div className="app-header-inner">
          <Brand />
          <ol className="stepper" aria-label={t.progressAria}>
            {t.steps.map((l, i) => (
              <li key={i} className={steps[i] === 'todo' ? '' : steps[i]} aria-current={steps[i] === 'current' ? 'step' : undefined}>
                <span className="dot" aria-hidden="true">{steps[i] === 'done' ? '✓' : i + 1}</span>
                <span className="label">{l}</span>
              </li>
            ))}
          </ol>
          <div className="save-state">
            <LangSwitch />
            <span aria-live="polite">{saveLabel}</span>
            {state.screen !== 'saved' && hasProgress(state) && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('saved')}>{t.saveReturnLater}</button>
            )}
          </div>
        </div>
      </header>
      {hasProgress(state) && <BackupNotice health={health} />}

      <div id="main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!ready ? (
          <main className="app-main"><p className="muted-light">{t.loading}</p></main>
        ) : (
          <Screens />
        )}
      </div>

      {state.screen !== 'result' && (
        <footer className="app-footer no-print">
          {t.disclaimer}
        </footer>
      )}
    </div>
  );
}

/**
 * Persistent, calm notice while the online backup does not work. It stays until
 * an online write actually succeeds; "Try again" signs in again and pushes the
 * full current state (syncAll), so local and online match afterwards.
 */
export function BackupNotice({ health }: { health: BackupHealth }) {
  const jt = useJT();
  const [busy, setBusy] = useState(false);
  const [failedRetry, setFailedRetry] = useState(false);
  const [restored, setRestored] = useState(false);
  const [wasOff, setWasOff] = useState(false);

  useEffect(() => {
    if (health.online === false) setWasOff(true);
    if (health.online === true && wasOff) {
      setWasOff(false);
      setRestored(true);
      const id = setTimeout(() => setRestored(false), 6000);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [health.online, wasOff]);

  if (restored && health.online === true) {
    return (
      <div className="backup-notice ok no-print" role="status">
        <div className="backup-inner"><span>{jt.backupBack}</span></div>
      </div>
    );
  }
  if (health.online !== false) return null;

  const retry = async () => {
    setBusy(true);
    setFailedRetry(false);
    const ok = await syncAll();
    setBusy(false);
    if (!ok) setFailedRetry(true);
  };

  return (
    <div className="backup-notice no-print" role="status">
      <div className="backup-inner">
        <span className="backup-dot" aria-hidden="true" />
        <span className="backup-text">
          {jt.backupOffNotice}
          {failedRetry && !busy && <span className="backup-sub">{jt.stillOff}</span>}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={retry} disabled={busy}>{busy ? jt.trying : jt.tryAgain}</button>
        {health.detail && (
          <details className="backup-details">
            <summary>{jt.techDetails}</summary>
            <code>{health.detail}</code>
          </details>
        )}
      </div>
    </div>
  );
}

function Screens() {
  const s = useAssessment();
  switch (s.screen) {
    case 'context':
      return <ContextScreen />;
    case 'setup':
    case 'specialist':
      return <SetupScreen step={s.screen} />;
    case 'summary':
      return <Wrap><Banners /><Summary /></Wrap>;
    case 'discovery':
      return <Wrap><Banners /><Discovery /></Wrap>;
    case 'picture':
      return <Wrap><Banners /><Picture /></Wrap>;
    case 'deep':
      return <Wrap wide><Banners /><Deep /></Wrap>;
    case 'result':
      return <Result />;
    case 'saved':
      return <Wrap><Saved /></Wrap>;
  }
}

function Wrap({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <main className={`app-main${wide ? ' wide' : ''}`}>{children}</main>;
}
