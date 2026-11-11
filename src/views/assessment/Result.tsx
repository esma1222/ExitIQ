import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { navigate } from '../../App';
import { Bar, pct } from '../../components/ui';
import { dimensionName, domainName, localOptions, profileText, routeLabel } from '../../i18n/localize';
import { useT, type UIText } from '../../i18n/ui';
import { locale, useLang, type Lang } from '../../lib/i18n';
import { DIMENSIONS, PROFILES } from '../../model/catalogue';
import { HORIZON_OPTIONS, OBJECTIVE_OPTIONS, PERIMETER_OPTIONS, type Opt } from '../../model/options';
import { buildResult, type Task } from '../../model/plan';
import type { DimensionResult } from '../../model/scoring';
import type { Profile } from '../../model/types';
import { track } from '../../lib/remote';
import { deleteEverything, go, recordResult, setTaskStatus, useAssessment, type TaskStatus } from '../../lib/store';
import { deepList } from './Deep';
import Narrative from './Narrative';

const STATUS_PILL: Record<DimensionResult['status'], { bg: string; fg: string }> = {
  complete: { bg: 'var(--navy-2)', fg: 'var(--lime)' },
  indicative: { bg: 'rgba(0,195,191,0.16)', fg: 'var(--teal-dark)' },
  insufficient_coverage: { bg: 'var(--grey-1)', fg: 'var(--grey-4)' },
  pending_profile: { bg: 'var(--grey-1)', fg: 'var(--grey-4)' },
  specialist_route: { bg: 'rgba(243,72,50,0.12)', fg: 'var(--red)' },
  model_exception: { bg: 'var(--grey-1)', fg: 'var(--grey-4)' },
};

const PILL = {
  red: { bg: 'var(--red)', fg: 'var(--white)' },
  lime: { bg: 'var(--lime-2)', fg: 'var(--navy)' },
  grey: { bg: 'var(--grey-1)', fg: 'var(--grey-4)' },
  navy: { bg: 'var(--navy-2)', fg: 'var(--white)' },
};

/** Badge colour from language-neutral task fields (the label text itself is localised). */
function taskPill(t: Task, answered: boolean) {
  if (t.kind === 'critical') return PILL.red;
  if (t.kind === 'gap') return PILL.navy;
  if (t.ruleId == null && !answered) return PILL.grey; // "Unanswered"
  return PILL.lime;
}

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

