import { localOptions, localQuestionById, profileText, routeLabel } from '../../i18n/localize';
import { useT } from '../../i18n/ui';
import { useJT } from '../../i18n/ui-journey';
import { deepList, isAnswered, needsVisit } from '../../lib/journey';
import { useLang, type Lang } from '../../lib/i18n';
import { HORIZON_OPTIONS, LIQUIDITY_OPTIONS, MANAGEMENT_OPTIONS, OBJECTIVE_OPTIONS, OWNERSHIP_OPTIONS, PERIMETER_OPTIONS, type Opt } from '../../model/options';
import { activeModules, pendingModules, resolveRoutes } from '../../model/routing';
import { dismissRouteChange, go, useAssessment, type Screen } from '../../lib/store';
import { Banner } from './Banners';

function labelIn<T extends string>(lang: Lang, group: string, opts: Opt<T>[], v: T | null | undefined, fallback: string): string {
  return localOptions(lang, group, opts).find((o) => o.value === v)?.label ?? fallback;
}

/** Section 5: a readable configuration summary the user can correct before scoring. */
export function Summary() {
  const s = useAssessment();
  const lang = useLang();
  const t = useT();
  const jt = useJT();
  const { ctx } = s;
  const route = (k: Parameters<typeof routeLabel>[1]) => routeLabel(lang, k);
  const qName = (id: string) => `${id} ${localQuestionById(lang, id).name}`;
  const routes = resolveRoutes(ctx);
  const active = activeModules(routes);
  const pending = pendingModules(routes);
  const list = deepList(ctx);
  const n = list.length;
  const done = list.filter((x) => isAnswered(s.answers[x.q.id])).length;
  const left = list.filter((x) => needsVisit(s.answers[x.q.id])).length;
  const profile = ctx.profile && ctx.profile !== 'UNDECIDED' ? profileText(lang, ctx.profile).name : t.notConfirmedYet;

  const rows: { label: string; value: string; chips: { label: string; tone: 'navy' | 'grey' | 'pending' }[]; edit: Screen }[] = [
    { label: jt.rowContext, value: `${labelIn(lang, 'management', MANAGEMENT_OPTIONS, ctx.managementModel, t.notSet)} · ${labelIn(lang, 'liquidity', LIQUIDITY_OPTIONS, ctx.liquidity, t.notSet)}`, chips: ctx.ownershipTags.map((o) => ({ label: labelIn(lang, 'ownership', OWNERSHIP_OPTIONS, o, t.notSet), tone: 'grey' })), edit: 'context' },
    { label: t.rowTransaction, value: ctx.objectives.map((o) => labelIn(lang, 'objective', OBJECTIVE_OPTIONS, o, t.notSet)).join(', ') || t.notSet, chips: [], edit: 'context' },
    { label: t.rowPerspective, value: profile, chips: [], edit: 'setup' },
    { label: t.rowPerimeter, value: `${labelIn(lang, 'perimeter', PERIMETER_OPTIONS, ctx.perimeter, t.notSet)} · ${labelIn(lang, 'horizon', HORIZON_OPTIONS, ctx.horizon, t.notSet)}`, chips: [], edit: 'setup' },
    { label: t.rowModules, value: active.length ? t.modulesAdded(active.length) : t.coreOnly, chips: active.map((k) => ({ label: route(k), tone: 'navy' })), edit: 'specialist' },
    { label: t.rowUnresolved, value: pending.length ? t.pendingOpen : t.none, chips: pending.map((k) => ({ label: t.notSureChip(route(k)), tone: 'pending' })), edit: 'specialist' },
  ];

  const rc = s.routeChange;
  const deepStarted = list.some((x) => !!s.answers[x.q.id] && !['Q19', 'Q12', 'Q13', 'Q25'].includes(x.q.id));

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="kicker">{jt.summaryKicker}</div>
        <h1 className="h1" style={{ fontSize: 'clamp(30px,3.6vw,44px)' }}>{t.summaryTitle}</h1>
        <p className="lead" style={{ color: 'rgba(255,255,255,0.86)', fontSize: 17 }}>{t.summaryLead}</p>
      </div>

      {rc && (rc.added.length > 0 || rc.removed.length > 0 || rc.deactivated.length > 0 || rc.reactivated.length > 0) && (
        <Banner tone="lime" tag={t.routeChange}>
          {rc.added.length > 0 && <>{t.added}: {rc.added.map(route).join(', ')}. </>}
          {rc.removed.length > 0 && <>{t.removed}: {rc.removed.map(route).join(', ')}. </>}
          {rc.deactivated.length > 0 && <>{t.setAside}: {rc.deactivated.map(qName).join(', ')}. </>}
          {rc.reactivated.length > 0 && <>{t.backInScope}: {rc.reactivated.map(qName).join(', ')}. </>}
          <button type="button" className="btn-link" style={{ background: 'none', border: 0, cursor: 'pointer', textDecoration: 'underline', color: 'inherit', padding: 0 }} onClick={dismissRouteChange}>{t.dismiss}</button>
        </Banner>
      )}

      <div className="card-light" style={{ padding: 0, overflow: 'hidden' }}>
        <dl style={{ margin: 0 }}>
          {rows.map((r) => (
            <div key={r.label} className="summary-row">
              <dt style={{ fontSize: 13, color: 'var(--grey-4)', fontWeight: 600, paddingTop: 2 }}>{r.label}</dt>
              <dd style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{r.value}</span>
                {r.chips.length > 0 && (
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {r.chips.map((c) => (
                      <span key={c.label} className="pill" style={c.tone === 'navy' ? { background: 'var(--navy-2)', color: 'var(--white)' } : c.tone === 'grey' ? { background: 'var(--grey-1)', border: '1px solid var(--grey-2)' } : { background: 'var(--white)', border: '1px solid var(--grey-3)' }}>{c.label}</span>
                    ))}
                  </span>
                )}
              </dd>
              <dd className="summary-edit" style={{ margin: 0 }}><button type="button" className="btn-link" style={{ color: 'var(--teal-dark)', fontWeight: 700, fontSize: 13, background: 'none', border: 0, cursor: 'pointer' }} onClick={() => go(r.edit)} aria-label={t.editAria(r.label)}>{t.edit}</button></dd>
            </div>
          ))}
        </dl>
        <div style={{ background: 'var(--grey-1)', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{t.questionsApply(n)}</div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--grey-4)', lineHeight: 1.55 }}>
            {jt.summaryCount(n, done, left)}{' '}
            {pending.length ? t.pendingNote : t.changeNote}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn btn-outline" onClick={() => go('specialist')}>{t.back}</button>
            <button type="button" className="btn btn-lime" onClick={() => go('deep')}>{deepStarted ? jt.continueDeep : jt.startDeep} <span aria-hidden="true">→</span></button>
          </div>
        </div>
      </div>
    </>
  );
}
