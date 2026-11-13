import { useState } from 'react';
import { Bar } from '../../components/ui';
import { CHAPTERS } from '../../model/catalogue';
import { chapterTitle, discoveryOptionLabel, domainName, localOptions, localQuestion, routeLabel, statusLabel } from '../../i18n/localize';
import { useT } from '../../i18n/ui';
import { useJT, type JourneyText } from '../../i18n/ui-journey';
import { useLang, type Lang } from '../../lib/i18n';
import { deepList, earlierFact, isAnswered, needsVisit, nextIndex, nextUnresolved, progressCounts, type EarlierFact } from '../../lib/journey';
import { LIQUIDITY_OPTIONS, OBJECTIVE_OPTIONS } from '../../model/options';
import { questionText, resolveRoutes } from '../../model/routing';
import { hasConflict, isKnown } from '../../model/scoring';
import type { Answer, EvidenceRef, QuestionDef } from '../../model/types';
import { go, setEvidence, setPosition, useAssessment } from '../../lib/store';
import { ControlAnswer } from './AnswerControls';

// Kept here for existing imports (Result.tsx); the list itself lives in lib/journey.
export { deepList };

const dotColor = (a: Answer | undefined) => (!a ? 'rgba(255,255,255,0.18)' : isAnswered(a) ? 'var(--teal)' : 'var(--lime-2)');

/** Diagnostic band values that are statuses rather than options. */
function bandText(lang: Lang, id: 'E03' | 'E04' | 'E07', v: string): string {
  if (v === 'Unknown') return statusLabel(lang, 'unknown');
  if (v === 'Prefer not to answer') return statusLabel(lang, 'withheld');
  return discoveryOptionLabel(lang, id, v);
}

function factText(f: EarlierFact, lang: Lang, jt: JourneyText): string {
  switch (f.kind) {
    case 'largestCustomer': return jt.factLargestCustomer(bandText(lang, 'E04', f.value));
    case 'committedRevenue': return jt.factCommitted(bandText(lang, 'E03', f.value));
    case 'growthConstraint': return jt.factGrowth(bandText(lang, 'E07', f.value));
    case 'objectives': {
      const opts = localOptions(lang, 'objective', OBJECTIVE_OPTIONS);
      return jt.factObjectives(f.value.map((v) => opts.find((o) => o.value === v)?.label ?? v).join(', '));
    }
    case 'liquidity': return jt.factLiquidity(localOptions(lang, 'liquidity', LIQUIDITY_OPTIONS).find((o) => o.value === f.value)?.label ?? f.value);
  }
}

