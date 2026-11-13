# ExitIQ

ExitIQ is atares's exit readiness self-assessment. It's built to the *ExitIQ Product and Implementation Brief* v1.0 (4 November 2026, in `docs/`) and the landing and assessment designs in `docs/design/`.

The app is React + Vite + TypeScript on Supabase (project `elpjwoujqzskgydytvob`), deployed as a static SPA (Vercel config included).

## What is implemented (Release 1 scope from brief section 22)

- **Staged journey.** Context (3 steps) → configuration summary → 8 discovery screens → initial picture → deep assessment in 6 chapters → action plan. Progress is saved after every answer, and you can resume at any stage.
- **Context and routing.** All section 3 fields are covered, including `UNKNOWN`. The profile must be confirmed explicitly; "Not decided yet" keeps scoring pending. Seller tax residence is asked, never inferred. The 14 routes from section 4 are evaluated deterministically, and an unknown trigger keeps its module *pending*: it stays in the denominator and blocks a "complete" result.
- **Catalogue.** 55 registered controls (37 CORE + 18 conditional) with anchors, local weights, contributors, dependencies and context wording (Q07, Q12, Q32).
- **Scoring (section 7).** Effective weights, answer coverage, an answered-only index (null, never 0, when nothing is answered), missing-answer bounds, a separate evidence support figure, the 80% / 50%-per-domain display rule, and "Indicative, incomplete" vs "Complete". There is no overall score, valuation or multiple.
- **Answer states (section 18).** Substantive, Unknown, Needs internal confirmation, Needs adviser review, Prefer not to answer, N/A requested (removes no weight until confirmed), and Conflicted. When a context edit turns a module off, its answers go *inactive* and are never deleted. If the module comes back, those answers need reconfirmation.
- **Risks and priorities (section 8).** Rules R01–R07, plus liquidity review and unresolved applicability. Critical status comes only from a confirmed predicate; UNKNOWN only ever creates "Needs review". Tasks are ordered confirmed-critical → unresolved-critical → gaps, then by timing and `e_q × (100 − a_q)/100`. Each task carries its source question, reason, domain action template, suggested owner, timing, dependencies and evidence required.
- **Action plan (section 19).** Context chips, three dimension cards, risk status, up to 3 supported strengths linked to answer IDs, a filterable task list with per-task status, and a tax section split into company, seller and cross-border. It also offers a branded "Save as PDF" print layout (atares logo, A4, all tasks), a branded Excel download (overview and task sheets with logo, filters and a status dropdown), an optional "Discuss with atares" email link to exitiq@atares.io, and delete.
- **Analytics (section 20).** Stage views (context, discovery, initial picture, setup, specialist topics, summary, detailed assessment, report), the question on screen (`QUESTION:Qxx`, to locate exits), starts, theme completion, route changes, saves, resumes, result views, exports and contact requests. Events carry no answer content.
- **Landing page.** Ported from *ExitIQ Landing v2* with EN/DE copy and the interactive 3-question preview.
- **English and German.** One language switch for the whole site (`src/lib/i18n.ts`). The English catalogue in `src/model/catalogue.ts` stays the scored and stored source of truth; German is a text-only overlay (`src/i18n/catalogue-de.ts`), the UI strings are in `src/i18n/ui.ts` and the model's risk/task/observation text in `src/model/text.ts`. Stored answers, task keys and result snapshots are language-neutral (English). The German wording should be reviewed by the M&A content owner before launch.
- **Written summary (section 20).** The action plan always shows a written summary built in the browser by fixed rules from the same result (`src/model/narrative-template.ts`), so it works without any server setup and cannot disagree with the figures. When progress is saved online, the user can additionally ask for an AI-written version. The `generate-narrative` Edge Function builds it from the stored result snapshot only (no evidence references, no seller tax details), labels each statement as "You reported" / "This may imply" / "Suggested next step", and rejects output that is truncated, cites unknown questions, quotes numbers not in the result, or uses valuation, probability, tax-saving or verification language. Rejected output is never shown; the deterministic plan is complete without it. Cached per snapshot and language; 10 generations per user per day.

## Supabase setup (one time, in the dashboard / CLI)

The Supabase connector used to build this had no access to the project, so **the migrations have not been applied yet**. To set up:

1. **Apply the schema**:

   ```bash
   npx supabase link --project-ref elpjwoujqzskgydytvob
   ```

   ```bash
   npx supabase db push
   ```

   Alternatively, paste the files in `supabase/migrations/` into the SQL editor, in filename order.
