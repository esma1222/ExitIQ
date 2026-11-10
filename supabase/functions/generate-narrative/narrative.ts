// Narrative contract for the optional generated report (brief section 20).
//
// Pure module: no Deno, npm or network imports, so the same code runs in the
// Edge Function and in the vitest suite.
//
//  - The model only sees a "facts" object built from a stored result snapshot:
//    answer ids, computed metrics, risks, strengths, tasks and the tax section.
//    No evidence references, no seller tax details, no free text typed by users.
//  - Every statement is labelled as "reported", "implication" or "next_step"
//    ("You reported" / "This may imply" / "Suggested next step").
//  - The output is rejected (and the deterministic result stays the only
//    report) when it is truncated, cites unknown question ids, quotes a number
//    that is not in the facts, or uses valuation, probability, tax-saving or
//    verification language.

export type Lang = 'en' | 'de';
export type ParagraphKind = 'reported' | 'implication' | 'next_step';

export interface Paragraph {
  kind: ParagraphKind;
  text: string;
  question_ids: string[];
}

export interface Narrative {
  summary: Paragraph[];
  strengths: Paragraph[];
  priorities: Paragraph[];
  tax: Paragraph[];
}

export const SECTIONS = ['summary', 'strengths', 'priorities', 'tax'] as const;

// ── Minimal view of the stored snapshot (src/model/plan.ts ResultSnapshot) ──

interface SnapDomain { key: string; name: string; index: number | null; localCoverage: number }
interface SnapDimension {
  key: string; name: string; status: string; displayIndex: number | null;
  coverage: number; lower: number; upper: number; evidenceSupport: number; openCount: number;
  pendingApplicability: boolean; domains: SnapDomain[];
}
interface SnapRisk { rule: string; severity: string; basis: string; title: string; text: string; questionIds: string[] }
interface SnapTask {
  kind: string; priorityClass: number; title: string; reason: string; accountableRole: string;
  suggestedTiming: string; sourceQuestionIds: string[]; dependencies: string[];
}
export interface SnapshotLike {
  generatedAt: string;
  profile: string | null;
  context: { ownershipTags?: string[]; objectives?: string[]; perimeter?: string | null; horizon?: string | null; managementModel?: string | null };
  activeModules: string[];
  pendingModules: string[];
  effectiveWeights: Record<string, number>;
  dimensions: SnapDimension[];
  dataStatus: string;
  riskStatus: string;
  specialist: string[];
  risks: SnapRisk[];
  strengths: { id: string; name: string; text: string }[];
  tasks: SnapTask[];
  tax: { id: string; name: string; scope: string; status: string }[];
  unresolved: string[];
}

const MAX_TASKS = 12;
const pct = (x: number) => Math.round(x * 100);

/** The only data the model sees. */
export function buildFacts(s: SnapshotLike) {
  return {
    transaction: {
      profile: s.profile ?? 'not confirmed',
      ownership: s.context.ownershipTags ?? [],
      objectives: s.context.objectives ?? [],
      perimeter: s.context.perimeter ?? null,
      horizon: s.context.horizon ?? null,
      management: s.context.managementModel ?? null,
      active_modules: s.activeModules,
      pending_modules: s.pendingModules,
    },
    data_status: s.dataStatus,
    risk_status: s.riskStatus,
    specialist_route_reasons: s.specialist,
    dimensions: s.dimensions.map((d) => ({
      name: d.name,
      status: d.status,
      index: d.displayIndex,
      answer_coverage_percent: pct(d.coverage),
      evidence_support_percent: pct(d.evidenceSupport),
      missing_answer_range: d.displayIndex != null && d.coverage < 0.999 ? [Math.round(d.lower), Math.round(d.upper)] : null,
      open_questions: d.openCount,
      applicability_pending: d.pendingApplicability,
      domains: d.domains.map((m) => ({ name: m.name, answered_only_index: m.index == null ? null : Math.round(m.index), answered_share_percent: pct(m.localCoverage) })),
    })),
    risks: s.risks.map((r) => ({ rule: r.rule, severity: r.severity, basis: r.basis, title: r.title, text: r.text, question_ids: r.questionIds })),
    supported_strengths: s.strengths.map((x) => ({ question_id: x.id, name: x.name, answer: x.text })),
    priority_tasks: s.tasks.slice(0, MAX_TASKS).map((t) => ({
      kind: t.kind, priority_class: t.priorityClass, title: t.title, reason: t.reason,
      suggested_owner: t.accountableRole, suggested_timing: t.suggestedTiming, question_ids: t.sourceQuestionIds,
    })),
    total_tasks: s.tasks.length,
    tax_preparation: s.tax.map((x) => ({ question_id: x.id, name: x.name, scope: x.scope, status: x.status })),
    unresolved_question_ids: s.unresolved,
  };
}

const paragraphSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'text', 'question_ids'],
  properties: {
    kind: { type: 'string', enum: ['reported', 'implication', 'next_step'] },
    text: { type: 'string' },
    question_ids: { type: 'array', items: { type: 'string' } },
  },
} as const;

export const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [...SECTIONS],
  properties: Object.fromEntries(SECTIONS.map((k) => [k, { type: 'array', items: paragraphSchema }])),
} as const;

export function systemPrompt(lang: Lang): string {
  const language = lang === 'de'
    ? 'Write in German. Use the formal "Sie", plain business German as used by German M&A advisers.'
    : 'Write in British English, in plain business language.';
  return [
    'You write the short written summary of an ExitIQ exit readiness self-assessment for the business owner or transaction lead who completed it. ExitIQ is a structured self-assessment by atares, an M&A advisory boutique.',
    'You receive a JSON object of facts computed by a deterministic scoring model. The facts are the only source you may use. The scores, statuses, risks and tasks are final: never recalculate, reinterpret or contradict them.',
    'Return the four sections of the output schema:',
    '- summary: 2 to 4 paragraphs on where preparation stands across the three readiness dimensions, including answer coverage and evidence support. If a dimension has no index, say that coverage is not yet sufficient instead of naming a number.',
    '- strengths: up to 3 paragraphs, one per supported strength in the facts. If there are none, one paragraph saying that strengths appear once answers support them.',
    '- priorities: 2 to 5 paragraphs on critical risks first, then unresolved facts, then the most important preparation gaps, with the suggested owner and timing from the facts.',
    '- tax: 1 to 3 paragraphs on tax preparation, separating company-level, seller-level and cross-border work where the facts contain them. If nothing is assessed, say it is not yet assessed.',
    'Label every paragraph with its kind: "reported" restates what the user answered (start with "You reported" or "Sie haben angegeben"), "implication" explains what this may mean for preparation (use cautious wording such as "This may mean" / "Das kann bedeuten"), "next_step" proposes a concrete action ("Suggested next step:" / "Vorgeschlagener nächster Schritt:").',
    'In question_ids, list the question ids (for example "Q21") that each paragraph is based on. Use only ids that appear in the facts. A "reported" paragraph needs at least one id.',
    'Rules you must follow:',
    '- Only quote numbers that appear in the facts. Do not compute new numbers, totals, averages or differences, and do not write an overall score.',
    '- Do not estimate or mention a valuation, purchase price, multiple, EBITDA multiple, sale probability, buyer interest, tax savings or currency amounts.',
    '- Do not state legal or tax conclusions. Tax and legal items describe preparation status and what a specialist should review.',
    '- Self-reported answers are not verified. Never describe them as verified, confirmed by documents or independently checked.',
    '- "Needs review" or open answers are not defects. Do not present them as failures.',
    '- Timings are planning suggestions, not legal deadlines.',
    '- Each paragraph is 1 to 3 complete sentences and ends with a full stop. No headings, lists or markdown inside the text.',
    language,
  ].join('\n');
}

export function userPrompt(facts: ReturnType<typeof buildFacts>): string {
  return `Facts (JSON):\n${JSON.stringify(facts)}`;
}

// ── Validation ──────────────────────────────────────────────────────────────

