import { localOptions, localQuestionById, profileText, routeLabel } from '../../i18n/localize';
import { useT } from '../../i18n/ui';
import { useLang, type Lang } from '../../lib/i18n';
import { HORIZON_OPTIONS, OBJECTIVE_OPTIONS, OWNERSHIP_OPTIONS, PERIMETER_OPTIONS, type Opt } from '../../model/options';
import { activeModules, applicableQuestions, pendingModules, resolveRoutes } from '../../model/routing';
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
  const { ctx } = s;
  const route = (k: Parameters<typeof routeLabel>[1]) => routeLabel(lang, k);
  const qName = (id: string) => `${id} ${localQuestionById(lang, id).name}`;
  const routes = resolveRoutes(ctx);
  const active = activeModules(routes);
  const pending = pendingModules(routes);
  const n = applicableQuestions(routes).length;
  const profile = ctx.profile && ctx.profile !== 'UNDECIDED' ? profileText(lang, ctx.profile).name : t.notConfirmedYet;

  const rows: { label: string; value: string; chips: { label: string; tone: 'navy' | 'grey' | 'pending' }[]; edit: Screen }[] = [
    { label: t.rowPerspective, value: profile, chips: ctx.ownershipTags.map((o) => ({ label: labelIn(lang, 'ownership', OWNERSHIP_OPTIONS, o, t.notSet), tone: 'grey' })), edit: 'c2' },
    { label: t.rowTransaction, value: ctx.objectives.map((o) => labelIn(lang, 'objective', OBJECTIVE_OPTIONS, o, t.notSet)).join(', ') || t.notSet, chips: [], edit: 'c2' },
    { label: t.rowPerimeter, value: `${labelIn(lang, 'perimeter', PERIMETER_OPTIONS, ctx.perimeter, t.notSet)} · ${labelIn(lang, 'horizon', HORIZON_OPTIONS, ctx.horizon, t.notSet)}`, chips: [], edit: 'c2' },
    { label: t.rowModules, value: active.length ? t.modulesAdded(active.length) : t.coreOnly, chips: active.map((k) => ({ label: route(k), tone: 'navy' })), edit: 'c3' },
    { label: t.rowUnresolved, value: pending.length ? t.pendingOpen : t.none, chips: pending.map((k) => ({ label: t.notSureChip(route(k)), tone: 'pending' })), edit: 'c3' },
  ];

  const rc = s.routeChange;
  const started = Object.keys(s.answers).length > 0 || Object.keys(s.diag).length > 0;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="kicker">{t.summaryKicker}</div>
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
            <div key={r.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 180px) minmax(0, 1fr) auto', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--grey-1)', alignItems: 'start' }}>
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
              <button type="button" className="btn-link" style={{ color: 'var(--teal-dark)', fontWeight: 700, fontSize: 13, background: 'none', border: 0, cursor: 'pointer' }} onClick={() => go(r.edit)} aria-label={t.editAria(r.label)}>{t.edit}</button>
            </div>
          ))}
        </dl>
        <div style={{ background: 'var(--grey-1)', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{t.questionsApply(n)}</div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--grey-4)', lineHeight: 1.55 }}>
            {t.discoveryNote}{' '}
            {pending.length ? t.pendingNote : t.changeNote}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-lime" onClick={() => go('discovery', { dIdx: 0 })}>{started ? t.continueDiscovery : t.startDiscovery} <span aria-hidden="true">→</span></button>
            {started && <button type="button" className="btn btn-outline" onClick={() => go('deep')}>{t.goDeep}</button>}
          </div>
        </div>
      </div>
    </>
  );
}
