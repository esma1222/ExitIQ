import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { navigate } from '../../App';
import { Bar, pct } from '../../components/ui';
import { dimensionName, domainName, localOptions, profileText, routeLabel } from '../../i18n/localize';
import { useT, type UIText } from '../../i18n/ui';
import { useReportT } from '../../i18n/ui-report';
import { locale, useLang, type Lang } from '../../lib/i18n';
import { DIMENSIONS, PROFILES } from '../../model/catalogue';
import { HORIZON_OPTIONS, OBJECTIVE_OPTIONS, PERIMETER_OPTIONS, type Opt } from '../../model/options';
import { buildPlanView, controlStateLabel, type Category } from '../../model/packages';
import { buildResult, buyerInvestigation, statedStrengths } from '../../model/plan';
import type { DimensionResult } from '../../model/scoring';
import { REPORT_TEXT } from '../../model/text';
import type { Profile } from '../../model/types';
import { track } from '../../lib/remote';
import { deleteEverything, go, recordResult, setTaskStatus, useAssessment, type TaskStatus } from '../../lib/store';
import { deepList } from './Deep';
import Narrative from './Narrative';
import { CONTACT_EMAIL, contactMailto } from '../../lib/links';

const STATUS_PILL: Record<DimensionResult['status'], { bg: string; fg: string }> = {
  complete: { bg: 'var(--navy-2)', fg: 'var(--lime)' },
  indicative: { bg: 'rgba(0,195,191,0.16)', fg: 'var(--teal-dark)' },
  insufficient_coverage: { bg: 'var(--grey-1)', fg: 'var(--grey-4)' },
  pending_profile: { bg: 'var(--grey-1)', fg: 'var(--grey-4)' },
  specialist_route: { bg: 'rgba(243,72,50,0.12)', fg: 'var(--red)' },
  model_exception: { bg: 'var(--grey-1)', fg: 'var(--grey-4)' },
};

function dimensionNote(d: DimensionResult, t: UIText): string {
  switch (d.status) {
    case 'complete': return t.noteComplete;
    case 'indicative': return t.noteIndicative(Math.round(d.lower), Math.round(d.upper), !!d.pendingApplicability);
    case 'insufficient_coverage': return t.noteInsufficient(d.openCount);
    case 'pending_profile': return t.notePending;
    case 'specialist_route': return t.noteSpecialist;
    case 'model_exception': return t.noteException;
  }
}

function labelIn<T extends string>(lang: Lang, group: string, opts: Opt<T>[], v: T | null | undefined, fallback: string): string {
  return localOptions(lang, group, opts).find((o) => o.value === v)?.label ?? fallback;
}