const FORBIDDEN: RegExp[] = [
  // "multiple" alone is ordinary English ("multiple jurisdictions"), so only the valuation senses are blocked.
  /\bvaluations?\b/i, /\bvalued at\b/i, /\benterprise value of\b/i, /\bpurchase price of\b/i,
  /\bmultiples\b/i, /\bmultiple of\b/i, /\b(ebitda|revenue|sales|valuation|exit|implied|transaction|earnings) multiple\b/i,
  /\bprobabilit(y|ies)\b/i, /\blikelihood of (a )?sale\b/i, /\btax savings?\b/i, /\bsave tax\b/i,
  /\bverified\b/i, /\bindependently (checked|confirmed|verified)\b/i, /\boverall (exit )?score\b/i,
  /unternehmensbewertung/i, /\bbewertung (des|ihres) unternehmens\b/i, /\bunternehmenswert von\b/i, /\bkaufpreis von\b/i,
  /\bmultiplikator/i, /verkaufswahrscheinlichkeit/i, /\bwahrscheinlichkeit/i, /steuerersparnis/i, /steuern sparen/i,
  /\bverifiziert\b/i, /unabhängig geprüft/i, /\bgarantiert/i, /gesamtscore/i, /gesamt-score/i,
  /[€$£]/, /\b(eur|usd|chf|mio\.?|million|millionen|mrd\.?|billion)\b/i,
];

/** Numbers that a paragraph may quote: everything numeric in the facts. */
export function allowedNumbers(facts: unknown): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'number' && Number.isFinite(v)) out.add(String(Math.round(v)));
    else if (typeof v === 'string') for (const m of v.matchAll(/\d+/g)) out.add(String(Number(m[0])));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(facts);
  return out;
}

export type Validation = { ok: true; narrative: Narrative } | { ok: false; reason: string };

const ENDS_COMPLETE = /[.!?]["“”»«’)]*$/;

export function validateNarrative(raw: unknown, facts: ReturnType<typeof buildFacts>, knownIds: Iterable<string>): Validation {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not an object' };
  const ids = new Set(knownIds);
  const numbers = allowedNumbers(facts);
  const n = raw as Record<string, unknown>;
  const limits: Record<(typeof SECTIONS)[number], [number, number]> = { summary: [1, 5], strengths: [1, 3], priorities: [1, 6], tax: [1, 3] };
  let total = 0;
  for (const key of SECTIONS) {
    const list = n[key];
    if (!Array.isArray(list)) return { ok: false, reason: `${key} missing` };
    const [min, max] = limits[key];
    if (list.length < min || list.length > max) return { ok: false, reason: `${key} has ${list.length} paragraphs` };
    for (const p of list as Paragraph[]) {
      if (!p || typeof p.text !== 'string' || !Array.isArray(p.question_ids)) return { ok: false, reason: `${key} paragraph malformed` };
      if (!['reported', 'implication', 'next_step'].includes(p.kind)) return { ok: false, reason: `${key} paragraph kind invalid` };
      const text = p.text.trim();
      total += text.length;
      if (text.length < 15 || text.length > 700) return { ok: false, reason: `${key} paragraph length ${text.length}` };
      if (!ENDS_COMPLETE.test(text)) return { ok: false, reason: `${key} paragraph not a complete sentence` };
      if (/[#*`]|^\s*[-•]/.test(text)) return { ok: false, reason: `${key} paragraph contains markup` };
      const unknown = p.question_ids.filter((id) => !ids.has(id));
      if (unknown.length) return { ok: false, reason: `${key} cites unknown ids ${unknown.slice(0, 3).join(',')}` };
      if (p.kind === 'reported' && p.question_ids.length === 0) return { ok: false, reason: `${key} reported paragraph without ids` };
      const forbidden = FORBIDDEN.find((re) => re.test(text));
      if (forbidden) return { ok: false, reason: `${key} uses forbidden wording ${forbidden.source}` };
      // Question ids like Q21 are allowed; every other number must exist in the facts.
      for (const m of text.replace(/\b[QE]\d{2}\b/g, '').matchAll(/\d+(?:[.,]\d+)?/g)) {
        const num = String(Math.round(Number(m[0].replace(',', '.'))));
        if (!numbers.has(num)) return { ok: false, reason: `${key} quotes a number not in the facts: ${m[0]}` };
      }
    }
  }
  if (total > 6000) return { ok: false, reason: 'too long' };
  const clean = (list: Paragraph[]) => list.map((p) => ({ kind: p.kind, text: p.text.trim(), question_ids: [...new Set(p.question_ids)] }));
  return { ok: true, narrative: { summary: clean(n.summary as Paragraph[]), strengths: clean(n.strengths as Paragraph[]), priorities: clean(n.priorities as Paragraph[]), tax: clean(n.tax as Paragraph[]) } };
}

/** Question ids a paragraph may cite: the applicable controls of the snapshot. */
export function knownQuestionIds(s: SnapshotLike): string[] {
  return Object.keys(s.effectiveWeights);
}