2. **Enable anonymous sign-ins**: Dashboard → Authentication → Sign In / Providers → *Allow anonymous sign-ins*. Each visitor then gets a real `auth.uid()`, and RLS enforces owner-only access. Without it, the app still works, but only in the browser ("Saved in this browser").
3. **Turn on abuse protection** for anonymous sign-ins: Authentication → Attack Protection → CAPTCHA with **Cloudflare Turnstile**, using the Turnstile *secret* key. Then set the Turnstile *site* key as `VITE_TURNSTILE_SITE_KEY` on Vercel (and in `.env.local`), and redeploy. Without the site key, Supabase rejects every anonymous sign-in, and the app quietly falls back to saving in the browser only. In Cloudflare, the widget's allowed hostnames must include the production domain (and `localhost` for development).
4. **URL configuration**: Authentication → URL Configuration. Set the Site URL to the production domain and add `https://<domain>/assessment` as a redirect URL. "Save and return" uses these when it links an email to the anonymous user.
5. **Written summary (optional)**: deploy the function and add the API key:

   ```bash
   npx supabase functions deploy generate-narrative
   ```

   Then Dashboard → Edge Functions → Secrets → add `ANTHROPIC_API_KEY`. Without it the button reports that the summary is unavailable and everything else works.
6. **Legal links**: set `VITE_IMPRINT_URL` and `VITE_PRIVACY_URL` on Vercel (plus `VITE_IMPRINT_URL_DE` / `VITE_PRIVACY_URL_DE` if the German pages differ) and redeploy. Until then the links go to the atares homepage.
7. **Check the advisors**: Dashboard → Advisors (security and performance) after the migration.

## Database

| Table | Purpose | Client access (RLS) |
| --- | --- | --- |
| `question_definitions`, `profile_weights` | Versioned catalogue (generated from `src/model/catalogue.ts`) | read for everyone |
| `assessments` | Context, profile, modules, versions, stage | owner only |
| `answers` | **Append-only** answer history (`previous_answer_id`); `current_answers` view = latest per question | owner reads and appends; no update/delete |
| `evidence_refs` | Dated reference, responsible role, review status, access scope | owner adds; can't self-certify `reviewed` |
| `tasks` | Action plan with user status / agreed due date | owner |
| `result_snapshots` | Versioned deterministic result objects | owner reads and appends |
| `narratives` | Generated summaries (and rejected attempts, for the daily limit) | owner reads; written only by the Edge Function |
| `analytics_events` | Minimal events | insert only |

Clients can't write the states that need an authorised reviewer: confirmed N/A, reviewed evidence and contradiction resolution. The reviewer role and seller-private access scopes are part of Release 2.

## Development

```bash
npm install
```

```bash
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm test` | Model acceptance tests (brief section 21) and the catalogue-seed drift check |
| `npm run typecheck` | TypeScript |
| `npm run build` | Production build into `dist/` |
| `npm run db:test` | Applies all migrations to a throwaway local Postgres (with a minimal Supabase stub) and runs the RLS checks in `supabase/tests/rls.test.sql` |
| `npm run gen:catalogue-sql` | Regenerates the catalogue seed migration after editing `src/model/catalogue.ts` |

Environment variables (`.env.local`): `VITE_TURNSTILE_SITE_KEY` (required while CAPTCHA protection is on), plus the optional `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The publishable key is public by design, and the defaults point at the ExitIQ project. Never put a secret or service-role key in a `VITE_` variable.

## Code map

- `src/model/`: the pure, deterministic engine. `catalogue.ts` holds controls, weights, chapters and action templates; `routing.ts`, `scoring.ts` and `plan.ts` cover risks, tasks, observations and the result snapshot. The recalculation order follows section 18. No language model touches scores, routes or risk status.
- `src/lib/store.ts`: assessment state, local persistence and the remote mirroring calls.
- `src/lib/remote.ts`: Supabase reads and writes, anonymous sign-in and analytics.
- `src/views/`: the landing page and the assessment screens.
- `supabase/migrations/`: schema, RLS and the generated catalogue seed.

## Troubleshooting online saving

The MVP test (12 November 2026) showed "Saved in this browser … online copy failed" with the technical detail
`Could not find the table 'public.assessments' in the schema cache`. That message means the database migrations
have not been applied to the hosted project. Fix:

1. Run `bash scripts/setup-supabase.sh` (or `npx supabase db push`) against project `elpjwoujqzskgydytvob`.
2. Dashboard → Authentication → Sign In / Providers: *Allow anonymous sign-ins* on.
3. Dashboard → Authentication → Attack Protection: CAPTCHA off, or Turnstile site key set in Vercel and the Vercel
   domain allowed in the Turnstile widget.
4. Acceptance: in a fresh private window, answer one question; the header must say "Saved" (not "on this browser
   only"), and after a reload the answer must still be there. Then use "Try again" after deliberately going offline
   to check that local work is kept and reconciled.

## Open items before launch

- **Content sign-off** (brief section 22). The 55 anchors, domain matrices, critical predicates and task wording are *proposed v1 parameters*. The M&A, tax and legal owners need to approve them before production scoring.
- **Imprint and privacy.** The footer links point to atares.team. The privacy notice must match this implementation: anonymous auth session, Supabase storage, no AI processing, and deletion from the action plan.
- **German assessment.** The landing page is EN/DE; the assessment is English only.
- **Release 2.** Scoped contributor invitations, a reviewer role (confirm N/A, review evidence, resolve conflicts), and seller-private tax areas. The UI says so honestly and offers a CSV task export in the meantime.
- **Narrative report.** Not generated in this version. The deterministic result is the report. Any later narrative must be generated from `ResultSnapshot`, which comes from `buildResult`, under the section 20 rules.
