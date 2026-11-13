import { useEffect, useState } from 'react';
import { useT } from '../../i18n/ui';
import { useJT } from '../../i18n/ui-journey';
import { CONTACT_EMAIL } from '../../lib/links';
import { onBackupHealth, type BackupHealth } from '../../lib/remote';
import { useAssessment } from '../../lib/store';

type Tone = 'red' | 'lime' | 'white';
const TONES: Record<Tone, { border: string; bg: string; tagBg: string; tagFg: string }> = {
  red: { border: 'var(--red)', bg: 'rgba(243,72,50,0.12)', tagBg: 'var(--red-strong)', tagFg: 'var(--white)' },
  lime: { border: 'rgba(223,254,0,0.5)', bg: 'rgba(223,254,0,0.08)', tagBg: 'var(--lime-2)', tagFg: 'var(--navy)' },
  white: { border: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.06)', tagBg: 'var(--white)', tagFg: 'var(--navy)' },
};

export function Banner({ tone, tag, children }: { tone: Tone; tag: string; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <div className="banner" role="note" style={{ borderColor: t.border, background: t.bg }}>
      <span className="pill" style={{ background: t.tagBg, color: t.tagFg }}>{tag}</span>
      <span>{children}</span>
    </div>
  );
}

/** Section 3/4: specialist routes, liquidity review and pending profile are always visible. */
export function Banners() {
  const { ctx } = useAssessment();
  const t = useT();
  const jt = useJT();
  const out: React.ReactNode[] = [];
  if (ctx.liquidity === 'acute') {
    // Shown prominently from the moment it is confirmed: context, discovery, picture, setup and the detailed questions.
    out.push(
      <section key="acute" className="specialist-card" role="note" aria-labelledby="acute-title">
        <span className="pill" style={{ background: 'var(--red-strong)', color: 'var(--white)', alignSelf: 'flex-start' }}>{t.specialistRoute}</span>
        <h2 id="acute-title">{jt.acuteTitle}</h2>
        <p>{t.bannerAcute}</p>
        <p className="muted">{jt.acuteNext}</p>
        <a className="btn btn-sm specialist-cta" href={`mailto:${CONTACT_EMAIL}`}>{jt.acuteContact}</a>
      </section>,
    );
  } else if (ctx.liquidity === 'potential' || ctx.liquidity === 'unknown') {
    out.push(<Banner key="liq" tone="lime" tag={t.reviewTask}>{t.bannerLiquidity}</Banner>);
  }
  if (ctx.objectives.includes('ipo') || ctx.objectives.includes('distress')) {
    out.push(<Banner key="ipo" tone="lime" tag={t.specialistRoute}>{t.bannerIpo}</Banner>);
  }
  if (ctx.profile === 'UNDECIDED') {
    out.push(<Banner key="prof" tone="white" tag={t.scoringPending}>{t.bannerProfile}</Banner>);
  }
  return out.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{out}</div> : null;
}

/** Online backup health for views (see remote.onBackupHealth). */
export function useBackupHealth(): BackupHealth {
  const [h, set] = useState<BackupHealth>({ online: null });
  useEffect(() => onBackupHealth(set), []);
  return h;
}
