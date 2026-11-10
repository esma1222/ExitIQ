// generate-narrative: optional written summary of a stored ExitIQ result.
//
// POST { assessment_id, generated_at, lang } with the user's access token.
// The function loads the caller's own result snapshot (the one the browser is
// showing, identified by generatedAt), builds the permitted facts, asks Claude
// for a labelled narrative, validates it and stores it. The deterministic
// result in the browser never waits for this and never depends on it.
//
// Secrets (Supabase → Edge Functions → Secrets): ANTHROPIC_API_KEY.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

import Anthropic from 'npm:@anthropic-ai/sdk@1.2.0';
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import {
  buildFacts, knownQuestionIds, OUTPUT_SCHEMA, systemPrompt, userPrompt, validateNarrative,
  type Lang, type SnapshotLike,
} from './narrative.ts';

const MODEL = 'claude-opus-5-5';
const DAILY_LIMIT = 10; // generation attempts per user per 24 hours (cached results don't count)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !url || !serviceKey) return json(503, { error: 'not_configured' });

  let body: { assessment_id?: unknown; generated_at?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  const assessmentId = typeof body.assessment_id === 'string' && UUID.test(body.assessment_id) ? body.assessment_id : null;
  const generatedAt = typeof body.generated_at === 'string' && body.generated_at.length <= 40 ? body.generated_at : null;
  const lang: Lang = body.lang === 'de' ? 'de' : 'en';
  if (!assessmentId || !generatedAt) return json(400, { error: 'invalid_request' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Who is calling? Anonymous ExitIQ users are real auth users, so this works for them too.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userErr || !userId) return json(401, { error: 'unauthorized' });

  // Ownership is checked explicitly because the service role bypasses RLS.
  const { data: assessment } = await admin.from('assessments').select('id, owner_id').eq('id', assessmentId).maybeSingle();
  if (!assessment || assessment.owner_id !== userId) return json(404, { error: 'not_found' });

  const { data: snap } = await admin.from('result_snapshots').select('id, result')
    .eq('assessment_id', assessmentId).eq('result->>generatedAt', generatedAt)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!snap) return json(409, { error: 'snapshot_not_saved' }); // the browser retries shortly

  const { data: cached } = await admin.from('narratives').select('content, model, created_at')
    .eq('snapshot_id', snap.id).eq('lang', lang).eq('status', 'ok').maybeSingle();
  if (cached) return json(200, { narrative: cached.content, model: cached.model, createdAt: cached.created_at, cached: true });

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from('narratives').select('id', { count: 'exact', head: true })
    .eq('owner_id', userId).gte('created_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) return json(429, { error: 'daily_limit' });

  const record = (status: 'ok' | 'rejected' | 'error', extra: { content?: unknown; model?: string; reason?: string }) =>
    admin.from('narratives').insert({
      assessment_id: assessmentId, snapshot_id: snap.id, owner_id: userId, lang, status,
      content: extra.content ?? null, model: extra.model ?? MODEL, reject_reason: extra.reason?.slice(0, 200) ?? null,
    });

  const snapshot = snap.result as SnapshotLike;
  const facts = buildFacts(snapshot);
  const client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 });

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> } },
      system: systemPrompt(lang),
      messages: [{ role: 'user', content: userPrompt(facts) }],
    });
  } catch (e) {
    const reason = e instanceof Anthropic.RateLimitError ? 'anthropic rate limit'
      : e instanceof Anthropic.APIError ? `anthropic api ${e.status ?? 'error'}`
      : 'anthropic request failed';
    await record('error', { reason });
    return json(503, { error: 'generation_failed' });
  }

  if (response.stop_reason === 'refusal') {
    await record('error', { model: response.model, reason: 'refusal' });
    return json(422, { error: 'rejected' });
  }
  if (response.stop_reason !== 'end_turn') {
    await record('rejected', { model: response.model, reason: `stop_reason ${response.stop_reason}` });
    return json(422, { error: 'rejected' });
  }

  const text = response.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    await record('rejected', { model: response.model, reason: 'invalid json' });
    return json(422, { error: 'rejected' });
  }

  const v = validateNarrative(parsed, facts, knownQuestionIds(snapshot));
  if (!v.ok) {
    await record('rejected', { model: response.model, reason: v.reason });
    return json(422, { error: 'rejected' });
  }

  const { error: insErr } = await record('ok', { content: v.narrative, model: response.model });
  if (insErr) {
    // A concurrent request may have stored one first; serve that.
    const { data: again } = await admin.from('narratives').select('content, model, created_at')
      .eq('snapshot_id', snap.id).eq('lang', lang).eq('status', 'ok').maybeSingle();
    if (again) return json(200, { narrative: again.content, model: again.model, createdAt: again.created_at, cached: true });
  }
  return json(200, { narrative: v.narrative, model: response.model, createdAt: new Date().toISOString(), cached: false });
});
