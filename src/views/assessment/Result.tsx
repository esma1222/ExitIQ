import { useEffect, useMemo, useState } from 'react';
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

  return (
    <main style={{ flex: 1 }}>
      <section className="result-hero">
        <div className="wrap" style={{ padding: '44px 24px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span className="kicker">{t.planKicker(new Date().toLocaleDateString(locale(lang), { day: 'numeric', month: 'long', year: 'numeric' }))}</span>
          <h1 className="h1" style={{ color: 'var(--lime)', maxWidth: 900 }}>
            {r.specialist.length ? t.heroSpecialist : complete ? t.heroComplete : t.heroOpen}
          </h1>
          <div className="chips">
            {chips.map((c) => <span key={c} className="pill" style={{ border: '1px solid rgba(255,255,255,0.3)', padding: '7px 12px', fontSize: 13, fontWeight: 500 }}>{c}</span>)}
          </div>
          {complete && r.riskStatus !== 'none' && (
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.8)', maxWidth: 760 }}>{t.completeNote}</p>
          )}
        </div>
      </section>

      <div className="result-body">
        <div className="wrap" style={{ padding: '40px 24px 64px', display: 'flex', flexDirection: 'column', gap: 48 }}>
          <section aria-labelledby="dims-title" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <h2 className="h3" id="dims-title" style={{ fontSize: 26 }}>{t.dimsTitle}</h2>
              <span style={{ fontSize: 13, color: 'var(--grey-4)' }}>
                {r.profile ? t.weightedFor(profileName) : t.noPerspective} · {t.modelNote}
              </span>
            </div>
            {prev && prev.profile !== r.profile && (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--grey-4)' }}>
                {t.recalculated(
                  prev.profile ? (PROFILES.some((p) => p.key === prev.profile) ? profileText(lang, prev.profile as Profile).name : prev.profile) : t.notConfirmed,
                  DIMENSIONS.map((d, i) => `${dimensionName(lang, d.key)} ${prev.indices[i] ?? t.notShownLower}`).join(' · '),
                )}
              </p>
            )}
            <div className="dim-grid">
              {r.dimensions.map((d) => <DimensionCard key={d.key} d={d} lang={lang} t={t} />)}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--grey-4)', lineHeight: 1.6, maxWidth: 820 }}>
              {t.indexNote}
            </p>
          </section>

          <div className="two-col">
            <section aria-labelledby="risk-title" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 className="h3" id="risk-title">{t.riskTitle}</h2>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--grey-4)' }}>{t.riskSub}</p>
              {r.risks.length === 0 && (
                <div style={{ border: '1px solid var(--grey-2)', borderRadius: 14, padding: '12px 14px', fontSize: 14 }}>{t.noRisks}</div>
              )}
              {r.risks.map((k) => (
                <div key={k.rule + k.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', border: `1px solid ${k.severity === 'critical' ? 'var(--red)' : 'var(--grey-2)'}`, borderRadius: 14, padding: '12px 14px', fontSize: 14, lineHeight: 1.5 }}>
                  <span className="pill" style={k.severity === 'critical' ? { background: 'var(--red)', color: 'var(--white)' } : { background: 'var(--grey-1)', border: '1px solid var(--grey-2)' }}>{k.severity === 'critical' ? t.critical : t.needsReview}</span>
                  <span>
                    <b>{k.title}.</b> {k.text}
                    {k.questionIds.length > 0 && <span style={{ color: 'var(--grey-4)' }}> ({k.questionIds.join(', ')})</span>}
                  </span>
                </div>
              ))}
            </section>
            <section aria-labelledby="str-title" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 className="h3" id="str-title">{t.strTitle}</h2>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--grey-4)' }}>{t.strSub}</p>
              {r.strengths.length === 0 && <div style={{ background: 'var(--grey-1)', borderRadius: 14, padding: '12px 14px', fontSize: 14 }}>{t.strEmpty}</div>}
              {r.strengths.map((x) => (
                <div key={x.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--grey-1)', borderRadius: 14, padding: '12px 14px', fontSize: 14, lineHeight: 1.5 }}>
                  <span className="pill" style={{ background: 'var(--navy-2)', color: 'var(--white)' }}>{x.id}</span>
                  <span><b>{x.name}.</b> {t.youReported} {x.text}</span>
                </div>
              ))}
            </section>
          </div>

          <section aria-labelledby="tasks-title" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <h2 className="h3" id="tasks-title" style={{ fontSize: 26 }}>{t.tasksTitle}</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label={t.filterAria}>
                {([['all', `${t.filterAll} · ${r.tasks.length}`], ['critical', `${t.filterCritical} · ${count('critical')}`], ['open', `${t.filterOpen} · ${count('open')}`], ['gap', `${t.filterGap} · ${count('gap')}`]] as const).map(([k, l]) => (
                  <button key={k} type="button" className="filter-btn" aria-pressed={filter === k} onClick={() => { setFilter(k); setShowAll(false); }}>{l}</button>
                ))}
              </div>
            </div>
            <div className="task-list">
              {shown.length === 0 && <div style={{ padding: 18, fontSize: 14 }}>{t.nothingHere}</div>}
              {shown.map((task) => {
                const qid = task.sourceQuestionIds[0];
                const pill = taskPill(task, !!(qid && s.answers[qid]));
                return (
                  <div key={task.key} className="task">
                    <span className="pill" style={{ background: pill.bg, color: pill.fg, alignSelf: 'start' }}>{task.label}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <b style={{ fontSize: 15 }}>{task.title}</b>
                      <span style={{ fontSize: 14, lineHeight: 1.5 }}>{task.reason}</span>
                      <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--grey-4)' }}>{t.nextStep(task.action)}</span>
                      <span style={{ fontSize: 12, color: 'var(--grey-4)' }}>
                        {[task.dimension, task.domain, t.suggestedOwner(task.accountableRole), task.suggestedTiming, task.dependencies.length ? t.after(task.dependencies.join(', ')) : null, task.sourceQuestionIds.join(', ') || null].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }} className="no-print">
                      <select className="input input-light" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} aria-label={t.statusOf(task.title)}
                        value={s.taskStatus[task.key] ?? 'open'} onChange={(e) => setTaskStatus(task.key, e.target.value as TaskStatus)}>
                        <option value="open">{t.taskStatus.open}</option>
                        <option value="in_progress">{t.taskStatus.in_progress}</option>
                        <option value="done">{t.taskStatus.done}</option>
                      </select>
                      {qid && task.kind !== 'critical' && task.ruleId !== 'APP' && (
                        <button type="button" onClick={() => openQuestion(qid)} style={{ background: 'none', border: 0, color: 'var(--teal-dark)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t.openQuestion}</button>
                      )}
                      {task.ruleId === 'APP' && <button type="button" onClick={() => go('c3')} style={{ background: 'none', border: 0, color: 'var(--teal-dark)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t.clarifySetup}</button>}
                    </div>
                  </div>
                );
              })}
              {tasks.length > 8 && (
                <button type="button" className="no-print" onClick={() => setShowAll((x) => !x)} style={{ width: '100%', padding: 14, border: 0, borderTop: '1px solid var(--grey-1)', background: 'var(--grey-1)', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                  {showAll ? t.showFewer : t.showAll(tasks.length)}
                </button>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--grey-4)' }}>{t.timingNote}</p>
          </section>

          <div className="two-col">
            <section aria-labelledby="tax-title" style={{ background: 'var(--navy-2)', color: 'var(--white)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 className="h3" id="tax-title">{t.taxTitle}</h2>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,0.84)' }}>{t.taxSub}</p>
              {(['company', 'seller', 'cross_border'] as const).map((scope) => {
                const rows = r.tax.filter((x) => x.scope === scope);
                if (!rows.length) return null;
                return (
                  <div key={scope} style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)', margin: '8px 0 4px' }}>{t.taxScope[scope]}</span>
                    {rows.map((x) => (
                      <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.12)', fontSize: 14 }}>
                        <span>{x.name}</span>
                        <b style={{ color: x.status === 'Prepared' ? 'var(--lime)' : x.status === 'In progress' || x.status === 'Not started' ? 'var(--white)' : 'var(--lime-2)', whiteSpace: 'nowrap' }}>{t.taxStatus[x.status]}</b>
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
            <section style={{ background: 'var(--grey-1)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, alignSelf: 'start' }}>
              <h2 className="h3">{t.notShowTitle}</h2>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{t.notShowBody}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} className="no-print">
                <button type="button" className="btn btn-navy" onClick={() => go('deep')}>{t.continueAnswering}</button>
                <button type="button" className="btn btn-outline" onClick={() => window.print()}>{t.print}</button>
                <button type="button" className="btn btn-outline" onClick={download}>{t.exportCsv}</button>
              </div>
              <div style={{ borderTop: '1px solid var(--grey-2)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }} className="no-print">
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{t.adviserQ}</p>
                <a className="btn btn-outline" style={{ alignSelf: 'flex-start' }} href="https://atares.team" target="_blank" rel="noreferrer" onClick={() => track('contact_request', s.remoteId, { stage: 'RESULT' })}>{t.discuss}</a>
              </div>
            </section>
          </div>

          <Narrative />

          <section className="no-print" style={{ borderTop: '1px solid var(--grey-2)', paddingTop: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: 'var(--grey-4)' }}>
            <span>{t.modelLine(r.versions.catalogue, r.versions.scoring, r.versions.report)}</span>
            <span style={{ marginLeft: 'auto' }} />
            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: 0, color: 'var(--red)', cursor: 'pointer', fontSize: 13 }}>{t.deleteThis}</button>
            ) : (
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {t.deleteWarn}
                <button type="button" className="btn btn-sm" style={{ background: 'var(--red)', color: 'var(--white)' }} onClick={async () => { await deleteEverything(); navigate('/'); }}>{t.delete}</button>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setConfirmDelete(false)}>{t.cancel}</button>
              </span>
            )}
          </section>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--grey-4)', textAlign: 'center' }}>{t.disclaimer}</p>
        </div>
      </div>
    </main>
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
        <span className="big-index" style={{ color: shown ? 'var(--navy)' : 'var(--grey-3)' }}>{shown ? d.displayIndex : t.notShown}</span>
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