export function Deep() {
  const s = useAssessment();
  const lang = useLang();
  const t = useT();
  const jt = useJT();
  const routes = resolveRoutes(s.ctx);
  const list = deepList(s.ctx);
  if (!list.length) return null;
  const qi = Math.min(s.qIdx, list.length - 1);
  const { q, chapter } = list[qi];
  const ql = localQuestion(lang, q);
  const a = s.answers[q.id];
  const done = (x: { q: QuestionDef }) => isAnswered(s.answers[x.q.id]);
  const progress = progressCounts(list, s.answers);
  const theme = list.filter((x) => x.q.domain === q.domain);
  const chItems = list.map((x, k) => ({ ...x, k })).filter((x) => x.chapter === chapter);
  const next = nextIndex(list, s.answers, qi, s.reviewAll);
  const openBefore = s.reviewAll ? [] : list.map((x, k) => ({ ...x, k })).filter((x) => x.k < qi && needsVisit(s.answers[x.q.id]));
  const fact = earlierFact(q.id, s.ctx, s.diag);

  return (
    <div className="deep-grid">
      <aside aria-label={t.chapters} className="deep-aside">
        <div className="deep-progress">
          <span className="deep-progress-main" aria-live="polite">{jt.progressMain(progress.answered, progress.total, progress.open)}</span>
          <Bar dark value={(progress.answered / progress.total) * 100} open={(progress.open / progress.total) * 100} color="var(--teal)" label={jt.progressMain(progress.answered, progress.total, progress.open)} />
          <span className="deep-note">{jt.progressHelp}</span>
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.74)' }}>{t.chapters}</h2>
        {CHAPTERS.map((ch, j) => {
          const items = list.map((x, k) => ({ ...x, k })).filter((x) => x.chapter === j);
          if (!items.length) return null;
          const n = items.filter(done).length;
          return (
            <button key={ch.title} type="button" className="chapter-btn" aria-current={j === chapter}
              onClick={() => setPosition({ qIdx: (items.find((x) => needsVisit(s.answers[x.q.id])) ?? items.find((x) => !done(x)) ?? items[0]).k })}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14, fontWeight: 700 }}>
                <span>{chapterTitle(lang, j)}</span><span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.74)', whiteSpace: 'nowrap' }}>{t.nOfM(n, items.length)}</span>
              </span>
              <Bar dark value={(n / items.length) * 100} color="var(--teal)" label={t.nOfMAnswered(n, items.length)} />
            </button>
          );
        })}
        <button type="button" className="btn btn-lime" onClick={() => go('result')}>{t.seePlan}</button>
        <p className="deep-note">{t.inviteLater}</p>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div className="deep-toolbar">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('summary')}>{jt.reviewSetup}</button>
          <button type="button" className="btn btn-ghost btn-sm toggle" aria-pressed={s.reviewAll} onClick={() => setPosition({ reviewAll: !s.reviewAll })}>
            <span className="toggle-mark" aria-hidden="true" />{jt.reviewAnswered}
          </button>
          <span className="deep-note">{s.reviewAll ? jt.reviewOnHint : jt.reviewOffHint}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="kicker">{t.chapterKicker(chapter + 1, CHAPTERS.length, chapterTitle(lang, chapter))}</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.74)' }}>{t.domainProgress(domainName(lang, q.domain), theme.filter(done).length, theme.length)}</span>
          </div>
        </div>
        <div className="mini-map" aria-label={t.miniMapAria}>
          {chItems.map((x) => (
            <button key={x.q.id} type="button" title={`${x.q.id} ${localQuestion(lang, x.q).name}`} aria-label={`${x.q.id} ${localQuestion(lang, x.q).name}`} aria-current={x.k === qi}
              onClick={() => setPosition({ qIdx: x.k })} style={{ background: dotColor(s.answers[x.q.id]), outline: x.k === qi ? '2px solid var(--white)' : 'none', outlineOffset: 2 }} />
          ))}
        </div>

        <section key={q.id} className="q-card fade-up" aria-labelledby="deep-q">
          <div className="q-head">
            <span className="q-name">{ql.name}</span>
            <h1 id="deep-q" className="q-title">{questionText(q, s.ctx, lang)}</h1>
            {ql.help && <p className="q-help">{ql.help}</p>}
            {fact && (
              <p className="told-earlier"><span className="told-label">{jt.toldEarlier}</span> {factText(fact, lang, jt)}</p>
            )}
          </div>
          {routes[q.route] === 'pending' && (
            <div className="banner" style={{ borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)' }}>
              <span className="pill" style={{ background: 'var(--white)', color: 'var(--navy)' }}>{t.applicabilityOpen}</span>
              <span>{t.applicabilityText(routeLabel(lang, q.route))} <button type="button" onClick={() => go('specialist')} style={{ background: 'none', border: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>{t.clarifyInSetup}</button>.</span>
            </div>
          )}
          {a && hasConflict(a) && (
            <div className="banner" style={{ borderColor: 'var(--red)', background: 'rgba(243,72,50,0.12)' }}>
              <span className="pill" style={{ background: 'var(--red)', color: 'var(--white)' }}>{t.conflict}</span>
              <span>{t.conflictText}</span>
            </div>
          )}
          <ControlAnswer q={q} ctx={s.ctx} answer={a} />
          <div className="two-col" style={{ gap: 18, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.74)' }}>{t.suggestedContributor}</span>
              <span style={{ fontSize: 15 }}>{ql.contributor}</span>
            </div>
            {a && isKnown(a) ? <EvidenceEditor key={q.id} q={q} answer={a} /> : (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', alignSelf: 'end' }}>{t.evidenceAfter}</div>
            )}
          </div>
          <p className="q-meta">{q.id}{q.route !== 'CORE' ? ` · ${routeLabel(lang, q.route)}` : ''}</p>
        </section>

        {next < 0 && openBefore.length > 0 && (
          <p className="deep-note" role="status">
            {jt.openEarlier(openBefore.length)}{' '}
            <button type="button" className="link-inline" onClick={() => setPosition({ qIdx: openBefore[0].k })}>{jt.goFirstOpen}</button>
          </p>
        )}
        {next < 0 && openBefore.length === 0 && nextUnresolved(list, s.answers, -1) < 0 && <p className="deep-note" role="status">{jt.allHaveResponse}</p>}

        <div className="nav-row">
          <button type="button" className="btn btn-ghost" disabled={qi === 0} onClick={() => setPosition({ qIdx: qi - 1 })}>{t.back}</button>
          <button type="button" className="btn btn-lime" onClick={() => (next < 0 ? go('result') : setPosition({ qIdx: next }))}>{next < 0 ? t.seePlan : t.nextQuestion}</button>
        </div>
      </div>
    </div>
  );
}

/** Section 7: evidence is separate from answer points. 0.5 needs a dated reference with a named role; 1 needs an authorised reviewer. */
function EvidenceEditor({ q, answer }: { q: QuestionDef; answer: Answer }) {
  const t = useT();
  const ev = answer.evidence;
  const [mode, setMode] = useState<'self' | 'ref'>(ev ? 'ref' : 'self');
  const [draft, setDraft] = useState<EvidenceRef>(ev ?? { reference: '', ownerRole: '', asOfDate: null, reviewStatus: 'dated_reference' });
  const complete = draft.reference.trim() && draft.ownerRole.trim() && draft.asOfDate;
  const saved = !!ev && ev.reference === draft.reference && ev.ownerRole === draft.ownerRole && ev.asOfDate === draft.asOfDate;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.74)' }}>{t.evidenceSupport}</span>
      <div className="chips" role="radiogroup" aria-label={t.evidenceSupport}>
        <button type="button" role="radio" aria-checked={mode === 'self'} className="chip" aria-pressed={mode === 'self'}
          onClick={() => { setMode('self'); if (ev) setEvidence(q.id, null); }}>{t.selfOnly}</button>
        <button type="button" role="radio" aria-checked={mode === 'ref'} className="chip" aria-pressed={mode === 'ref'} onClick={() => setMode('ref')}>{t.datedDoc}</button>
      </div>
      {mode === 'ref' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <input className="input" placeholder={t.refPlaceholder} maxLength={500} value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} aria-label={t.refAria} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input className="input" placeholder={t.rolePlaceholder} maxLength={120} value={draft.ownerRole} onChange={(e) => setDraft({ ...draft, ownerRole: e.target.value })} aria-label={t.roleRespAria} />
            <input className="input" type="date" value={draft.asOfDate ?? ''} onChange={(e) => setDraft({ ...draft, asOfDate: e.target.value || null })} aria-label={t.dateAria} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-lime btn-sm" disabled={!complete || saved} onClick={() => setEvidence(q.id, { ...draft, reviewStatus: 'dated_reference' })}>{saved ? t.savedBtn : t.saveRef}</button>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{t.refNote}</span>
          </div>
        </div>
      )}
    </div>
  );
}
