import { useEffect, useMemo, useState } from 'react';
import { formatDate, formatTime, useLang, type Lang } from '../../lib/i18n';
import { requestNarrative, type Narrative as NarrativeData, type ParagraphKind } from '../../lib/narrative';
import { onSyncStatus } from '../../lib/remote';
import { useAssessment } from '../../lib/store';
import type { PlanView } from '../../model/packages';
import type { ResultSnapshot } from '../../model/plan';
import type { ScoreResult } from '../../model/scoring';
import { templateNarrative } from '../../model/narrative-template';

// Written summary on the action plan (brief section 20).
//
// The rules-based summary is always shown: it is built in the browser from the
// same result as the page, so it needs no server and cannot disagree with the
// figures. When progress is saved online, the user can additionally ask for an
// AI-written version; if that fails or is rejected, the rules-based one stays.

const TEXT = {
  en: {
    intro: 'Your result in a few paragraphs: what can proceed, what needs clarification first and who should act first. It draws only on the figures and actions above and adds no judgement of its own.',
    sourceRules: 'Written from your answers by fixed rules.',
    sourceAi: (d: string) => `Written by AI from your stored result of ${d}; not reviewed by atares.`,
    notAdvice: 'Not legal, tax or financial advice.',
    aiButton: 'Rewrite with AI',
    rulesButton: 'Show the rules-based version',
    working: 'Writing the AI version. This can take up to a minute.',
    kinds: { reported: 'You reported', implication: 'This may imply', next_step: 'Suggested next step' } as Record<ParagraphKind, string>,
    sections: { summary: 'Decision and connections', strengths: 'Strengths', priorities: 'Recommended next steps', tax: 'Tax workstream' },
    stale: 'Your answers have changed since the AI version was written, so the rules-based version is shown.',
    aiFailed: {
      local_only: 'The AI version needs your progress to be saved online.',
      not_saved: 'Your latest result is still being saved. Try the AI version again in a moment.',
      limit: 'Today’s limit for AI versions is reached.',
      rejected: 'The AI version did not pass our quality checks, so it is not shown.',
      unavailable: 'The AI version is not available right now.',
    },
  },
  de: {
    intro: 'Ihr Ergebnis in wenigen Absätzen: was weitergehen kann, was zuerst zu klären ist und wer zuerst handeln sollte. Die Zusammenfassung stützt sich nur auf die Werte und Maßnahmen oben und fügt keine eigene Wertung hinzu.',
    sourceRules: 'Nach festen Regeln aus Ihren Antworten erstellt.',
    sourceAi: (d: string) => `Von KI aus Ihrem gespeicherten Ergebnis vom ${d} erstellt; nicht von atares geprüft.`,
    notAdvice: 'Keine Rechts-, Steuer- oder Finanzberatung.',
    aiButton: 'Mit KI neu formulieren',
    rulesButton: 'Regelbasierte Fassung anzeigen',
    working: 'Die KI-Fassung wird erstellt. Das kann bis zu einer Minute dauern.',
    kinds: { reported: 'Sie haben angegeben', implication: 'Das kann bedeuten', next_step: 'Vorgeschlagener nächster Schritt' } as Record<ParagraphKind, string>,
    sections: { summary: 'Entscheidung und Zusammenhänge', strengths: 'Stärken', priorities: 'Empfohlene nächste Schritte', tax: 'Steuerlicher Arbeitsstrang' },
    stale: 'Ihre Antworten haben sich seit der KI-Fassung geändert, daher wird die regelbasierte Fassung angezeigt.',
    aiFailed: {
      local_only: 'Für die KI-Fassung muss Ihr Fortschritt online gespeichert sein.',
      not_saved: 'Ihr aktuelles Ergebnis wird noch gespeichert. Versuchen Sie die KI-Fassung gleich noch einmal.',
      limit: 'Das heutige Limit für KI-Fassungen ist erreicht.',
      rejected: 'Die KI-Fassung hat unsere Qualitätsprüfung nicht bestanden und wird nicht angezeigt.',
      unavailable: 'Die KI-Fassung ist gerade nicht verfügbar.',
    },
  },
} satisfies Record<Lang, unknown>;

type Ai =
  | { k: 'none' }
  | { k: 'working' }
  | { k: 'done'; data: NarrativeData; forAt: string; lang: Lang; createdAt: string }
  | { k: 'error'; reason: keyof (typeof TEXT)['en']['aiFailed'] };

export default function Narrative({ result, view }: { result: ResultSnapshot & { score: ScoreResult }; view?: PlanView }) {
  const lang = useLang();
  const t = TEXT[lang];
  const s = useAssessment();
  const at = s.lastSnapshot?.at ?? null;
  const rules = useMemo(() => templateNarrative(result, lang, s.diag, view), [result, lang, s.diag, view]);
  const [ai, setAi] = useState<Ai>({ k: 'none' });
  // The AI version is offered only once online backup is confirmed: a 'saved'
  // status with a remote id. It stays offered while later saves are in flight
  // ('saving'), so the button does not flicker; it disappears only if online
  // saving turns out not to work.
  const [online, setOnline] = useState(false);
  useEffect(() => onSyncStatus((st) => {
    if (st === 'saved' && s.remoteId) setOnline(true);
    else if (st === 'local-only' || st === 'error' || !s.remoteId) setOnline(false);
  }), [s.remoteId]);

  // An AI version only applies to the result and language it was written for.
  const aiCurrent = ai.k === 'done' && ai.lang === lang && ai.forAt === at;
  const shown: NarrativeData = aiCurrent ? ai.data : rules;

  const runAi = async () => {
    setAi({ k: 'working' });
    const r = await requestNarrative(s.remoteId, at, lang);
    setAi(r.ok ? { k: 'done', data: r.narrative, forAt: at ?? '', lang, createdAt: r.createdAt } : { k: 'error', reason: r.reason });
  };

  const dateLabel = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : `${formatDate(lang, d)}, ${formatTime(lang, d)}`;
  };

  return (
    <div aria-labelledby="summary-title" aria-busy={ai.k === 'working'} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--grey-4)', maxWidth: 820 }}>{t.intro}</p>

      <article className="narrative">
        {(['summary', 'strengths', 'priorities', 'tax'] as const).map((key) => (
          <div key={key} className="narrative-sec">
            <h3>{t.sections[key]}</h3>
            {shown[key].map((p, i) => (
              <div key={i} className="narrative-p">
                <span className={`narrative-kind kind-${p.kind}`}>{t.kinds[p.kind]}</span>
                <p>
                  {p.text}
                  {p.question_ids.length > 0 && <span className="ids"> {p.question_ids.join(', ')}</span>}
                </p>
              </div>
            ))}
          </div>
        ))}
        <p className="narrative-source">
          {aiCurrent ? t.sourceAi(dateLabel(ai.createdAt || ai.forAt)) : t.sourceRules} {t.notAdvice}
        </p>
      </article>

      <div className="no-print" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
        {ai.k === 'done' && !aiCurrent && <span style={{ color: 'var(--grey-4)' }}>{t.stale}</span>}
        {ai.k === 'working' && <span role="status">{t.working}</span>}
        {ai.k === 'error' && <span role="status" style={{ color: 'var(--grey-4)' }}>{t.aiFailed[ai.reason]}</span>}
        {online && ai.k !== 'working' && !aiCurrent && (
          <button type="button" className="btn btn-sm btn-outline" onClick={runAi}>{t.aiButton}</button>
        )}
        {aiCurrent && <button type="button" className="link-btn" onClick={() => setAi({ k: 'none' })}>{t.rulesButton}</button>}
      </div>
    </div>
  );
}
