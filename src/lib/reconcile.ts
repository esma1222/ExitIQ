// Pure comparison of the local assessment with what the database holds, used
// by syncAll() to push only what differs. Kept free of Supabase so it is
// unit-tested.

import type { Answer, EvidenceRef } from '../model/types';

/** The fields of a current_answers row that matter for comparison. */
export interface RemoteAnswerRow {
  id: string;
  question_id: string;
  status: string;
  points: number | null;
  value: unknown;
  requires_reconfirmation: boolean | null;
  inactive_since: string | null;
  na_reason: string | null;
}

export interface RemoteEvidenceRow {
  question_id: string;
  reference: string;
  owner_role: string | null;
  as_of_date: string | null;
}

/** True when the latest remote row already records this local answer (null = cleared / never answered). */
export function answerMatches(local: Answer | null | undefined, remote: RemoteAnswerRow | undefined): boolean {
  if (!local) return !remote || remote.status === 'cleared';
  if (!remote) return false;
  const points = local.status === 'substantive' ? local.points ?? null : null;
  return remote.status === local.status
    && (remote.points ?? null) === points
    && !!remote.requires_reconfirmation === !!local.requiresReconfirmation
    && !!remote.inactive_since === !!local.inactiveSince
    && (remote.na_reason ?? null) === (local.naReason ?? null);
}

/** Diagnostics are stored as status + value: 'Unknown' → unknown, 'Prefer not to answer' → withheld, else diagnostic with the value. */
export function diagnosticMatches(local: string | string[] | null | undefined, remote: RemoteAnswerRow | undefined): boolean {
  const empty = local == null || (Array.isArray(local) && local.length === 0);
  if (empty) return !remote || remote.status === 'cleared';
  if (!remote) return false;
  if (local === 'Unknown') return remote.status === 'unknown';
  if (local === 'Prefer not to answer') return remote.status === 'withheld';
  return remote.status === 'diagnostic' && JSON.stringify(remote.value) === JSON.stringify(local);
}

export function evidenceMatches(local: EvidenceRef | null | undefined, remote: RemoteEvidenceRow | undefined): boolean {
  if (!local) return true; // evidence history is append-only; a removed reference is recorded on the answer row
  if (!remote) return false;
  return remote.reference === (local.reference.trim() || 'Not specified')
    && (remote.owner_role ?? '') === local.ownerRole.trim()
    && (remote.as_of_date ?? null) === (local.asOfDate ?? null);
}