function csv(tasks: Task[], status: Record<string, TaskStatus>, t: UIText): string {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = tasks.map((x) => [x.priorityClass, x.label, x.title, x.reason, x.action, x.accountableRole, x.suggestedTiming, x.dependencies.join(' '), x.evidenceRequired, x.dimension, x.domain, x.sourceQuestionIds.join(' '), t.taskStatus[status[x.key] ?? 'open']]);
  return [t.csvHead, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

export function Result() {
  const s = useAssessment();
  const lang = useLang();
  const t = useT();
  // Rendered in the user's language. recordResult() stores the canonical English snapshot.
  const r = useMemo(() => buildResult(s.ctx, s.answers, undefined, lang), [s.ctx, s.answers, lang]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'open' | 'gap'>('all');
  const [showAll, setShowAll] = useState(false);
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

  const tasks = r.tasks.filter((t) => filter === 'all' || t.kind === filter);
  const shown = showAll ? tasks : tasks.slice(0, 8);
  const count = (k: Task['kind']) => r.tasks.filter((t) => t.kind === k).length;
  const prev = s.previousSnapshot;
  const complete = r.dataStatus === 'data_complete';

  const download = () => {
    const blob = new Blob(['﻿' + csv(r.tasks, s.taskStatus, t)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${t.csvFile}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    track('export', s.remoteId, { stage: 'RESULT' });
  };

  const critical = r.risks.filter((k) => k.severity === 'critical').length;
  const glance = [
    { n: critical, label: t.glanceCritical, tone: critical ? 'alert' : 'calm' },
    { n: r.risks.length - critical, label: t.glanceReview, tone: 'calm' },
    { n: r.dimensions.reduce((a, d) => a + d.openCount, 0), label: t.glanceOpen, tone: 'calm' },
    { n: r.tasks.length, label: t.glanceActions, tone: 'calm' },
  ] as const;
  const sections = [
    ['readiness', t.navReadiness], ['risks', t.navRisks], ['actions', t.navActions], ['tax', t.navTax], ['summary', t.navSummary],
  ] as const;
  const groups = ([[1, t.groupCritical], [2, t.groupOpen], [3, t.groupGap]] as const)
    .map(([cls, title]) => ({ cls, title, items: shown.filter((x) => x.priorityClass === cls) }))
    .filter((g) => g.items.length);

  return (
    <main style={{ flex: 1 }}>
      <section className="result-hero">
        <div className="wrap" style={{ padding: '44px 24px 36px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span className="kicker">{t.planKicker(new Date().toLocaleDateString(locale(lang), { day: 'numeric', month: 'long', year: 'numeric' }))}</span>
          <h1 className="h1" style={{ color: 'var(--lime)', maxWidth: 900 }}>
            {r.specialist.length ? t.heroSpecialist : complete ? t.heroComplete : t.heroOpen}
          </h1>
          <div className="chips">
            {chips.map((c) => <span key={c} className="pill" style={{ border: '1px solid rgba(255,255,255,0.3)', padding: '7px 12px', fontSize: 13, fontWeight: 500, whiteSpace: 'normal' }}>{c}</span>)}
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
          <section id="sec-readiness" className="rsec" aria-labelledby="dims-title" style={{ scrollMarginTop: headerH + 64 }}>
            <SectionHead n={1} id="dims-title" title={t.dimsTitle} sub={t.dimsSub} />
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

          <section id="sec-risks" className="rsec" aria-labelledby="rs-title" style={{ scrollMarginTop: headerH + 64 }}>
            <SectionHead n={2} id="rs-title" title={t.risksStrengthsTitle} />
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
                  <h3 id="str-title">{t.strTitle}</h3>
                  <p>{t.strSub}</p>
                </div>
                {r.strengths.length === 0 && <div className="item">{t.strEmpty}</div>}
                {r.strengths.map((x) => (
                  <div key={x.id} className="item">
                    <span className="pill" style={{ background: 'var(--navy-2)', color: 'var(--white)' }}>{x.id}</span>
                    <span><b>{x.name}.</b> {t.youReported} {x.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="sec-actions" className="rsec" aria-labelledby="tasks-title" style={{ scrollMarginTop: headerH + 64 }}>
            <SectionHead n={3} id="tasks-title" title={t.tasksTitle} sub={t.tasksSub}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label={t.filterAria} className="no-print">
                {([['all', t.filterAll, r.tasks.length], ['critical', t.filterCritical, count('critical')], ['open', t.filterOpen, count('open')], ['gap', t.filterGap, count('gap')]] as const).map(([k, l, n]) => (
                  <button key={k} type="button" className="filter-btn" aria-pressed={filter === k} onClick={() => { setFilter(k); setShowAll(false); }}>{l} · {n}</button>
                ))}
              </div>
            </SectionHead>
            <div className="task-list">
              {shown.length === 0 && <div style={{ padding: 18, fontSize: 14 }}>{t.nothingHere}</div>}
              {groups.map((g) => (
                <div key={g.cls} role="group" aria-label={g.title}>
                  <div className="task-group">{g.title}</div>
                  {g.items.map((task) => {
                    const qid = task.sourceQuestionIds[0];
                    const pill = taskPill(task, !!(qid && s.answers[qid]));
                    const meta = [task.dimension, task.domain, task.dependencies.length ? t.after(task.dependencies.join(', ')) : null, task.sourceQuestionIds.join(', ') || null].filter(Boolean).join(' · ');
                    return (
                      <div key={task.key} className="task">
                        <span className="pill task-pill" style={{ background: pill.bg, color: pill.fg }}>{task.label}</span>
                        <div className="task-main">
                          <b className="task-title">{task.title}</b>
                          <span>{task.reason}</span>
                          <span className="task-next">{t.nextStep(task.action)}</span>
                          <div className="task-facts">
                            <span>{t.suggestedOwner(task.accountableRole)}</span>
                            <span>{task.suggestedTiming}</span>
                          </div>
                          <span className="task-meta">{meta}</span>
                        </div>
                        <div className="task-side no-print">
                          <select className="input input-light" aria-label={t.statusOf(task.title)}
                            value={s.taskStatus[task.key] ?? 'open'} onChange={(e) => setTaskStatus(task.key, e.target.value as TaskStatus)}>
                            <option value="open">{t.taskStatus.open}</option>
                            <option value="in_progress">{t.taskStatus.in_progress}</option>
                            <option value="done">{t.taskStatus.done}</option>
                          </select>
                          {qid && task.kind !== 'critical' && task.ruleId !== 'APP' && (
                            <button type="button" className="link-btn" onClick={() => openQuestion(qid)}>{t.openQuestion}</button>
                          )}
                          {task.ruleId === 'APP' && <button type="button" className="link-btn" onClick={() => go('c3')}>{t.clarifySetup}</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              {tasks.length > 8 && (
                <button type="button" className="no-print task-more" onClick={() => setShowAll((x) => !x)}>
                  {showAll ? t.showFewer : t.showAll(tasks.length)}
                </button>
              )}
            </div>
            <p className="rsec-note">{t.timingNote}</p>
          </section>

          <section id="sec-tax" className="rsec" aria-labelledby="tax-title" style={{ scrollMarginTop: headerH + 64 }}>
            <SectionHead n={4} id="tax-title" title={t.taxSection} sub={t.taxSub} />
            <div className="tax-cols">
              {(['company', 'seller', 'cross_border'] as const).map((scope) => {
                const rows = r.tax.filter((x) => x.scope === scope);
                if (!rows.length) return null;
                return (
                  <div key={scope} className="tax-col">
                    <span className="tax-col-title">{t.taxScope[scope]}</span>
                    {rows.map((x) => (
                      <div key={x.id} className="tax-row">
                        <span>{x.name}</span>
                        <b style={{ color: x.status === 'Prepared' ? 'var(--lime)' : x.status === 'In progress' || x.status === 'Not started' ? 'var(--white)' : 'var(--lime-2)' }}>{t.taxStatus[x.status]}</b>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>

          <section id="sec-summary" className="rsec" style={{ scrollMarginTop: headerH + 64 }}>
            <SectionHead n={5} id="summary-title" title={t.summarySection} />
            <Narrative result={r} />
          </section>

          <section className="next-card no-print" aria-labelledby="next-title">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 520 }}>
              <h2 className="h3" id="next-title">{t.nextTitle}</h2>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.84)' }}>{t.nextSub}</p>
            </div>
            <div className="next-actions">
              <button type="button" className="btn btn-lime" onClick={() => go('deep')}>{t.continueAnswering}</button>
              <button type="button" className="btn btn-ghost" onClick={() => window.print()}>{t.print}</button>
              <button type="button" className="btn btn-ghost" onClick={download}>{t.exportCsv}</button>
            </div>
            <div className="next-adviser">
              <p>{t.adviserQ}</p>
              <a className="btn btn-ghost btn-sm" href="https://atares.team" target="_blank" rel="noreferrer" onClick={() => track('contact_request', s.remoteId, { stage: 'RESULT' })}>{t.discuss}</a>
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
