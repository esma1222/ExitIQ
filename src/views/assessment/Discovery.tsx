import { Chip, RadioGroup, CheckboxGroup } from '../../components/ui';
import { QUESTION_BY_ID } from '../../model/catalogue';
import { DISCOVERY } from '../../model/options';
import { discoveryOptionLabel, discoveryScreens, statusLabel } from '../../i18n/localize';
import { useT } from '../../i18n/ui';
import { useJT } from '../../i18n/ui-journey';
import { useLang } from '../../lib/i18n';
import { initialObservations } from '../../model/plan';
import { questionText } from '../../model/routing';
import { track } from '../../lib/remote';
import { TrackQuestion } from './TrackQuestion';
import { go, setDiagnostic, setPosition, useAssessment } from '../../lib/store';
import { ControlAnswer } from './AnswerControls';

// Stored English values; the labels come from the status labels (unknown, withheld).
const BAND_STATUSES: [string, string][] = [['Unknown', 'unknown'], ['Prefer not to answer', 'withheld']];
const BAND_VALUES = BAND_STATUSES.map(([v]) => v);

export function Discovery() {
  const s = useAssessment();
  const lang = useLang();
  const t = useT();
  const jt = useJT();
  const screens = discoveryScreens(lang);
  const i = Math.min(s.dIdx, DISCOVERY.length - 1);
  const d = DISCOVERY[i];
  const dl = screens[i];
  const last = i === DISCOVERY.length - 1;

  const answered =
    d.kind === 'control' ? !!s.answers[d.control]
      : d.kind === 'multi' ? Array.isArray(s.diag.E01) && s.diag.E01.length > 0
        : !!s.diag[d.id];

  // A theme is complete after its last screen in the (interleaved) order.
  const lastOfTheme = (j: number) => !DISCOVERY.slice(j + 1).some((x) => x.theme === DISCOVERY[j].theme);
  const next = () => {
    if (lastOfTheme(i)) track('theme_complete', s.remoteId, { stage: 'DISCOVERY' });
    if (last) go('picture');
    else setPosition({ dIdx: i + 1 });
  };
  const back = () => (i === 0 ? go('context') : setPosition({ dIdx: i - 1 }));

  // One short observation after a theme, based on recorded answers only (section 2).
  const prev = i > 0 && lastOfTheme(i - 1) ? DISCOVERY[i - 1] : undefined;
  const themeIds = prev ? DISCOVERY.filter((x) => x.theme === prev.theme).map((x) => (x.kind === 'control' ? x.control : x.id)) : [];
  const themeNote = themeIds.length
    ? initialObservations(s.ctx, s.answers, s.diag, lang).find((o) => o.answerIds.length > 0 && o.answerIds.every((id) => themeIds.includes(id)))
    : undefined;

  // Conversational heading; the sub-line leads into the scored control. Same anchors, same stored control.
  let title = dl.title ?? '';
  let sub: string | null = null;
  if (d.kind === 'control' && dl.kind === 'control') {
    const controlText = questionText(QUESTION_BY_ID[d.control], s.ctx, lang);
    if (dl.titleOwnerLed && s.ctx.managementModel === 'owner_led') {
      title = dl.titleOwnerLed;
      sub = controlText;
    } else if (dl.title) {
      title = dl.title;
      sub = dl.sub ?? null;
    } else title = controlText;
  }

  return (
    <>
      <TrackQuestion id={d.id} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="kicker">{jt.discoveryKicker} · {dl.theme}</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.74)' }} aria-live="polite">{t.questionOf(i + 1, DISCOVERY.length)}</span>
      </div>
      <div className="progress-dots" aria-hidden="true">
        {DISCOVERY.map((x, j) => <span key={x.id} className={j < i ? 'done' : j === i ? 'current' : ''} />)}
      </div>

      {themeNote && (
        <div className="banner" role="note" style={{ borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(0,35,54,0.45)' }}>
          <span className="pill" style={{ background: 'rgba(0,195,191,0.2)', color: 'var(--teal-pale)' }}>{screens[i - 1].theme}</span>
          <span>{themeNote.text}</span>
        </div>
      )}

      <section key={d.id} className="q-card fade-up" aria-labelledby="disc-q" aria-describedby={sub ? 'disc-sub' : undefined}>
        <div className="q-head">
          <h1 id="disc-q" className="q-title">{title}</h1>
          {sub && <p id="disc-sub" className="q-sub">{sub}</p>}
          <p className="q-help">{dl.help}</p>
        </div>

        {d.kind === 'control' && (
          <ControlAnswer q={QUESTION_BY_ID[d.control]} ctx={s.ctx} answer={s.answers[d.control]} showNa={false} title={sub ?? title} />
        )}
        {d.kind === 'control' && <p className="q-meta" title={d.control}>{jt.scoredMeta}</p>}
        {d.kind === 'multi' && (
          <CheckboxGroup layout="list" label={title} choices={d.options.map((o) => ({ value: o, label: discoveryOptionLabel(lang, d.id, o) }))}
            values={Array.isArray(s.diag.E01) ? s.diag.E01 : []}
            onToggle={(v) => {
              const cur = Array.isArray(s.diag.E01) ? s.diag.E01 : [];
              const nextV = cur.includes(v) ? cur.filter((x) => x !== v) : cur.length >= d.max ? cur : [...cur, v];
              setDiagnostic('E01', nextV.length ? nextV : null);
            }} />
        )}
        {d.kind === 'band' && (
          <>
            <RadioGroup layout="list" label={title} choices={d.options.map((o) => ({ value: o, label: discoveryOptionLabel(lang, d.id, o) }))}
              value={typeof s.diag[d.id] === 'string' && !BAND_VALUES.includes(s.diag[d.id] as string) ? (s.diag[d.id] as string) : null}
              onChange={(v) => setDiagnostic(d.id, v)} />
            <div className="chips">
              {BAND_STATUSES.map(([l, st]) => <Chip key={l} pressed={s.diag[d.id] === l} onClick={() => setDiagnostic(d.id, s.diag[d.id] === l ? null : l)}>{statusLabel(lang, st)}</Chip>)}
            </div>
          </>
        )}
      </section>

      <div className="nav-row">
        <button type="button" className="btn btn-ghost" onClick={back}>{t.back}</button>
        <div className="right">
          <button type="button" className="btn-link" style={{ background: 'none', cursor: 'pointer' }} onClick={next}>{t.skipForNow}</button>
          <button type="button" className="btn btn-lime" disabled={!answered} onClick={next}>{last ? t.seePicture : t.next}</button>
        </div>
      </div>
    </>
  );
}
