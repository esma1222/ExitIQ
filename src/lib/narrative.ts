// Client for the optional generated narrative (supabase/functions/generate-narrative).
// The deterministic action plan is always rendered first; this only adds prose.

import type { Lang } from './i18n';
import { supabase } from './supabase';

export type ParagraphKind = 'reported' | 'implication' | 'next_step';
export interface Paragraph { kind: ParagraphKind; text: string; question_ids: string[] }
export interface Narrative { summary: Paragraph[]; strengths: Paragraph[]; priorities: Paragraph[]; tax: Paragraph[] }

export type NarrativeResult =
  | { ok: true; narrative: Narrative; createdAt: string }
  | { ok: false; reason: 'local_only' | 'not_saved' | 'limit' | 'rejected' | 'unavailable' };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function statusOf(error: unknown): Promise<number | null> {
  const ctx = (error as { context?: unknown })?.context;
  return ctx instanceof Response ? ctx.status : null;
}

/**
 * Ask the server for a narrative of the stored snapshot identified by its
 * generatedAt timestamp. The snapshot upload may still be in flight, so a 409
 * is retried a few times.
 */
export async function requestNarrative(assessmentId: string | null, generatedAt: string | null, lang: Lang): Promise<NarrativeResult> {
  if (!assessmentId || !generatedAt) return { ok: false, reason: 'local_only' };
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return { ok: false, reason: 'local_only' };

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase.functions.invoke('generate-narrative', {
      body: { assessment_id: assessmentId, generated_at: generatedAt, lang },
    });
    if (!error && data?.narrative) return { ok: true, narrative: data.narrative as Narrative, createdAt: String(data.createdAt ?? '') };
    const status = await statusOf(error);
    if (status === 409 && attempt < 3) {
      await wait(1500 * (attempt + 1));
      continue;
    }
    if (status === 409) return { ok: false, reason: 'not_saved' };
    if (status === 429) return { ok: false, reason: 'limit' };
    if (status === 422) return { ok: false, reason: 'rejected' };
    return { ok: false, reason: 'unavailable' };
  }
  return { ok: false, reason: 'unavailable' };
}