export function Result() {
  const s = useAssessment();
  const lang = useLang();
  const t = useT();
  const rt = useReportT();
  const RT = REPORT_TEXT[lang];
  // Rendered in the user's language. recordResult() stores the canonical English snapshot.
  const r = useMemo(() => buildResult(s.ctx, s.answers, undefined, lang), [s.ctx, s.answers, lang]);
  const plan = useMemo(() => buildPlanView(r, lang), [r, lang]);
  const buyer = useMemo(() => buyerInvestigation(s.diag, r.score, lang), [s.diag, r.score, lang]);
  const stated = useMemo(() => statedStrengths(s.diag, lang), [s.diag, lang]);
  const [filter, setFilter] = useState<'all' | Category>('all');
  const [showAllPkgs, setShowAllPkgs] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [headerH, setHeaderH] = useState(0);

  // The section menu sticks below the assessment header, whose height depends on the screen width.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.app-header');
    if (!el) return;
    // On small screens the header scrolls away (not sticky), so the menu sticks to the top.
    const set = () => setHeaderH(getComputedStyle(el).position === 'sticky' ? el.offsetHeight : 0);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    recordResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.dataStatus, JSON.stringify(r.dimensions.map((d) => d.displayIndex)), r.profile]);

  const profileName = profileText(lang, r.score.weightingProfile).name;
  const chips = [
    s.ctx.profile && s.ctx.profile !== 'UNDECIDED' ? profileName : t.perspectiveNotConfirmed,
    s.ctx.objectives.map((o) => labelIn(lang, 'objective', OBJECTIVE_OPTIONS, o, t.notSet)).join(', ') || t.objectiveNotSet,
    labelIn(lang, 'perimeter', PERIMETER_OPTIONS, s.ctx.perimeter, t.notSet),
    labelIn(lang, 'horizon', HORIZON_OPTIONS, s.ctx.horizon, t.notSet),
    ...r.activeModules.map((k) => routeLabel(lang, k)),
  ];
  const list = deepList(s.ctx);
  const openQuestion = (qid: string) => go('deep', { qIdx: Math.max(0, list.findIndex((x) => x.q.id === qid)) });
  const prev = s.previousSnapshot;
  const complete = r.dataStatus === 'data_complete';

  const [exporting, setExporting] = useState(false);
  const download = async () => {
    setExporting(true);
    try {
      const { exportActionPlanXlsx } = await import('../../lib/exportXlsx');
      await exportActionPlanXlsx({
        result: r, lang, context: chips, taxStatusLabel: t.taxStatus, dimStatusLabel: t.dimStatus, taskStatus: s.taskStatus,
        plan, buyer, ctx: s.ctx, answers: s.answers, taxScopeLabel: t.taxScope,
      });
      track('export', s.remoteId, { stage: 'RESULT' });
    } finally {
      setExporting(false);
    }
  };

  // Printing (and "Save as PDF") always shows the full plan.
  useEffect(() => {
    const before = () => {
      setFilter('all');
      setShowAllPkgs(true);
      document.querySelectorAll<HTMLDetailsElement>('details.how-to-read').forEach((d) => { d.open = true; });
    };
    window.addEventListener('beforeprint', before);
    return () => window.removeEventListener('beforeprint', before);
  }, []);

  const reviewRisks = r.risks.filter((k) => k.severity === 'review').length;
  const glance = [
    { n: plan.critical.length, label: rt.glanceCritical, tone: plan.critical.length ? 'alert' : 'calm' },
    { n: plan.packages.length, label: rt.glancePackages, tone: 'calm' },
    { n: plan.clarifyCount, label: rt.glanceClarify, tone: 'calm' },
    { n: reviewRisks, label: rt.glanceReview, tone: 'calm' },
  ] as const;
  const sections = [
    ['next', rt.navNext], ['readiness', rt.navReadiness], ['actions', rt.navActions], ['buyer', rt.navBuyer],
    ['risks', rt.navRisks], ['tax', rt.navTax], ['summary', rt.navSummary],
  ] as const;
  const show = (c: Category) => filter === 'all' || filter === c;
  const pkgs = showAllPkgs ? plan.packages : plan.packages.slice(0, 5);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const statusSelect = (keys: string[], name: string) => {
    const vals = keys.map((k) => s.taskStatus[k] ?? 'open');
    const value: TaskStatus = vals.every((v) => v === 'done') ? 'done' : vals.every((v) => v === 'open') ? 'open' : 'in_progress';
    return (
      <>
        <span className="print-only task-print-status">{t.taskStatus[value]}</span>
        <select className="input input-light no-print" aria-label={rt.statusOf(name)} value={value}
          onChange={(e) => keys.forEach((k) => setTaskStatus(k, e.target.value as TaskStatus))}>
          <option value="open">{t.taskStatus.open}</option>
          <option value="in_progress">{t.taskStatus.in_progress}</option>
          <option value="done">{t.taskStatus.done}</option>
        </select>
      </>
    );
  };
  const anyEvidence = r.strengths.some((x) => (r.score.controls[x.id]?.evidenceFactor ?? 0) > 0);
  const q25 = r.score.controls.Q25;

  return (
    <main style={{ flex: 1 }}>
      <div className="print-only print-masthead" aria-hidden="true">
        <img src="/media/atares-logo-navy.png" alt="" />
        <div>
          <b>{t.printTitle}</b>
          <span>{new Date().toLocaleDateString(locale(lang), { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>
      <section className="result-hero">
        <div className="wrap" style={{ padding: '44px 24px 36px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span className="kicker">{t.planKicker(new Date().toLocaleDateString(locale(lang), { day: 'numeric', month: 'long', year: 'numeric' }))}</span>
          <h1 className="h1" style={{ color: 'var(--lime)', maxWidth: 900 }}>
            {r.specialist.length ? t.heroSpecialist : complete ? t.heroComplete : t.heroOpen}
          </h1>
          <div className="chips">
            {chips.map((c) => <span key={c} className="pill" style={{ border: '1px solid rgba(255,255,255,0.3)', padding: '7px 12px', fontSize: 13, fontWeight: 500, whiteSpace: 'normal' }}>{c}</span>)}
            <button type="button" className="btn btn-ghost btn-sm no-print" onClick={() => go('summary')}>{rt.reviewSetup}</button>
          </div>
          {complete && r.riskStatus !== 'none' && (
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.8)', maxWidth: 760 }}>{t.completeNote}</p>
          )}
          <div className="glance">
            {glance.map((g) => (
              <div key={g.label} className={`glance-tile${g.tone === 'alert' ? ' alert' : ''}`}>
                <span className="glance-n">{g.n}</span>
                <span className="glance-l">{g.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <nav className="result-nav no-print" aria-label={t.navAria} style={{ top: headerH }}>
        <div className="wrap result-nav-inner">
          {sections.map(([id, label], i) => (
            <a key={id} href={`#sec-${id}`}><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{label}</a>
          ))}
        </div>
      </nav>

      <div className="result-body">
        <div className="wrap" style={{ padding: '44px 24px 64px', display: 'flex', flexDirection: 'column', gap: 64 }}>
          <section id="sec-next" className="rsec" aria-labelledby="next-steps-title" style={{ scrollMarginTop: headerH + 64 }}>
            <SectionHead n={1} id="next-steps-title" title={rt.nextTitle} sub={rt.nextSub} />
            {plan.nextSteps.length === 0 ? (
              <div className="steps-none">{rt.nextNone}</div>
            ) : (
              <ol className="steps">
                {plan.nextSteps.map((st, i) => (
                  <li key={st.kind + st.title} className={`step step-${st.kind}`}>
                    <span className="step-n" aria-hidden="true">{i + 1}</span>
                    <div className="step-main">
                      <span className="step-kind">{rt.stepKind[st.kind]}</span>
                      <b className="step-title">{st.title}</b>
                      <span className="step-detail">{st.detail}</span>
                      {st.owner && <span className="step-owner">{rt.owner(st.owner)}</span>}
                    </div>
                    <div className="step-side no-print">
                      {st.packageKey && <button type="button" className="link-btn" onClick={() => { setFilter('all'); setShowAllPkgs(true); setTimeout(() => scrollTo(`pkg-${st.packageKey}`), 0); }}>{rt.seePackage}</button>}
                      {st.ruleId === 'APP' && <button type="button" className="link-btn" onClick={() => go('specialist')}>{rt.clarifySetup}</button>}
                      {!st.packageKey && st.firstQuestion && (
                        <button type="button" className="link-btn" onClick={() => openQuestion(st.firstQuestion!)}>{st.kind === 'clarify' ? rt.answerNow : rt.openQuestion}</button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section id="sec-readiness" className="rsec" aria-labelledby="dims-title" style={{ scrollMarginTop: headerH + 64 }}>
            <SectionHead n={2} id="dims-title" title={t.dimsTitle} sub={t.dimsSub} />
            {prev && prev.profile !== r.profile && (
              <p className="rsec-note">
                {t.recalculated(
                  prev.profile ? (PROFILES.some((p) => p.key === prev.profile) ? profileText(lang, prev.profile as Profile).name : prev.profile) : t.notConfirmed,
                  DIMENSIONS.map((d, i) => `${dimensionName(lang, d.key)} ${prev.indices[i] ?? t.notShownLower}`).join(' · '),
                )}
              </p>
            )}
            <div className="dim-grid">
              {r.dimensions.map((d) => <DimensionCard key={d.key} d={d} lang={lang} t={t} />)}
            </div>
            <details className="how-to-read">
              <summary>{t.howToRead}</summary>
              <p>{t.indexNote}</p>
            </details>
          </section>

          <section id="sec-actions" className="rsec" aria-labelledby="tasks-title" style={{ scrollMarginTop: headerH + 64 }}>
            <SectionHead n={3} id="tasks-title" title={rt.planTitle} sub={rt.planSub}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label={rt.filterAria} className="no-print">
                {([['all', rt.filterAll, plan.critical.length + plan.packages.length + plan.clarifyCount], ['critical', RT.category.critical, plan.critical.length], ['preparation', RT.category.preparation, plan.packages.length], ['clarify', RT.category.clarify, plan.clarifyCount]] as const).map(([k, l, n]) => (
                  <button key={k} type="button" className="filter-btn" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} · {n}</button>
                ))}
              </div>
            </SectionHead>

            {show('critical') && (
              <div className="plan-block" aria-labelledby="cat-critical">
                <h3 className="plan-h" id="cat-critical"><span className="cat-dot cat-critical" aria-hidden="true" />{RT.category.critical} · {plan.critical.length}</h3>
                <p className="plan-sub">{plan.critical.length ? rt.criticalSub : rt.criticalNone}</p>
                {plan.critical.length > 0 && (
                  <div className="task-list">
                    {plan.critical.map((task) => {
                      const qid = task.sourceQuestionIds[0];
                      const meta = [task.dimension, task.domain, task.sourceQuestionIds.join(', ') || null].filter(Boolean).join(' · ');
                      return (
                        <div key={task.key} className="task">
                          <span className="pill task-pill" style={{ background: 'var(--red)', color: 'var(--white)' }}>{task.label}</span>
                          <div className="task-main">
                            <b className="task-title">{task.title}</b>
                            <span>{task.reason}</span>
                            <span className="task-next">{t.nextStep(task.action)}</span>
                            <div className="task-facts">
                              <span>{t.suggestedOwner(task.accountableRole)}</span>
                              <span>{task.suggestedTiming}</span>
                            </div>
                            {meta && <span className="task-meta">{meta}</span>}
                          </div>
                          <div className="task-side">
                            {statusSelect([task.key], task.title)}
                            {qid && <button type="button" className="link-btn no-print" onClick={() => openQuestion(qid)}>{rt.openQuestion}</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {show('preparation') && (
              <div className="plan-block" aria-labelledby="cat-prep">
                <h3 className="plan-h" id="cat-prep"><span className="cat-dot cat-preparation" aria-hidden="true" />{RT.category.preparation} · {plan.packages.length}</h3>
                <p className="plan-sub">{plan.packages.length ? rt.prepSub : rt.prepNone}</p>
                {pkgs.map((p) => (
                  <article key={p.key} id={`pkg-${p.key}`} className="pkg" aria-labelledby={`pkg-h-${p.key}`} style={{ scrollMarginTop: headerH + 72 }}>
                    <header className="pkg-head">
                      <div className="pkg-titles">
                        <span className="pkg-ws">{p.workstreamName} · {rt.impact(plan.packages.indexOf(p) + 1)}</span>
                        <h4 id={`pkg-h-${p.key}`}>{p.name}</h4>
                      </div>
                      <div className="pkg-status">{statusSelect(p.tasks.map((x) => x.key), p.name)}</div>
                    </header>
                    <div className="pkg-grid">
                      <div className="pkg-why">
                        <span className="pkg-label">{rt.whyItMatters}</span>
                        <ul>
                          {p.tasks.map((task) => {
                            const id = task.sourceQuestionIds[0];
                            return (
                              <li key={task.key}>
                                <span className="pkg-q"><span className="ids">{id}</span> <b>{task.title}</b> <span className="pkg-badge">{task.label}</span>
                                  {task.waitingFor.length > 0 && <span className="pkg-wait">{RT.waitingFor(task.waitingFor.join(', '))}</span>}
                                </span>
                                <span className="pkg-reason">{task.reason}</span>
                                <button type="button" className="link-btn no-print" onClick={() => openQuestion(id)}>{rt.openQuestion}</button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <dl className="pkg-facts">
                        <div><dt>{rt.ownerLabel}</dt><dd>{p.owner}</dd></div>
                        <div><dt>{rt.outputRequired}</dt><dd>{p.output}</dd></div>
                        {(p.dependsOn.length > 0 || p.waitingFor.length > 0) && (
                          <div><dt>{rt.dependsOn}</dt><dd>{[...p.dependsOn.map((d) => d.name), ...(p.waitingFor.length ? [RT.waitingFor(p.waitingFor.join(', '))] : [])].join(' · ')}</dd></div>
                        )}
                        <div><dt>{rt.timingLabel}</dt><dd>{p.tasks[0].suggestedTiming}</dd></div>
                      </dl>
                    </div>
                    <div className="pkg-controls">
                      <span className="pkg-label">{rt.linkedControls}</span>
                      <div className="ctl-list">
                        {p.controls.map((c) => (
                          <button key={c.id} type="button" className={`ctl ctl-${c.state}`} onClick={() => openQuestion(c.id)} title={c.name}>
                            <b>{c.id}</b> {c.name} · {c.stateLabel}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
                {plan.packages.length > 5 && (
                  <button type="button" className="no-print task-more pkg-more" onClick={() => setShowAllPkgs((x) => !x)}>
                    {showAllPkgs ? rt.showFewer : rt.showAllPackages(plan.packages.length)}
                  </button>
                )}
              </div>
            )}

            {show('clarify') && (
              <div className="plan-block" aria-labelledby="cat-clarify">
                <h3 className="plan-h" id="cat-clarify"><span className="cat-dot cat-clarify" aria-hidden="true" />{RT.category.clarify} · {plan.clarifyCount}</h3>
                <p className="plan-sub">{plan.clarifyCount ? rt.clarifySub : rt.clarifyNone}</p>
                {plan.clarifyCount > 0 && (
                  <div className="clarify">
                    {plan.reviews.length > 0 && (
                      <div className="clarify-group">
                        <div className="clarify-head">{rt.reviewsTitle} · {plan.reviews.length}</div>
                        {plan.reviews.map((task) => (
                          <div key={task.key} className="clarify-row clarify-review">
                            <span className="pill clarify-pill">{task.label}</span>
                            <span className="clarify-text"><b>{task.title}.</b> {task.reason}{task.sourceQuestionIds.length > 0 && task.ruleId !== 'APP' && <span className="ids"> {task.sourceQuestionIds.join(', ')}</span>}</span>
                            <span className="clarify-act no-print">
                              {task.ruleId === 'APP'
                                ? <button type="button" className="link-btn" onClick={() => go('specialist')}>{rt.clarifySetup}</button>
                                : task.sourceQuestionIds[0] && <button type="button" className="link-btn" onClick={() => openQuestion(task.sourceQuestionIds[0])}>{rt.openQuestion}</button>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {plan.clarifyGroups.map((g) => (
                      <div key={g.workstream} className="clarify-group">
                        <div className="clarify-head">{g.name} · {rt.questionsN(g.tasks.length)}</div>
                        {g.tasks.map((task) => {
                          const id = task.sourceQuestionIds[0];
                          return (
                            <div key={task.key} className="clarify-row">
                              <span className="ids clarify-id">{id}</span>
                              <span className="clarify-text">{task.title}
                                {task.waitingFor.length > 0 && <span className="pkg-wait">{RT.waitingFor(task.waitingFor.join(', '))}</span>}
                              </span>
                              <span className="clarify-state">{controlStateLabel(lang, r.score.controls[id])}</span>
                              <span className="clarify-act no-print"><button type="button" className="link-btn" onClick={() => openQuestion(id)}>{rt.openQuestion}</button></span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="rsec-note">{rt.timingNote}</p>
          </section>

          <section id="sec-buyer" className="rsec" aria-labelledby="buyer-title" style={{ scrollMarginTop: headerH + 64 }}>
            <SectionHead n={4} id="buyer-title" title={rt.buyerTitle} sub={rt.buyerSub} />
            <div className="buyer-grid">
              {buyer.map((b) => (
                <article key={b.id} className="buyer-card" aria-labelledby={`buyer-${b.id}`}>
                  <div className="buyer-top">
                    <span className="buyer-self">{rt.buyerSelf}</span>
                    <span className="ids">{[b.id, ...b.relatedIds].join(' · ')}</span>
                  </div>
                  <h3 id={`buyer-${b.id}`}>{b.topic}</h3>
                  <span className="buyer-value"><span>{b.source}:</span> <b>{b.value ?? rt.buyerNotStated}</b></span>
                  <p>{b.text}</p>
                  {b.relatedIds.length > 0 && (
                    <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {b.relatedIds.map((id) => <button key={id} type="button" className="link-btn" onClick={() => openQuestion(id)}>{rt.openQuestion} {id}</button>)}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section id="sec-risks" className="rsec" aria-labelledby="rs-title" style={{ scrollMarginTop: headerH + 64 }}>
            <SectionHead n={5} id="rs-title" title={t.risksStrengthsTitle} />
            <div className="two-col">
              <div className="panel" aria-labelledby="risk-title">
                <div className="panel-head">
                  <h3 id="risk-title">{t.riskTitle}</h3>
                  <p>{t.riskSub}</p>
                </div>
                {r.risks.length === 0 && <div className="item">{t.noRisks}</div>}
                {r.risks.map((k) => (
                  <div key={k.rule + k.title} className={`item${k.severity === 'critical' ? ' item-critical' : ''}`}>
                    <span className="pill" style={k.severity === 'critical' ? { background: 'var(--red)', color: 'var(--white)' } : { background: 'var(--grey-1)', border: '1px solid var(--grey-2)' }}>{k.severity === 'critical' ? t.critical : t.needsReview}</span>
                    <span>
                      <b>{k.title}.</b> {k.text}
                      {k.questionIds.length > 0 && <span className="ids"> {k.questionIds.join(', ')}</span>}
                    </span>
                  </div>
                ))}
              </div>
              <div className="panel" aria-labelledby="str-title">
                <div className="panel-head">
                  <h3 id="str-title">{rt.statedTitle}</h3>
                  <p>{rt.statedSub}</p>
                </div>
                {stated.length === 0 && <div className="item">{rt.statedNone}</div>}
                {stated.map((x) => (
                  <div key={x.value} className="item">
                    <span className="pill" style={{ background: 'var(--white)', border: '1px solid var(--grey-2)' }}>E01</span>
                    <span><b>{x.label}</b>{x.relatedId && r.score.controls[x.relatedId] && <span className="ids"> · {x.relatedId}: {controlStateLabel(lang, r.score.controls[x.relatedId])}</span>}</span>
                  </div>
                ))}
                <div className="panel-head" style={{ paddingTop: 12 }}>
                  <h3 id="prep-str-title">{rt.prepStrTitle}</h3>
                  <p>{anyEvidence ? rt.prepStrSubSupported : rt.prepStrSubReported}</p>
                </div>
                {r.strengths.length === 0 && <div className="item">{rt.prepStrNone}</div>}
                {r.strengths.map((x) => {
                  const ev = (r.score.controls[x.id]?.evidenceFactor ?? 0) > 0;
                  return (
                    <div key={x.id} className="item">
                      <span className="pill" style={{ background: 'var(--navy-2)', color: 'var(--white)' }}>{x.id}</span>
                      <span><b>{x.name}.</b> {rt.youReported} {x.text} <span className="ids">{ev ? rt.supportedTag : rt.reportedTag}</span></span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="sec-tax" className="rsec" aria-labelledby="tax-title" style={{ scrollMarginTop: headerH + 64 }}>
            <SectionHead n={6} id="tax-title" title={rt.taxTitle} sub={rt.taxSub} />
            <div className="tax-cols">
              <div className="tax-context">{rt.taxSpecialist(q25 ? controlStateLabel(lang, q25) : rt.taxNotApplicable)}</div>
              {(['company', 'company_seller', 'seller', 'cross_border'] as const).map((scope) => {
                const rows = r.tax.filter((x) => x.scope === scope);
                if (!rows.length) return null;
                return (
                  <div key={scope} className="tax-col">
                    <span className="tax-col-title">{t.taxScope[scope]}</span>
                    {rows.map((x) => (
                      <div key={x.id} className="tax-row">
                        <span><span className="tax-id">{x.id}</span> {x.name}</span>
                        <b style={{ color: x.status === 'Prepared' ? 'var(--lime)' : x.status === 'In progress' || x.status === 'Not started' ? 'var(--white)' : 'var(--lime-2)' }}>{t.taxStatus[x.status]}</b>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>

          <section id="sec-summary" className="rsec" style={{ scrollMarginTop: headerH + 64 }}>
            <SectionHead n={7} id="summary-title" title={t.summarySection} />
            <Narrative result={r} view={plan} />
          </section>

          <section className="next-card no-print" aria-labelledby="next-title">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 520 }}>
              <h2 className="h3" id="next-title">{t.nextTitle}</h2>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.84)' }}>{t.nextSub}</p>
            </div>
            <div className="next-actions">
              <button type="button" className="btn btn-lime" onClick={() => go('deep')}>{t.continueAnswering}</button>
              <button type="button" className="btn btn-ghost" onClick={() => go('summary')}>{rt.reviewSetup}</button>
              <button type="button" className="btn btn-ghost" onClick={() => window.print()}>{t.print}</button>
              <button type="button" className="btn btn-ghost" onClick={download} disabled={exporting} aria-busy={exporting}>{t.exportCsv}</button>
            </div>
            <div className="next-adviser">
              <p>{t.adviserQ}</p>
              <a className="btn btn-ghost btn-sm" href={contactMailto(lang)} title={CONTACT_EMAIL} onClick={() => track('contact_request', s.remoteId, { stage: 'RESULT' })}>{t.discuss}</a>
            </div>
          </section>

          <footer className="result-foot">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 760 }}>
              <b style={{ fontSize: 13 }}>{t.notShowTitle}</b>
              <span>{t.notShowBody}</span>
              <span>{t.disclaimer}</span>
            </div>
            <div className="no-print" style={{ marginLeft: 'auto' }}>
              {!confirmDelete ? (
                <button type="button" className="link-btn" onClick={() => setConfirmDelete(true)} style={{ color: 'var(--red)', fontWeight: 500 }}>{t.deleteThis}</button>
              ) : (
                <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {t.deleteWarn}
                  <button type="button" className="btn btn-sm" style={{ background: 'var(--red)', color: 'var(--white)' }} onClick={async () => { await deleteEverything(); navigate('/'); }}>{t.delete}</button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setConfirmDelete(false)}>{t.cancel}</button>
                </span>
              )}
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}

function SectionHead({ n, id, title, sub, children }: { n: number; id: string; title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="rsec-head">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 760 }}>
        <span className="rsec-num">{String(n).padStart(2, '0')}</span>
        <h2 className="h3" id={id}>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function DimensionCard({ d, lang, t }: { d: DimensionResult; lang: Lang; t: UIText }) {
  const pill = STATUS_PILL[d.status];
  const name = dimensionName(lang, d.key);
  const shown = d.displayIndex != null;
  return (
    <article className="dim-card" aria-labelledby={`dim-${d.key}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <h3 id={`dim-${d.key}`} style={{ margin: 0, fontSize: 19 }}>{name}</h3>
        <span className="pill" style={{ background: pill.bg, color: pill.fg }}>{t.dimStatus[d.status]}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span className={shown ? 'big-index' : 'big-index big-index-off'}>{shown ? d.displayIndex : t.notShown}</span>
        <span style={{ fontSize: 13, color: 'var(--grey-4)' }}>{dimensionNote(d, t)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12, color: 'var(--grey-4)' }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{t.answerCoverage} {pct(d.coverage)}<Bar value={d.coverage * 100} label={`${t.answerCoverage} ${pct(d.coverage)}`} /></span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{t.evidenceSupport} {pct(d.evidenceSupport)}<Bar value={d.evidenceSupport * 100} color="var(--teal-dark)" label={`${t.evidenceSupport} ${pct(d.evidenceSupport)}`} /></span>
      </div>
      <div style={{ borderTop: '1px solid var(--grey-1)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {d.domains.map((m) => {
          const lc = m.localCoverage;
          const label = m.index == null ? t.open : `${Math.round(m.index)}${lc < 1 ? ` · ${t.pctAnswered(Math.round(lc * 100))}` : ''}`;
          const mName = domainName(lang, m.key);
          return (
            <div key={m.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14 }}><b>{mName}</b><span style={{ whiteSpace: 'nowrap', color: 'var(--grey-4)' }}>{label}</span></div>
              <Bar value={(m.index ?? 0) * lc} open={(1 - lc) * 100} label={`${mName}: ${label}`} />
            </div>
          );
        })}
      </div>
    </article>
  );
}
