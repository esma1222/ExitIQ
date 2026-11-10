import { domainName, routeLabel } from '../../i18n/localize';
import { useT } from '../../i18n/ui';
import { useLang } from '../../lib/i18n';
import { initialObservations } from '../../model/plan';
import { activeModules, applicableQuestions, resolveRoutes } from '../../model/routing';
import { isKnown } from '../../model/scoring';
import type { DomainKey } from '../../model/types';
import { go, useAssessment } from '../../lib/store';

const TONE = { positive: 'var(--teal)', attention: 'var(--lime)', neutral: 'var(--grey-3)' };

/** Section 9: at most three supported observations and the areas that need detail. No readiness score. */
export function Picture() {
  const s = useAssessment();
  const lang = useLang();
  const t = useT();
  const obs = initialObservations(s.ctx, s.answers, s.diag, lang);
  const routes = resolveRoutes(s.ctx);
  const app = applicableQuestions(routes);
  const left = app.filter((q) => !isKnown(s.answers[q.id])).length;

  // Areas with no supported answer yet, in the editorial order of the detailed assessment.
  const open: DomainKey[] = ['T1', 'T3', 'T2', 'T4', 'O1', 'S2'];
  const areas = open.filter((d) => app.filter((q) => q.domain === d).every((q) => !isKnown(s.answers[q.id]))).slice(0, 4).map((d) => domainName(lang, d));
  const modules = activeModules(routes).map((k) => routeLabel(lang, k));

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="kicker">{t.pictureKicker}</div>
        <h1 className="h1" style={{ color: 'var(--lime)' }}>{t.pictureTitle}</h1>
        <p className="lead" style={{ color: 'rgba(255,255,255,0.86)', fontSize: 16 }}>{t.pictureLead}</p>
      </div>
      <div className="grid-auto" style={{ ['--min' as string]: '220px' }}>
        {obs.map((o) => (
          <div key={o.tag} className="glass" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: TONE[o.tone] }}>{o.tag}</span>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{o.text}</p>
            {o.answerIds.length > 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{t.basedOn(o.answerIds.join(', '))}</span>}
          </div>
        ))}
      </div>
      {(areas.length > 0 || modules.length > 0) && (
        <section className="glass" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }} aria-labelledby="areas-title">
          <h2 id="areas-title" style={{ margin: 0, fontSize: 15 }}>{t.areasTitle}</h2>
          <div className="chips">
            {[...areas, ...modules].map((a) => <span key={a} className="pill" style={{ border: '1px solid rgba(255,255,255,0.3)', fontWeight: 500, padding: '6px 12px' }}>{a}</span>)}
          </div>
        </section>
      )}
      <section className="card-light" style={{ display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 19 }}>{t.continueTitle}</h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--grey-4)' }}>
            {t.continueBody(left)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={() => go('saved')}>{t.saveReturn}</button>
          <button type="button" className="btn btn-navy" onClick={() => go('deep')}>{t.continuePrep} <span aria-hidden="true">→</span></button>
        </div>
      </section>
    </>
  );
}
