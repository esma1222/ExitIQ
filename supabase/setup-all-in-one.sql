-- ExitIQ database setup in one file, for the Supabase SQL Editor.
-- GENERATED from supabase/migrations by scripts/build-setup-sql.py. Do not edit by hand.
--
-- Use: Supabase dashboard -> project elpjwoujqzskgydytvob -> SQL Editor -> New query,
-- paste this whole file, click Run. It runs as one transaction: either everything is
-- created or nothing changes. If the ExitIQ tables already exist, it stops with a
-- message and changes nothing.

begin;

do $guard$
begin
  if to_regclass('public.assessments') is not null then
    raise exception 'ExitIQ tables already exist in this project. Nothing was changed. If the app still reports a missing table, run only: notify pgrst, ''reload schema'';';
  end if;
end
$guard$;

-- ════ 20261110120000_init_schema.sql ════
-- ExitIQ v1 schema (Product and Implementation Brief, section 18).
--
-- Access model
--   * Every assessment belongs to exactly one auth user (owner_id). Visitors get
--     a real auth.uid() through Supabase anonymous sign-in, so ownership is
--     enforced by RLS on auth.uid() rather than on a self-asserted header.
--   * Default access is private to the owner. A respondent role is descriptive
--     and never grants access. Scoped contributors (release 2) will get their
--     own table and policies; nothing here grants cross-user access.
--   * Answers and result snapshots are append-only for clients: no UPDATE or
--     DELETE policies, so the audit trail cannot be rewritten from the browser.
--   * Statuses that need an authorised reviewer (confirmed N/A, reviewed
--     evidence, contradiction resolution) cannot be written by clients.
--
-- The question catalogue is reference data, seeded by the following migration
-- and generated from src/model/catalogue.ts.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- ── helpers ──────────────────────────────────────────────────────────────────

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── question catalogue (reference data) ──────────────────────────────────────

create table public.question_definitions (
  id                     text        not null,
  catalogue_version      text        not null,
  domain                 text        not null check (domain in ('S1','S2','S3','O1','O2','O3','O4','O5','T1','T2','T3','T4')),
  local_weight           smallint    not null check (local_weight between 1 and 3),
  route                  text        not null check (route in ('CORE','DEBT','CONTINGENT','REGULATED','INVESTOR_RIGHTS','EMPLOYEE_EQUITY','SEPARATION','PE_CONTEXT','CONVERTIBLE','CROSS_BORDER','ASSET_TRANSFER','PARTIAL','PRIMARY_CAPITAL','ACQUISITIONS')),
  name                   text        not null,
  question               text        not null,
  context_wording        jsonb       not null default '{}'::jsonb,
  anchors                jsonb       not null check (jsonb_typeof(anchors) = 'array' and jsonb_array_length(anchors) = 3),
  help                   text,
  evidence_request       text,
  suggested_contributor  text        not null,
  depends_on             text[]      not null default '{}',
  created_at             timestamptz not null default now(),
  primary key (catalogue_version, id)
);

comment on table public.question_definitions is
  'Registered scored controls per catalogue version. Generated from src/model/catalogue.ts; do not edit by hand.';

create table public.profile_weights (
  catalogue_version text     not null,
  profile           text     not null check (profile in ('OWNER','CORPORATE','PE','VC')),
  domain            text     not null check (domain in ('S1','S2','S3','O1','O2','O3','O4','O5','T1','T2','T3','T4')),
  weight            smallint not null check (weight between 0 and 100),
  primary key (catalogue_version, profile, domain)
);

-- ── assessments ──────────────────────────────────────────────────────────────

create table public.assessments (
  id                 uuid        primary key default gen_random_uuid(),
  owner_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  stage              text        not null default 'CONTEXT'
                       check (stage in ('CONTEXT','DISCOVERY','INITIAL_PICTURE','DEEP_ASSESSMENT','RESULT','SAVED','SPECIALIST_PATH','APPLICABILITY_PENDING')),
  resume_stage       text        check (resume_stage in ('CONTEXT','DISCOVERY','INITIAL_PICTURE','DEEP_ASSESSMENT','RESULT')),
  subject            text        check (char_length(subject) <= 200),
  perimeter          text        check (perimeter in ('whole_business','subsidiary','business_unit_assets','minority_interest','undecided')),
  respondent_role    text        check (respondent_role in ('owner','management','cfo','corporate_ma','investor','adviser','other')),
  confirmed_profile  text        check (confirmed_profile in ('OWNER','CORPORATE','PE','VC')),
  ownership_tags     text[]      not null default '{}',
  objectives         text[]      not null default '{}',
  horizon            text        check (horizon in ('under_6','m6_18','m19_36','over_36','undecided')),
  jurisdictions      jsonb       not null default '{}'::jsonb,
  -- Full routing context (section 3), including UNKNOWN values. Bounded in size.
  context            jsonb       not null default '{}'::jsonb check (pg_column_size(context) <= 16384),
  -- Unscored discovery diagnostics (E01, E03, E04, E07).
  diagnostics        jsonb       not null default '{}'::jsonb check (pg_column_size(diagnostics) <= 8192),
  -- Presentation state for resumption (current screen, question index). Never used for scoring.
  ui_state           jsonb       not null default '{}'::jsonb check (pg_column_size(ui_state) <= 4096),
  active_modules     text[]      not null default '{}',
  pending_modules    text[]      not null default '{}',
  catalogue_version  text        not null,
  scoring_version    text        not null,
  report_version     text        not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index assessments_owner_idx on public.assessments (owner_id, updated_at desc);

create trigger assessments_updated_at
  before update on public.assessments
  for each row execute function private.set_updated_at();

-- Ownership never moves through an UPDATE from the client.
create or replace function private.lock_assessment_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id cannot be changed';
  end if;
  return new;
end;
$$;

create trigger assessments_lock_owner
  before update on public.assessments
  for each row execute function private.lock_assessment_owner();

-- Ownership check used by every child-table policy. SECURITY DEFINER so the
-- policies do not recurse through assessments' own RLS; it only ever answers
-- for the calling user.
create or replace function private.owns_assessment(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assessments a
    where a.id = p_assessment_id and a.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_assessment(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.owns_assessment(uuid) to authenticated;

-- ── answers (append-only history) ────────────────────────────────────────────
-- Each change appends a row; the current answer is the latest row per
-- (assessment, question). Inactive answers stay stored and are excluded from
-- calculation by the routing rules, never deleted.

create table public.answers (
  id                       uuid        primary key default gen_random_uuid(),
  assessment_id            uuid        not null references public.assessments (id) on delete cascade,
  question_id              text        not null check (question_id ~ '^(Q[0-9]{2}|E[0-9]{2})$'),
  status                   text        not null check (status in (
                               'substantive','unknown','needs_internal_confirmation','needs_adviser_review','withheld',
                               'conflicted','not_applicable_requested','not_applicable_confirmed','diagnostic','cleared')),
  option_id                text        check (char_length(option_id) <= 40),
  points                   smallint    check (points in (0, 50, 100)),
  value                    jsonb       check (value is null or pg_column_size(value) <= 2048),
  evidence_level           numeric(2,1) not null default 0 check (evidence_level in (0, 0.5, 1)),
  respondent_id            uuid        not null default auth.uid(),
  respondent_role          text,
  source_version           text        not null,
  previous_answer_id       uuid        references public.answers (id) on delete set null,
  contradiction_state      text        not null default 'none' check (contradiction_state in ('none','conflicted','resolved')),
  requires_reconfirmation  boolean     not null default false,
  inactive_since           timestamptz,
  na_reason                text        check (char_length(na_reason) <= 1000),
  created_at               timestamptz not null default now(),
  -- Scored controls: substantive <=> points present. Diagnostics carry a value instead.
  constraint answers_points_consistent check (
    (question_id like 'Q%' and ((status = 'substantive') = (points is not null)) and status <> 'diagnostic')
    or (question_id like 'E%' and points is null and status in ('diagnostic','unknown','withheld','cleared'))
  ),
  -- Confirmed N/A needs an explanation and provenance.
  constraint answers_na_reason check (status <> 'not_applicable_confirmed' or na_reason is not null)
);

create index answers_assessment_question_idx on public.answers (assessment_id, question_id, created_at desc);
create index answers_previous_idx on public.answers (previous_answer_id);

create view public.current_answers
with (security_invoker = true) as
  select distinct on (assessment_id, question_id) *
  from public.answers
  order by assessment_id, question_id, created_at desc, id desc;

comment on view public.current_answers is 'Latest answer per assessment and question. Respects answers RLS (security_invoker).';

-- ── evidence references ──────────────────────────────────────────────────────
-- A restricted reference (where the support lives, who owns it, as of when),
-- not an upload. Only an authorised reviewer may set review_status = reviewed.

create table public.evidence_refs (
  id             uuid        primary key default gen_random_uuid(),
  assessment_id  uuid        not null references public.assessments (id) on delete cascade,
  question_id    text        not null check (question_id ~ '^Q[0-9]{2}$'),
  reference      text        not null check (char_length(reference) between 1 and 500),
  owner_role     text        check (char_length(owner_role) <= 120),
  as_of_date     date,
  review_status  text        not null default 'self_reported' check (review_status in ('self_reported','dated_reference','reviewed')),
  reviewer_id    uuid        references auth.users (id),
  reviewed_at    timestamptz,
  access_scope   text        not null default 'owner' check (access_scope in ('owner','company','seller_private')),
  created_by     uuid        not null default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint evidence_dated_reference check (review_status <> 'dated_reference' or (owner_role is not null and as_of_date is not null)),
  constraint evidence_reviewed check (review_status <> 'reviewed' or (reviewer_id is not null and reviewed_at is not null))
);

create index evidence_refs_assessment_idx on public.evidence_refs (assessment_id, question_id, created_at desc);
create index evidence_refs_reviewer_idx on public.evidence_refs (reviewer_id);

-- ── tasks ────────────────────────────────────────────────────────────────────

create table public.tasks (
  id                 uuid        primary key default gen_random_uuid(),
  assessment_id      uuid        not null references public.assessments (id) on delete cascade,
  task_key           text        not null check (char_length(task_key) <= 200),
  source_question_ids text[]     not null default '{}',
  rule_id            text,
  priority_class     smallint    not null check (priority_class in (1, 2, 3)),
  title              text        not null check (char_length(title) <= 300),
  reason             text        check (char_length(reason) <= 2000),
  accountable_role   text        check (char_length(accountable_role) <= 200),
  suggested_timing   text        check (char_length(suggested_timing) <= 100),
  agreed_due_date    date,
  dependencies       text[]      not null default '{}',
  evidence_required  text        check (char_length(evidence_required) <= 1000),
  status             text        not null default 'open' check (status in ('open','in_progress','done','dismissed')),
  resolution         jsonb       check (resolution is null or pg_column_size(resolution) <= 4096),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (assessment_id, task_key)
);

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();

-- ── result snapshots (append-only) ───────────────────────────────────────────

create table public.result_snapshots (
  id                 uuid        primary key default gen_random_uuid(),
  assessment_id      uuid        not null references public.assessments (id) on delete cascade,
  profile            text        check (profile in ('OWNER','CORPORATE','PE','VC')),
  catalogue_version  text        not null,
  scoring_version    text        not null,
  report_version     text        not null,
  data_status        text        not null check (data_status in ('data_complete','data_incomplete')),
  risk_status        text        not null check (risk_status in ('critical','review','none')),
  result             jsonb       not null check (pg_column_size(result) <= 262144),
  created_at         timestamptz not null default now()
);

create index result_snapshots_assessment_idx on public.result_snapshots (assessment_id, created_at desc);

-- ── analytics (section 20: minimal metadata, no answer content) ──────────────

create table public.analytics_events (
  id             bigint      generated always as identity primary key,
  assessment_id  uuid        references public.assessments (id) on delete set null,
  user_id        uuid        default auth.uid(),
  event          text        not null check (event in (
                    'stage_view','assessment_start','theme_complete','route_change','save','resume','result_view','contact_request','export')),
  stage          text        check (char_length(stage) <= 40),
  broad_context  text        check (broad_context in ('OWNER','CORPORATE','PE','VC','UNDECIDED')),
  device         text        check (device in ('mobile','tablet','desktop')),
  channel        text        check (char_length(channel) <= 60),
  is_internal    boolean     not null default false,
  created_at     timestamptz not null default now()
);

create index analytics_events_assessment_idx on public.analytics_events (assessment_id);
create index analytics_events_created_idx on public.analytics_events (created_at);

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table public.question_definitions enable row level security;
alter table public.profile_weights      enable row level security;
alter table public.assessments          enable row level security;
alter table public.answers              enable row level security;
alter table public.evidence_refs        enable row level security;
alter table public.tasks                enable row level security;
alter table public.result_snapshots     enable row level security;
alter table public.analytics_events     enable row level security;

-- Reference data: readable by everyone, written only by migrations.
create policy "catalogue is public" on public.question_definitions for select to anon, authenticated using (true);
create policy "weights are public"  on public.profile_weights      for select to anon, authenticated using (true);

-- Assessments: owner only.
create policy "owner reads assessments"   on public.assessments for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner creates assessments" on public.assessments for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner updates assessments" on public.assessments for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner deletes assessments" on public.assessments for delete to authenticated using (owner_id = (select auth.uid()));

-- Answers: owner reads and appends. Reviewer-only states are refused.
create policy "owner reads answers" on public.answers for select to authenticated
  using ((select private.owns_assessment(assessment_id)));
create policy "owner appends answers" on public.answers for insert to authenticated
  with check (
    (select private.owns_assessment(assessment_id))
    and respondent_id = (select auth.uid())
    and status not in ('not_applicable_confirmed', 'conflicted')
    and contradiction_state = 'none'
    and evidence_level in (0, 0.5)
  );

-- Evidence: owner reads and adds references; cannot self-certify a review.
create policy "owner reads evidence" on public.evidence_refs for select to authenticated
  using ((select private.owns_assessment(assessment_id)));
create policy "owner adds evidence" on public.evidence_refs for insert to authenticated
  with check (
    (select private.owns_assessment(assessment_id))
    and created_by = (select auth.uid())
    and review_status in ('self_reported', 'dated_reference')
    and reviewer_id is null and reviewed_at is null
  );

-- Tasks: owner maintains the plan.
create policy "owner reads tasks"   on public.tasks for select to authenticated using ((select private.owns_assessment(assessment_id)));
create policy "owner creates tasks" on public.tasks for insert to authenticated with check ((select private.owns_assessment(assessment_id)));
create policy "owner updates tasks" on public.tasks for update to authenticated
  using ((select private.owns_assessment(assessment_id))) with check ((select private.owns_assessment(assessment_id)));
create policy "owner deletes tasks" on public.tasks for delete to authenticated using ((select private.owns_assessment(assessment_id)));

-- Snapshots: owner reads and appends.
create policy "owner reads snapshots"   on public.result_snapshots for select to authenticated using ((select private.owns_assessment(assessment_id)));
create policy "owner appends snapshots" on public.result_snapshots for insert to authenticated with check ((select private.owns_assessment(assessment_id)));

-- Analytics: write-only for clients; reading is for the service role.
create policy "user records own events" on public.analytics_events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (assessment_id is null or (select private.owns_assessment(assessment_id)))
  );

-- ── grants ───────────────────────────────────────────────────────────────────
-- Explicit, so the Data API exposes exactly this and nothing more.

revoke all on public.question_definitions, public.profile_weights, public.assessments, public.answers,
              public.evidence_refs, public.tasks, public.result_snapshots, public.analytics_events,
              public.current_answers
  from anon, authenticated;

grant select on public.question_definitions, public.profile_weights to anon, authenticated;
grant select, insert, update, delete on public.assessments to authenticated;
grant select, insert on public.answers to authenticated;
grant select on public.current_answers to authenticated;
grant select, insert on public.evidence_refs to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert on public.result_snapshots to authenticated;
grant insert on public.analytics_events to authenticated;

-- ════ 20261110120100_seed_catalogue.sql ════
-- GENERATED by `npm run gen:catalogue-sql` from src/model/catalogue.ts. Do not edit by hand.
-- catalogue-2026.11-v1: 55 registered controls and the four profile weight matrices.

insert into public.question_definitions
  (id, catalogue_version, domain, local_weight, route, name, question, context_wording, anchors, help, evidence_request, suggested_contributor, depends_on)
values
  ('Q01', 'catalogue-2026.11-v1', 'S1', 2, 'CORE', 'Transaction objectives', 'What should this transaction achieve for the relevant sellers or capital providers?', '{}'::jsonb, '["Objectives have not been articulated.","Objectives are described but priorities remain unresolved.","Prioritised objectives are documented."]'::jsonb, null, 'A dated document with a named owner that shows: prioritised objectives are documented.', 'Lead shareholder / sponsor', '{}'::text[]),
  ('Q02', 'catalogue-2026.11-v1', 'S1', 1, 'CORE', 'Timing and preparation', 'How clearly is the intended timetable linked to the preparation work still required?', '{}'::jsonb, '["No timetable or preparation sequence exists.","A timetable exists without a complete dependency review.","A timetable and preparation dependencies are documented."]'::jsonb, null, 'A dated document with a named owner that shows: a timetable and preparation dependencies are documented.', 'Transaction lead', '{}'::text[]),
  ('Q03', 'catalogue-2026.11-v1', 'S2', 3, 'CORE', 'Stakeholder alignment', 'How far have the relevant decision makers agreed on the intended transaction objectives?', '{}'::jsonb, '["Material disagreement is unresolved.","Views have been collected; some differences remain open.","Objectives are agreed through the relevant governance process."]'::jsonb, null, 'A dated document with a named owner that shows: objectives are agreed through the relevant governance process.', 'Lead shareholder / board', '{}'::text[]),
  ('Q04', 'catalogue-2026.11-v1', 'S2', 2, 'CORE', 'Decision authority', 'Are the approvals required to launch and complete the proposed transaction mapped?', '{}'::jsonb, '["Required approvals are not mapped.","Approval bodies are identified; process or timing is incomplete.","Required bodies, authority and decision timetable are documented."]'::jsonb, null, 'A dated document with a named owner that shows: required bodies, authority and decision timetable are documented.', 'Legal / board secretariat', '{}'::text[]),
  ('Q05', 'catalogue-2026.11-v1', 'S3', 2, 'CORE', 'Feasible transaction options', 'Have the realistic transaction options been compared against the stated objectives?', '{}'::jsonb, '["No comparison has been made.","Options are listed without a complete comparison.","Feasible options and their trade-offs are documented."]'::jsonb, null, 'A dated document with a named owner that shows: feasible options and their trade-offs are documented.', 'Transaction lead / adviser', array['Q01']::text[]),
  ('Q06', 'catalogue-2026.11-v1', 'S3', 2, 'CORE', 'Future management role', 'Has the intended post-transaction role of the current leadership been defined?', '{}'::jsonb, '["Expectations are unresolved.","An intended role exists; feasibility or succession remains open.","Roles and continuity requirements are documented and aligned."]'::jsonb, null, 'A dated document with a named owner that shows: roles and continuity requirements are documented and aligned.', 'Management / owners', '{}'::text[]),
  ('Q07', 'catalogue-2026.11-v1', 'O1', 3, 'CORE', 'Repeatable business economics', 'Can you explain the economics that would continue under normal operating conditions?', '{"growth":"Can you explain your reconciled cohort or unit economics and the documented path to sustainable economics?"}'::jsonb, '["The underlying economics are not understood.","Key drivers are identified but the analysis is incomplete.","Repeatable earnings or growth-model unit economics are reconciled and explained."]'::jsonb, null, 'A dated document with a named owner that shows: repeatable earnings or growth-model unit economics are reconciled and explained.', 'CFO', '{}'::text[]),
  ('Q08', 'catalogue-2026.11-v1', 'O1', 2, 'CORE', 'Liquidity planning', 'Does your cash planning identify funding needs through the intended transaction period?', '{}'::jsonb, '["No usable cash forecast exists.","A forecast exists but funding scenarios are incomplete.","A maintained scenario forecast identifies needs and funded responses."]'::jsonb, null, 'A dated document with a named owner that shows: a maintained scenario forecast identifies needs and funded responses.', 'CFO', '{}'::text[]),
  ('Q09', 'catalogue-2026.11-v1', 'O2', 3, 'CORE', 'Customer exposure response', 'How prepared are you for the loss of a material customer?', '{}'::jsonb, '["Exposure and response are unassessed.","Exposure is quantified; the response is incomplete.","Exposure and a proportionate response are documented."]'::jsonb, null, 'A dated document with a named owner that shows: exposure and a proportionate response are documented.', 'Commercial lead / CFO', '{}'::text[]),
  ('Q10', 'catalogue-2026.11-v1', 'O2', 2, 'CORE', 'Revenue durability', 'Can you demonstrate how existing customer revenue is retained or renewed?', '{}'::jsonb, '["Retention or repeat purchasing is not monitored.","Some retention or repeat-order data exists.","A reconciled history and relevant contract terms explain durability."]'::jsonb, null, 'A dated document with a named owner that shows: a reconciled history and relevant contract terms explain durability.', 'Commercial lead', '{}'::text[]),
  ('Q11', 'catalogue-2026.11-v1', 'O2', 1, 'CORE', 'Critical supply continuity', 'What would maintain delivery if a critical supplier stopped supplying?', '{}'::jsonb, '["Critical dependencies have no continuity response.","Alternatives or responses are identified but incomplete.","Dependencies and proportionate continuity arrangements are documented."]'::jsonb, null, 'A dated document with a named owner that shows: dependencies and proportionate continuity arrangements are documented.', 'Operations', '{}'::text[]),
  ('Q12', 'catalogue-2026.11-v1', 'O3', 3, 'CORE', 'Decision continuity', 'Which decisions would wait during a four-week absence of a key decision maker?', '{"owner_led":"You are unavailable for four weeks. Which decisions wait?","employed":"A key executive is unavailable for four weeks. Which decisions wait?"}'::jsonb, '["Many routine decisions would wait.","Some material decisions would wait.","Material decisions continue within documented delegated authority."]'::jsonb, null, 'A dated document with a named owner that shows: material decisions continue within documented delegated authority.', 'CEO', '{}'::text[]),
  ('Q13', 'catalogue-2026.11-v1', 'O3', 2, 'CORE', 'Critical expertise cover', 'Who could cover essential work if a key expert were absent for an extended period?', '{}'::jsonb, '["Critical work has no cover.","Cover is identified but not sufficiently prepared.","Capable cover and essential knowledge transfer are in place."]'::jsonb, null, 'A dated document with a named owner that shows: capable cover and essential knowledge transfer are in place.', 'Operations / people lead', '{}'::text[]),
  ('Q14', 'catalogue-2026.11-v1', 'O3', 2, 'CORE', 'Customer relationship continuity', 'How well are important customer relationships maintained beyond one individual?', '{}'::jsonb, '["Material relationships depend on one person without cover.","Additional contacts exist but ownership is incomplete.","Account ownership and relationship continuity are established."]'::jsonb, null, 'A dated document with a named owner that shows: account ownership and relationship continuity are established.', 'Commercial lead', '{}'::text[]),
  ('Q15', 'catalogue-2026.11-v1', 'O4', 2, 'CORE', 'Repeatable core processes', 'Can someone new follow the documented steps for your essential operating processes?', '{}'::jsonb, '["Essential processes rely on undocumented personal knowledge.","Some essential processes are documented.","Essential processes have usable documentation and clear owners."]'::jsonb, null, 'A dated document with a named owner that shows: essential processes have usable documentation and clear owners.', 'Operations', '{}'::text[]),
  ('Q16', 'catalogue-2026.11-v1', 'O4', 2, 'CORE', 'Capacity for growth', 'Have you assessed what would constrain a material increase in demand?', '{}'::jsonb, '["Constraints have not been assessed.","Main constraints are known without a complete response.","Capacity constraints and a resourced response are documented."]'::jsonb, 'Use a demand scenario that is relevant for your business. There is no universal growth target.', 'A dated document with a named owner that shows: capacity constraints and a resourced response are documented.', 'Operations / CFO', '{}'::text[]),
  ('Q17', 'catalogue-2026.11-v1', 'O4', 2, 'CORE', 'Technology continuity', 'How prepared are your essential systems for a prolonged outage?', '{}'::jsonb, '["No usable recovery arrangements exist.","Recovery arrangements exist but have material untested gaps.","Recovery arrangements are documented and appropriately tested."]'::jsonb, 'A known serious security issue may need a specialist task. It is not automatically a transaction veto.', 'A dated document with a named owner that shows: recovery arrangements are documented and appropriately tested.', 'IT / security', '{}'::text[]),
  ('Q18', 'catalogue-2026.11-v1', 'O4', 2, 'ACQUISITIONS', 'Acquisition integration', 'Are material dependencies from previous acquisitions under control?', '{}'::jsonb, '["Material integration dependencies lack an owned plan.","A plan exists with unresolved ownership or milestones.","Dependencies have owners, milestones and monitored progress."]'::jsonb, null, 'A dated document with a named owner that shows: dependencies have owners, milestones and monitored progress.', 'Integration lead', '{}'::text[]),
  ('Q19', 'catalogue-2026.11-v1', 'O5', 2, 'CORE', 'Defensible differentiation', 'What evidence supports the reason customers choose your business?', '{}'::jsonb, '["The proposition is asserted without supporting evidence.","Some evidence supports the proposition.","Relevant customer, product or market evidence supports the proposition."]'::jsonb, 'This measures whether the proposition can be supported, not whether a strong moat exists.', 'A dated document with a named owner that shows: relevant customer, product or market evidence supports the proposition.', 'Commercial / product lead', '{}'::text[]),
  ('Q20', 'catalogue-2026.11-v1', 'O5', 2, 'CORE', 'Credible development roadmap', 'How prepared is the next material product or service development step?', '{}'::jsonb, '["No development priorities have been defined.","Priorities exist without an executable plan.","Priorities, resources, milestones and success measures are documented."]'::jsonb, null, 'A dated document with a named owner that shows: priorities, resources, milestones and success measures are documented.', 'Product / strategy', '{}'::text[]),
  ('Q21', 'catalogue-2026.11-v1', 'T1', 3, 'CORE', 'Financial information package', 'Could you provide a consistent historical financial package for the proposed perimeter?', '{}'::jsonb, '["Key financial records are incomplete or inconsistent.","Most records exist; material reconciliations remain open.","Required periods and perimeter are reconciled and ready for review."]'::jsonb, null, 'A dated document with a named owner that shows: required periods and perimeter are reconciled and ready for review.', 'CFO', '{}'::text[]),
  ('Q22', 'catalogue-2026.11-v1', 'T1', 2, 'CORE', 'Forecast support', 'Can the financial forecast be traced to explicit operating assumptions?', '{}'::jsonb, '["The forecast cannot be traced to operating assumptions.","Main assumptions are documented with gaps.","Operating assumptions and financial consequences are traceable."]'::jsonb, null, 'A dated document with a named owner that shows: operating assumptions and financial consequences are traceable.', 'CFO', array['Q21']::text[]),
  ('Q23', 'catalogue-2026.11-v1', 'T1', 2, 'CORE', 'Enterprise to equity bridge', 'Are cash, debt and other potential purchase-price adjustments identified?', '{}'::jsonb, '["Potential adjustments are not mapped.","A preliminary mapping exists.","Adjustments and supporting balances are documented for review."]'::jsonb, null, 'A dated document with a named owner that shows: adjustments and supporting balances are documented for review.', 'CFO / transaction adviser', array['Q21']::text[]),
  ('Q24', 'catalogue-2026.11-v1', 'T1', 3, 'DEBT', 'Financing releases', 'Is the route to required lender consents and security releases understood?', '{}'::jsonb, '["Required consents or releases are unassessed.","Requirements are identified without a complete execution plan.","Requirements, parties and execution timetable are documented."]'::jsonb, null, 'A dated document with a named owner that shows: requirements, parties and execution timetable are documented.', 'CFO / legal', array['Q23']::text[]),
  ('Q25', 'catalogue-2026.11-v1', 'T2', 1, 'CORE', 'Tax workstream', 'Has a transaction-experienced tax adviser been engaged for the proposed transaction?', '{}'::jsonb, '["No adviser or responsible tax workstream is assigned.","An adviser is identified but scope is not agreed.","A responsible adviser and transaction scope are agreed."]'::jsonb, 'A general tax adviser is not the same as transaction-specific analysis.', 'A dated document with a named owner that shows: a responsible adviser and transaction scope are agreed.', 'Sellers / tax lead', '{}'::text[]),
  ('Q26', 'catalogue-2026.11-v1', 'T2', 3, 'CORE', 'Seller tax map', 'Is the legal and tax profile of the relevant sellers documented?', '{}'::jsonb, '["Relevant seller entities or jurisdictions are unmapped.","A preliminary seller map exists.","Relevant legal forms, tax jurisdictions and ownership chains are mapped."]'::jsonb, null, 'A dated document with a named owner that shows: relevant legal forms, tax jurisdictions and ownership chains are mapped.', 'Tax adviser', '{}'::text[]),
  ('Q27', 'catalogue-2026.11-v1', 'T2', 3, 'CORE', 'Transaction alternatives', 'Have tax consequences of feasible transaction structures been compared?', '{}'::jsonb, '["No transaction-specific comparison exists.","Initial analysis exists with material open assumptions.","A dated transaction-specific comparison records assumptions and open points."]'::jsonb, null, 'A dated document with a named owner that shows: a dated transaction-specific comparison records assumptions and open points.', 'Tax adviser', array['Q26']::text[]),
  ('Q28', 'catalogue-2026.11-v1', 'T2', 3, 'CORE', 'Historical tax restrictions', 'Have past reorganisations and transfers been reviewed for transaction-related restrictions?', '{}'::jsonb, '["Relevant history has not been reviewed.","History is collected; specialist assessment remains incomplete.","History and any applicable restrictions or deadlines have been reviewed."]'::jsonb, 'Past restructuring leads to a specialist review. It does not by itself mean a tax charge or deadline applies.', 'A dated document with a named owner that shows: history and any applicable restrictions or deadlines have been reviewed.', 'Tax adviser', '{}'::text[]),
  ('Q29', 'catalogue-2026.11-v1', 'T2', 2, 'CORE', 'Tax exposure register', 'Are material unresolved tax matters identified for the proposed perimeter?', '{}'::jsonb, '["No reliable register exists.","Known matters are listed without complete assessment.","Material matters, including audit issues, have documented treatment and owners."]'::jsonb, null, 'A dated document with a named owner that shows: material matters, including audit issues, have documented treatment and owners.', 'Tax adviser / CFO', '{}'::text[]),
  ('Q30', 'catalogue-2026.11-v1', 'T2', 1, 'CORE', 'Tax information availability', 'Can the relevant tax records be supplied for review?', '{}'::jsonb, '["Key records are missing.","Most records exist with unresolved gaps.","Required records are indexed with a response for any gaps."]'::jsonb, null, 'A dated document with a named owner that shows: required records are indexed with a response for any gaps.', 'CFO / tax adviser', '{}'::text[]),
  ('Q31', 'catalogue-2026.11-v1', 'T2', 3, 'CONTINGENT', 'Rollover and variable consideration', 'Have the tax implications of the proposed rollover or variable/deferred payments been reviewed?', '{}'::jsonb, '["No review exists.","A review is underway with material open points.","A transaction-specific review records assumptions, treatment and dependencies."]'::jsonb, null, 'A dated document with a named owner that shows: a transaction-specific review records assumptions, treatment and dependencies.', 'Sellers’ tax adviser', array['Q27']::text[]),
  ('Q32', 'catalogue-2026.11-v1', 'T3', 3, 'CORE', 'Legal ownership', 'Can legal ownership of the proposed sale interests be reconciled to the ownership records?', '{"venture":"Can legal ownership of the proposed sale interests be reconciled to the fully diluted cap table?"}'::jsonb, '["Ownership records or transfer chain have material unresolved gaps.","Records largely reconcile with open points.","Ownership and relevant transfer history reconcile."]'::jsonb, null, 'A dated document with a named owner that shows: ownership and relevant transfer history reconcile.', 'Legal', '{}'::text[]),
  ('Q33', 'catalogue-2026.11-v1', 'T3', 3, 'CORE', 'Essential intellectual property', 'Can the company demonstrate its rights to the technology or other IP essential to its business?', '{}'::jsonb, '["Essential rights are undocumented or unresolved.","Key rights are documented with open assignment or licence issues.","Essential rights and material licence conditions are documented."]'::jsonb, null, 'A dated document with a named owner that shows: essential rights and material licence conditions are documented.', 'Legal / technology lead', '{}'::text[]),
  ('Q34', 'catalogue-2026.11-v1', 'T3', 2, 'CORE', 'Material contract change', 'Have material contract consequences of the proposed transaction been assessed?', '{}'::jsonb, '["Relevant contract consequences are unreviewed.","Key contracts are reviewed; material follow-up remains open.","Consequences and any required consents or responses are documented."]'::jsonb, null, 'A dated document with a named owner that shows: consequences and any required consents or responses are documented.', 'Legal / commercial', '{}'::text[]),
  ('Q35', 'catalogue-2026.11-v1', 'T3', 2, 'CORE', 'Disputes and claims', 'Are material actual or threatened disputes assessed for the proposed transaction?', '{}'::jsonb, '["No reliable assessment exists.","Known matters are recorded with material gaps.","Material matters and proportionate treatment are documented."]'::jsonb, null, 'A dated document with a named owner that shows: material matters and proportionate treatment are documented.', 'Legal', '{}'::text[]),
  ('Q36', 'catalogue-2026.11-v1', 'T3', 2, 'CORE', 'Data protection preparation', 'Are material data protection issues identified and assigned a response?', '{}'::jsonb, '["Material issues have not been assessed.","An assessment exists with incomplete responses.","Material issues and remediation responsibilities are documented."]'::jsonb, null, 'A dated document with a named owner that shows: material issues and remediation responsibilities are documented.', 'Privacy / legal', '{}'::text[]),
  ('Q37', 'catalogue-2026.11-v1', 'T3', 3, 'REGULATED', 'Regulatory continuity', 'Has continuity of essential licences or approvals through the transaction been checked?', '{}'::jsonb, '["Continuity requirements are unreviewed.","Requirements are identified; execution remains incomplete.","Required approvals and continuity steps are documented."]'::jsonb, null, 'A dated document with a named owner that shows: required approvals and continuity steps are documented.', 'Regulatory / legal', '{}'::text[]),
  ('Q38', 'catalogue-2026.11-v1', 'T3', 3, 'INVESTOR_RIGHTS', 'Investor distribution rights', 'Can the effects of investor preferences and other distribution rights be explained across exit scenarios?', '{}'::jsonb, '["Distribution rights are not mapped.","Rights are mapped; scenario outcomes remain incomplete.","Documented rights are reconciled to scenario outcomes, or absence is confirmed."]'::jsonb, null, 'A dated document with a named owner that shows: documented rights are reconciled to scenario outcomes, or absence is confirmed.', 'Legal / CFO', array['Q32']::text[]),
  ('Q39', 'catalogue-2026.11-v1', 'T3', 2, 'EMPLOYEE_EQUITY', 'Employee and management equity', 'Are employee or management participation rights prepared for the proposed transaction?', '{}'::jsonb, '["Plan rights or transaction consequences are unresolved.","Plans are mapped with outstanding treatment questions.","Rights and transaction treatment are documented for the relevant plans."]'::jsonb, null, 'A dated document with a named owner that shows: rights and transaction treatment are documented for the relevant plans.', 'Legal / people / tax', '{}'::text[]),
  ('Q40', 'catalogue-2026.11-v1', 'T4', 2, 'CORE', 'Data room readiness', 'Can the team locate and organise the information needed for review?', '{}'::jsonb, '["Information is dispersed without an index or owners.","An index exists; material gaps lack a complete response.","A permissioned index, owners and gap plan are maintained."]'::jsonb, null, 'A dated document with a named owner that shows: a permissioned index, owners and gap plan are maintained.', 'Project manager', array['Q41']::text[]),
  ('Q41', 'catalogue-2026.11-v1', 'T4', 2, 'CORE', 'Process team', 'Who is accountable for the work and decisions needed during the transaction?', '{}'::jsonb, '["No responsible team is defined.","Key roles exist; capacity or decision rules remain open.","Roles, capacity, decision rules and milestones are agreed."]'::jsonb, null, 'A dated document with a named owner that shows: roles, capacity, decision rules and milestones are agreed.', 'Transaction lead', '{}'::text[]),
  ('Q42', 'catalogue-2026.11-v1', 'T4', 2, 'CORE', 'Known issue resolution', 'How are identified preparation issues being resolved?', '{}'::jsonb, '["Material known issues have no tracked response.","A list exists without complete ownership or milestones.","An active issue log records owners, dependencies and milestones."]'::jsonb, null, 'A dated document with a named owner that shows: an active issue log records owners, dependencies and milestones.', 'Transaction lead', '{}'::text[]),
  ('Q43', 'catalogue-2026.11-v1', 'T4', 1, 'CORE', 'Controlled disclosure', 'Is there an agreed plan for disclosing sensitive information during the process?', '{}'::jsonb, '["No disclosure plan exists.","Basic controls exist with material gaps.","A staged disclosure and access plan is approved."]'::jsonb, null, 'A dated document with a named owner that shows: a staged disclosure and access plan is approved.', 'Legal / transaction lead', array['Q41']::text[]),
  ('Q44', 'catalogue-2026.11-v1', 'S1', 3, 'SEPARATION', 'Sale perimeter', 'Is the exact business perimeter proposed for transfer documented?', '{}'::jsonb, '["Material perimeter boundaries are undefined.","A draft perimeter exists with open allocations.","Entities, assets, people and relevant obligations are mapped."]'::jsonb, null, 'A dated document with a named owner that shows: entities, assets, people and relevant obligations are mapped.', 'Corporate M&A / legal', '{}'::text[]),
  ('Q45', 'catalogue-2026.11-v1', 'T1', 3, 'SEPARATION', 'Standalone financials', 'Can financial performance of the proposed perimeter be shown separately from the remaining group?', '{}'::jsonb, '["Standalone performance is unavailable.","Carve-out figures exist with unresolved allocation adjustments.","Standalone figures and allocation assumptions are reconciled."]'::jsonb, null, 'A dated document with a named owner that shows: standalone figures and allocation assumptions are reconciled.', 'CFO / carve-out finance', array['Q44']::text[]),
  ('Q46', 'catalogue-2026.11-v1', 'O3', 3, 'SEPARATION', 'Shared service continuity', 'Is continuity of essential group-provided services planned for completion?', '{}'::jsonb, '["Essential dependencies lack a viable continuity response.","Dependencies are mapped; some continuity arrangements remain open.","Essential service continuity has an owned and executable plan."]'::jsonb, null, 'A dated document with a named owner that shows: essential service continuity has an owned and executable plan.', 'Separation lead', '{}'::text[]),
  ('Q47', 'catalogue-2026.11-v1', 'O4', 3, 'SEPARATION', 'Systems separation', 'Is separation or continued lawful use of essential group systems executable?', '{}'::jsonb, '["Essential system separation or access is unplanned.","A plan exists with material gaps.","Rights, resources, sequence and service continuity are documented."]'::jsonb, null, 'A dated document with a named owner that shows: rights, resources, sequence and service continuity are documented.', 'IT / legal', '{}'::text[]),
  ('Q48', 'catalogue-2026.11-v1', 'T4', 3, 'SEPARATION', 'Transition execution', 'Are transitional arrangements and their exit plans prepared?', '{}'::jsonb, '["Required transitional arrangements are unplanned.","Draft arrangements exist with material gaps.","Required service arrangements, accountabilities and exit plans are prepared."]'::jsonb, null, 'A dated document with a named owner that shows: required service arrangements, accountabilities and exit plans are prepared.', 'Separation lead / legal', array['Q46', 'Q47']::text[]),
  ('Q49', 'catalogue-2026.11-v1', 'T2', 3, 'SEPARATION', 'Tax separation', 'Have tax consequences of leaving or transferring out of the group been reviewed?', '{}'::jsonb, '["No transaction-specific separation tax review exists.","Initial review exists with material unresolved scope.","Group-related tax consequences and dependencies are documented."]'::jsonb, 'Can cover group tax arrangements, intercompany balances, transfer pricing and restructuring needs. It is not a tax opinion.', 'A dated document with a named owner that shows: group-related tax consequences and dependencies are documented.', 'Tax adviser / group tax', array['Q44']::text[]),
  ('Q50', 'catalogue-2026.11-v1', 'S3', 2, 'PE_CONTEXT', 'Demonstrated value creation', 'Can improvements since the investor’s entry be separated from market movement and explained with evidence?', '{}'::jsonb, '["The improvement narrative is not supported.","Main initiatives are documented without a full performance bridge.","Initiatives and performance effects are reconciled with clear limitations."]'::jsonb, null, 'A dated document with a named owner that shows: initiatives and performance effects are reconciled with clear limitations.', 'Sponsor / CFO', '{}'::text[]),
  ('Q51', 'catalogue-2026.11-v1', 'T3', 3, 'CONVERTIBLE', 'Converting instruments', 'Are outstanding converting instruments mapped to transaction outcomes?', '{}'::jsonb, '["Instruments or conversion consequences are unresolved.","Instruments are mapped with open scenario treatment.","Terms, conversion scenarios and consents are reconciled."]'::jsonb, null, 'A dated document with a named owner that shows: terms, conversion scenarios and consents are reconciled.', 'Legal / CFO', array['Q32']::text[]),
  ('Q52', 'catalogue-2026.11-v1', 'T2', 3, 'CROSS_BORDER', 'Cross-border tax coordination', 'Are tax workstreams across the relevant jurisdictions coordinated?', '{}'::jsonb, '["Relevant jurisdictions lack coordinated coverage.","Advisers are identified; scope or dependencies remain open.","Jurisdictions, responsible advisers and dependencies are documented."]'::jsonb, null, 'A dated document with a named owner that shows: jurisdictions, responsible advisers and dependencies are documented.', 'Lead tax adviser', array['Q26']::text[]),
  ('Q53', 'catalogue-2026.11-v1', 'T3', 3, 'ASSET_TRANSFER', 'Asset transfer execution', 'Are legal transfer requirements for the proposed assets or business mapped?', '{}'::jsonb, '["Material transfer requirements are unassessed.","Requirements are mapped with material gaps.","Assets, required transfers and relevant third-party steps are documented."]'::jsonb, null, 'A dated document with a named owner that shows: assets, required transfers and relevant third-party steps are documented.', 'Legal', '{}'::text[]),
  ('Q54', 'catalogue-2026.11-v1', 'S2', 3, 'PARTIAL', 'Post-transaction governance', 'Are the governance rights after the proposed partial transaction understood and aligned?', '{}'::jsonb, '["Material future governance expectations conflict or are undefined.","A proposal exists with material open points.","Governance expectations and required negotiation points are aligned."]'::jsonb, null, 'A dated document with a named owner that shows: governance expectations and required negotiation points are aligned.', 'Shareholders / legal', '{}'::text[]),
  ('Q55', 'catalogue-2026.11-v1', 'T1', 2, 'PRIMARY_CAPITAL', 'Capital purpose and proceeds', 'Are primary capital needs distinguished from any proceeds paid to selling shareholders?', '{}'::jsonb, '["Company funding needs and seller liquidity are not distinguished.","An initial split exists without a fully linked funding plan.","Primary funding uses and any secondary proceeds are explicitly separated."]'::jsonb, null, 'A dated document with a named owner that shows: primary funding uses and any secondary proceeds are explicitly separated.', 'CFO / shareholders', '{}'::text[])
on conflict (catalogue_version, id) do update set
  domain = excluded.domain, local_weight = excluded.local_weight, route = excluded.route, name = excluded.name,
  question = excluded.question, context_wording = excluded.context_wording, anchors = excluded.anchors, help = excluded.help,
  evidence_request = excluded.evidence_request, suggested_contributor = excluded.suggested_contributor, depends_on = excluded.depends_on;

insert into public.profile_weights (catalogue_version, profile, domain, weight)
values
  ('catalogue-2026.11-v1', 'OWNER', 'S1', 35),
  ('catalogue-2026.11-v1', 'OWNER', 'S2', 35),
  ('catalogue-2026.11-v1', 'OWNER', 'S3', 30),
  ('catalogue-2026.11-v1', 'OWNER', 'O1', 25),
  ('catalogue-2026.11-v1', 'OWNER', 'O2', 20),
  ('catalogue-2026.11-v1', 'OWNER', 'O3', 25),
  ('catalogue-2026.11-v1', 'OWNER', 'O4', 15),
  ('catalogue-2026.11-v1', 'OWNER', 'O5', 15),
  ('catalogue-2026.11-v1', 'OWNER', 'T1', 25),
  ('catalogue-2026.11-v1', 'OWNER', 'T2', 25),
  ('catalogue-2026.11-v1', 'OWNER', 'T3', 25),
  ('catalogue-2026.11-v1', 'OWNER', 'T4', 25),
  ('catalogue-2026.11-v1', 'CORPORATE', 'S1', 30),
  ('catalogue-2026.11-v1', 'CORPORATE', 'S2', 35),
  ('catalogue-2026.11-v1', 'CORPORATE', 'S3', 35),
  ('catalogue-2026.11-v1', 'CORPORATE', 'O1', 25),
  ('catalogue-2026.11-v1', 'CORPORATE', 'O2', 15),
  ('catalogue-2026.11-v1', 'CORPORATE', 'O3', 25),
  ('catalogue-2026.11-v1', 'CORPORATE', 'O4', 25),
  ('catalogue-2026.11-v1', 'CORPORATE', 'O5', 10),
  ('catalogue-2026.11-v1', 'CORPORATE', 'T1', 20),
  ('catalogue-2026.11-v1', 'CORPORATE', 'T2', 25),
  ('catalogue-2026.11-v1', 'CORPORATE', 'T3', 25),
  ('catalogue-2026.11-v1', 'CORPORATE', 'T4', 30),
  ('catalogue-2026.11-v1', 'PE', 'S1', 30),
  ('catalogue-2026.11-v1', 'PE', 'S2', 30),
  ('catalogue-2026.11-v1', 'PE', 'S3', 40),
  ('catalogue-2026.11-v1', 'PE', 'O1', 30),
  ('catalogue-2026.11-v1', 'PE', 'O2', 20),
  ('catalogue-2026.11-v1', 'PE', 'O3', 20),
  ('catalogue-2026.11-v1', 'PE', 'O4', 15),
  ('catalogue-2026.11-v1', 'PE', 'O5', 15),
  ('catalogue-2026.11-v1', 'PE', 'T1', 25),
  ('catalogue-2026.11-v1', 'PE', 'T2', 20),
  ('catalogue-2026.11-v1', 'PE', 'T3', 25),
  ('catalogue-2026.11-v1', 'PE', 'T4', 30),
  ('catalogue-2026.11-v1', 'VC', 'S1', 25),
  ('catalogue-2026.11-v1', 'VC', 'S2', 40),
  ('catalogue-2026.11-v1', 'VC', 'S3', 35),
  ('catalogue-2026.11-v1', 'VC', 'O1', 20),
  ('catalogue-2026.11-v1', 'VC', 'O2', 20),
  ('catalogue-2026.11-v1', 'VC', 'O3', 20),
  ('catalogue-2026.11-v1', 'VC', 'O4', 20),
  ('catalogue-2026.11-v1', 'VC', 'O5', 20),
  ('catalogue-2026.11-v1', 'VC', 'T1', 20),
  ('catalogue-2026.11-v1', 'VC', 'T2', 20),
  ('catalogue-2026.11-v1', 'VC', 'T3', 35),
  ('catalogue-2026.11-v1', 'VC', 'T4', 25)
on conflict (catalogue_version, profile, domain) do update set weight = excluded.weight;

-- ════ 20261110170000_narratives.sql ════
-- Optional generated narrative for a result snapshot (brief section 20).
--
-- Prose is generated by the generate-narrative Edge Function from a stored,
-- validated result snapshot only. The deterministic result is always shown
-- first; a narrative is an addition and never changes scores, routes or risks.
--
-- Clients may only READ their own narratives. Rows are written by the Edge
-- Function with the service role after the output has been validated, so a
-- browser cannot plant text that looks like a generated, validated report.
-- Failed attempts are recorded too (content null) so the per-user daily limit
-- also counts generations that were rejected.

create table public.narratives (
  id             uuid        primary key default gen_random_uuid(),
  assessment_id  uuid        not null references public.assessments (id) on delete cascade,
  snapshot_id    uuid        not null references public.result_snapshots (id) on delete cascade,
  owner_id       uuid        not null,
  lang           text        not null check (lang in ('en', 'de')),
  status         text        not null check (status in ('ok', 'rejected', 'error')),
  content        jsonb       check (content is null or pg_column_size(content) <= 65536),
  model          text        check (char_length(model) <= 80),
  reject_reason  text        check (char_length(reject_reason) <= 200),
  created_at     timestamptz not null default now(),
  constraint narratives_ok_has_content check (status <> 'ok' or content is not null)
);

-- One accepted narrative per snapshot and language; repeat requests are served from here.
create unique index narratives_snapshot_lang_ok on public.narratives (snapshot_id, lang) where status = 'ok';
create index narratives_owner_created_idx on public.narratives (owner_id, created_at desc);
create index narratives_assessment_idx on public.narratives (assessment_id);

alter table public.narratives enable row level security;

create policy "owner reads narratives" on public.narratives for select to authenticated
  using ((select private.owns_assessment(assessment_id)));

revoke all on public.narratives from anon, authenticated;
grant select on public.narratives to authenticated;

-- ════ 20261111120000_seed_catalogue_v1_1.sql ════
-- GENERATED by `npm run gen:catalogue-sql` from src/model/catalogue.ts. Do not edit by hand.
-- catalogue-2026.11-v1.1: 55 registered controls and the four profile weight matrices.

insert into public.question_definitions
  (id, catalogue_version, domain, local_weight, route, name, question, context_wording, anchors, help, evidence_request, suggested_contributor, depends_on)
values
  ('Q01', 'catalogue-2026.11-v1.1', 'S1', 2, 'CORE', 'Transaction objectives', 'How clearly have you defined and prioritised what the proposed transaction should achieve?', '{}'::jsonb, '["We have not yet defined the transaction objectives.","We have outlined our objectives, but their relative priorities remain unresolved.","We have documented and prioritised the objectives for the proposed transaction."]'::jsonb, null, 'A dated document with a named owner that shows: prioritised objectives are documented.', 'Lead shareholder / sponsor', '{}'::text[]),
  ('Q02', 'catalogue-2026.11-v1.1', 'S1', 1, 'CORE', 'Timing and preparation', 'How well does your intended transaction timetable reflect the preparation work and dependencies involved?', '{}'::jsonb, '["We have neither an intended timetable nor a defined preparation sequence.","We have a timetable, but dependencies and preparation steps have not been fully assessed.","We have documented the timetable and the preparation activities and dependencies needed to support it."]'::jsonb, null, 'A dated document with a named owner that shows: a timetable and preparation dependencies are documented.', 'Transaction lead', '{}'::text[]),
  ('Q03', 'catalogue-2026.11-v1.1', 'S2', 3, 'CORE', 'Stakeholder alignment', 'To what extent are the relevant decision-makers aligned on the transaction objectives?', '{}'::jsonb, '["Material disagreements among relevant decision-makers remain unresolved.","We have gathered stakeholder views, but some material differences remain open.","The relevant decision-makers have agreed the objectives through the appropriate governance process."]'::jsonb, null, 'A dated document with a named owner that shows: objectives are agreed through the relevant governance process.', 'Lead shareholder / board', '{}'::text[]),
  ('Q04', 'catalogue-2026.11-v1.1', 'S2', 2, 'CORE', 'Decision authority', 'Have you identified the approvals and decision-making authority required to launch and complete the transaction?', '{}'::jsonb, '["We have not identified the approvals needed to launch and complete the transaction.","We know the relevant approval bodies, but the process or timing is incomplete.","We have documented the approval bodies, authority requirements and decision timetable."]'::jsonb, null, 'A dated document with a named owner that shows: required bodies, authority and decision timetable are documented.', 'Legal / board secretariat', '{}'::text[]),
  ('Q05', 'catalogue-2026.11-v1.1', 'S3', 2, 'CORE', 'Feasible transaction options', 'How thoroughly have feasible transaction options and their trade-offs been evaluated against your objectives?', '{}'::jsonb, '["We have not compared feasible transaction options.","We have identified possible structures, but not fully assessed their trade-offs against our objectives.","We have documented a comparison of feasible options and their respective trade-offs."]'::jsonb, null, 'A dated document with a named owner that shows: feasible options and their trade-offs are documented.', 'Transaction lead / adviser', array['Q01']::text[]),
  ('Q06', 'catalogue-2026.11-v1.1', 'S3', 2, 'CORE', 'Future management role', 'How clearly defined and aligned are the intended post-transaction roles of the current leadership team?', '{}'::jsonb, '["Expectations for the current leadership after the transaction remain unresolved.","We have identified intended roles, but feasibility or succession arrangements remain open.","We have documented and aligned the intended roles and continuity requirements."]'::jsonb, null, 'A dated document with a named owner that shows: roles and continuity requirements are documented and aligned.', 'Management / owners', '{}'::text[]),
  ('Q07', 'catalogue-2026.11-v1.1', 'O1', 3, 'CORE', 'Repeatable business economics', 'How convincingly can you explain the repeatable earnings or underlying growth economics of your business?', '{"growth":"How convincingly can you explain your reconciled cohort or unit economics and the documented path to sustainable economics?"}'::jsonb, '["We cannot yet explain the underlying repeatable earnings or growth-model economics.","We understand the main economic drivers, but the supporting analysis remains incomplete.","We can explain and reconcile repeatable earnings or relevant unit economics, as appropriate to our business model."]'::jsonb, null, 'A dated document with a named owner that shows: repeatable earnings or growth-model unit economics are reconciled and explained.', 'CFO', '{}'::text[]),
  ('Q08', 'catalogue-2026.11-v1.1', 'O1', 2, 'CORE', 'Liquidity planning', 'How effectively does your cash planning identify funding needs and potential responses through the intended transaction period?', '{}'::jsonb, '["We do not have a usable cash forecast covering the intended transaction period.","We have a cash forecast, but funding scenarios and responses are incomplete.","We maintain scenario-based cash forecasts identifying funding needs and credible funded responses."]'::jsonb, null, 'A dated document with a named owner that shows: a maintained scenario forecast identifies needs and funded responses.', 'CFO', '{}'::text[]),
  ('Q09', 'catalogue-2026.11-v1.1', 'O2', 3, 'CORE', 'Customer exposure response', 'How prepared is your business to manage the loss of a material customer?', '{}'::jsonb, '["We have not assessed our exposure to the loss of a material customer or how we would respond.","We have quantified the exposure, but our response plan is incomplete.","We have documented the exposure and a proportionate plan to manage the impact."]'::jsonb, null, 'A dated document with a named owner that shows: exposure and a proportionate response are documented.', 'Commercial lead / CFO', '{}'::text[]),
  ('Q10', 'catalogue-2026.11-v1.1', 'O2', 2, 'CORE', 'Revenue durability', 'What evidence demonstrates that revenue from existing customers is retained or renewed?', '{}'::jsonb, '["We do not monitor customer retention or repeat purchasing.","We have some retention or repeat-order information, but the evidence is incomplete.","We have reconciled historical retention or repeat-purchase evidence and relevant contract terms."]'::jsonb, null, 'A dated document with a named owner that shows: a reconciled history and relevant contract terms explain durability.', 'Commercial lead', '{}'::text[]),
  ('Q11', 'catalogue-2026.11-v1.1', 'O2', 1, 'CORE', 'Critical supply continuity', 'How prepared is your business to maintain delivery if a critical supplier becomes unavailable?', '{}'::jsonb, '["We have no continuity response for material dependencies on critical suppliers.","We have identified alternatives or responses, but they are not fully prepared.","We have documented critical supplier dependencies and proportionate continuity arrangements."]'::jsonb, null, 'A dated document with a named owner that shows: dependencies and proportionate continuity arrangements are documented.', 'Operations', '{}'::text[]),
  ('Q12', 'catalogue-2026.11-v1.1', 'O3', 3, 'CORE', 'Decision continuity', 'Which important decisions would be delayed during a four-week absence of a key decision-maker?', '{"owner_led":"Which important decisions would be delayed if you were unavailable for four weeks?","employed":"Which important decisions would be delayed if a key executive were unavailable for four weeks?"}'::jsonb, '["Many routine decisions would be delayed during a four-week absence.","Some important decisions would still be delayed despite existing delegation.","Important decisions can continue under documented delegated authority."]'::jsonb, null, 'A dated document with a named owner that shows: material decisions continue within documented delegated authority.', 'CEO', '{}'::text[]),
  ('Q13', 'catalogue-2026.11-v1.1', 'O3', 2, 'CORE', 'Critical expertise cover', 'How effectively could essential work continue during the extended absence of a key specialist?', '{}'::jsonb, '["There is no capable cover for essential work performed by key specialists.","Potential cover has been identified, but preparation or knowledge transfer is incomplete.","Capable cover is in place, supported by the necessary knowledge transfer."]'::jsonb, null, 'A dated document with a named owner that shows: capable cover and essential knowledge transfer are in place.', 'Operations / people lead', '{}'::text[]),
  ('Q14', 'catalogue-2026.11-v1.1', 'O3', 2, 'CORE', 'Customer relationship continuity', 'How well are your most important customer relationships maintained beyond any one individual?', '{}'::jsonb, '["Important customer relationships rely on one individual without adequate cover.","Additional contacts exist, but relationship ownership and continuity remain incomplete.","Account ownership and continuity arrangements are established beyond any single individual."]'::jsonb, null, 'A dated document with a named owner that shows: account ownership and relationship continuity are established.', 'Commercial lead', '{}'::text[]),
  ('Q15', 'catalogue-2026.11-v1.1', 'O4', 2, 'CORE', 'Repeatable core processes', 'Could a new employee carry out essential operating processes using your existing documentation?', '{}'::jsonb, '["Essential processes depend on undocumented individual knowledge.","Some essential processes are documented, but coverage remains incomplete.","Essential processes have usable documentation and clearly assigned owners."]'::jsonb, null, 'A dated document with a named owner that shows: essential processes have usable documentation and clear owners.', 'Operations', '{}'::text[]),
  ('Q16', 'catalogue-2026.11-v1.1', 'O4', 2, 'CORE', 'Capacity for growth', 'What would constrain a significant increase in demand, and how prepared are you to address those constraints?', '{}'::jsonb, '["We have not assessed the constraints on a material increase in demand.","We know the main constraints, but do not yet have a complete response.","We have documented capacity constraints and a response supported by appropriate resources."]'::jsonb, 'Use a demand scenario that is relevant for your business. There is no universal growth target.', 'A dated document with a named owner that shows: capacity constraints and a resourced response are documented.', 'Operations / CFO', '{}'::text[]),
  ('Q17', 'catalogue-2026.11-v1.1', 'O4', 2, 'CORE', 'Technology continuity', 'How prepared are your essential systems to recover from a prolonged outage?', '{}'::jsonb, '["We have no usable recovery arrangements for essential system outages.","Recovery arrangements exist, but material gaps remain or testing is insufficient.","Recovery arrangements are documented and have been appropriately tested."]'::jsonb, 'A known serious security issue may need a specialist task. It is not automatically a transaction veto.', 'A dated document with a named owner that shows: recovery arrangements are documented and appropriately tested.', 'IT / security', '{}'::text[]),
  ('Q18', 'catalogue-2026.11-v1.1', 'O4', 2, 'ACQUISITIONS', 'Acquisition integration', 'How effectively are outstanding dependencies from previous acquisitions being managed?', '{}'::jsonb, '["Material acquisition-integration dependencies do not have an accountable plan.","An integration plan exists, but ownership or milestones remain unresolved.","Material dependencies have assigned owners, milestones and monitored progress."]'::jsonb, null, 'A dated document with a named owner that shows: dependencies have owners, milestones and monitored progress.', 'Integration lead', '{}'::text[]),
  ('Q19', 'catalogue-2026.11-v1.1', 'O5', 2, 'CORE', 'Defensible differentiation', 'What evidence supports the reasons customers choose your business over alternatives?', '{}'::jsonb, '["We cannot yet substantiate the reasons customers choose our business.","We have some supporting evidence, but it does not cover the full proposition.","Relevant customer, product or market evidence supports our stated differentiation."]'::jsonb, 'This measures whether the proposition can be supported, not whether a strong moat exists.', 'A dated document with a named owner that shows: relevant customer, product or market evidence supports the proposition.', 'Commercial / product lead', '{}'::text[]),
  ('Q20', 'catalogue-2026.11-v1.1', 'O5', 2, 'CORE', 'Credible development roadmap', 'How ready is your next significant product or service development initiative for execution?', '{}'::jsonb, '["We have not defined the priorities for the next material development step.","Priorities are identified, but there is not yet an executable plan.","We have documented priorities, resources, milestones and success measures."]'::jsonb, null, 'A dated document with a named owner that shows: priorities, resources, milestones and success measures are documented.', 'Product / strategy', '{}'::text[]),
  ('Q21', 'catalogue-2026.11-v1.1', 'T1', 3, 'CORE', 'Financial information package', 'How readily could you provide a consistent, reconciled historical financial package for the proposed transaction perimeter?', '{}'::jsonb, '["Key financial records are incomplete or inconsistent.","Most records exist; material reconciliations remain open.","Required periods and perimeter are reconciled and ready for review."]'::jsonb, null, 'A dated document with a named owner that shows: required periods and perimeter are reconciled and ready for review.', 'CFO', '{}'::text[]),
  ('Q22', 'catalogue-2026.11-v1.1', 'T1', 2, 'CORE', 'Forecast support', 'How clearly can your financial forecasts be traced to documented operating assumptions?', '{}'::jsonb, '["The forecast cannot be traced to operating assumptions.","Main assumptions are documented with gaps.","Operating assumptions and financial consequences are traceable."]'::jsonb, null, 'A dated document with a named owner that shows: operating assumptions and financial consequences are traceable.', 'CFO', array['Q21']::text[]),
  ('Q23', 'catalogue-2026.11-v1.1', 'T1', 2, 'CORE', 'Enterprise to equity bridge', 'How well documented are the cash, debt and other adjustments that could affect the final equity purchase price?', '{}'::jsonb, '["Potential adjustments are not mapped.","A preliminary mapping exists.","Adjustments and supporting balances are documented for review."]'::jsonb, null, 'A dated document with a named owner that shows: adjustments and supporting balances are documented for review.', 'CFO / transaction adviser', array['Q21']::text[]),
  ('Q24', 'catalogue-2026.11-v1.1', 'T1', 3, 'DEBT', 'Financing releases', 'How prepared are you to obtain any required lender consents and security releases?', '{}'::jsonb, '["Required consents or releases are unassessed.","Requirements are identified without a complete execution plan.","Requirements, parties and execution timetable are documented."]'::jsonb, null, 'A dated document with a named owner that shows: requirements, parties and execution timetable are documented.', 'CFO / legal', array['Q23']::text[]),
  ('Q25', 'catalogue-2026.11-v1.1', 'T2', 1, 'CORE', 'Tax workstream', 'Have you engaged a transaction-experienced tax adviser and agreed on the scope of their review?', '{}'::jsonb, '["No adviser or responsible tax workstream is assigned.","An adviser is identified but scope is not agreed.","A responsible adviser and transaction scope are agreed."]'::jsonb, 'A general tax adviser is not the same as transaction-specific analysis.', 'A dated document with a named owner that shows: a responsible adviser and transaction scope are agreed.', 'Sellers / tax lead', '{}'::text[]),
  ('Q26', 'catalogue-2026.11-v1.1', 'T2', 3, 'CORE', 'Seller tax map', 'How clearly documented are the legal forms, ownership chains and tax jurisdictions of the relevant sellers?', '{}'::jsonb, '["Relevant seller entities or jurisdictions are unmapped.","A preliminary seller map exists.","Relevant legal forms, tax jurisdictions and ownership chains are mapped."]'::jsonb, null, 'A dated document with a named owner that shows: relevant legal forms, tax jurisdictions and ownership chains are mapped.', 'Tax adviser', '{}'::text[]),
  ('Q27', 'catalogue-2026.11-v1.1', 'T2', 3, 'CORE', 'Transaction alternatives', 'How thoroughly have the tax consequences of feasible transaction structures been compared?', '{}'::jsonb, '["No transaction-specific comparison exists.","Initial analysis exists with material open assumptions.","A dated transaction-specific comparison records assumptions and open points."]'::jsonb, null, 'A dated document with a named owner that shows: a dated transaction-specific comparison records assumptions and open points.', 'Tax adviser', array['Q26']::text[]),
  ('Q28', 'catalogue-2026.11-v1.1', 'T2', 3, 'CORE', 'Historical tax restrictions', 'Have previous reorganisations or transfers been reviewed for tax restrictions or deadlines relevant to the transaction?', '{}'::jsonb, '["Relevant history has not been reviewed.","History is collected; specialist assessment remains incomplete.","History and any applicable restrictions or deadlines have been reviewed."]'::jsonb, 'Past restructuring leads to a specialist review. It does not by itself mean a tax charge or deadline applies.', 'A dated document with a named owner that shows: history and any applicable restrictions or deadlines have been reviewed.', 'Tax adviser', '{}'::text[]),
  ('Q29', 'catalogue-2026.11-v1.1', 'T2', 2, 'CORE', 'Tax exposure register', 'How comprehensively have material unresolved tax matters been identified and assigned a response?', '{}'::jsonb, '["No reliable register exists.","Known matters are listed without complete assessment.","Material matters, including audit issues, have documented treatment and owners."]'::jsonb, null, 'A dated document with a named owner that shows: material matters, including audit issues, have documented treatment and owners.', 'Tax adviser / CFO', '{}'::text[]),
  ('Q30', 'catalogue-2026.11-v1.1', 'T2', 1, 'CORE', 'Tax information availability', 'How readily could you provide the tax records required for transaction review?', '{}'::jsonb, '["Key records are missing.","Most records exist with unresolved gaps.","Required records are indexed with a response for any gaps."]'::jsonb, null, 'A dated document with a named owner that shows: required records are indexed with a response for any gaps.', 'CFO / tax adviser', '{}'::text[]),
  ('Q31', 'catalogue-2026.11-v1.1', 'T2', 3, 'CONTINGENT', 'Rollover and variable consideration', 'Have the tax implications of any proposed reinvestment, earn-out or deferred consideration been reviewed?', '{}'::jsonb, '["No review exists.","A review is underway with material open points.","A transaction-specific review records assumptions, treatment and dependencies."]'::jsonb, null, 'A dated document with a named owner that shows: a transaction-specific review records assumptions, treatment and dependencies.', 'Sellers’ tax adviser', array['Q27']::text[]),
  ('Q32', 'catalogue-2026.11-v1.1', 'T3', 3, 'CORE', 'Legal ownership', 'How confidently can you reconcile legal ownership of the proposed sale interests with the supporting records?', '{"venture":"How confidently can you reconcile legal ownership of the proposed sale interests with the fully diluted cap table?"}'::jsonb, '["Ownership records or transfer chain have material unresolved gaps.","Records largely reconcile with open points.","Ownership and relevant transfer history reconcile."]'::jsonb, null, 'A dated document with a named owner that shows: ownership and relevant transfer history reconcile.', 'Legal', '{}'::text[]),
  ('Q33', 'catalogue-2026.11-v1.1', 'T3', 3, 'CORE', 'Essential intellectual property', 'Does your company have documented rights to the intellectual property essential to its business?', '{}'::jsonb, '["Essential rights are undocumented or unresolved.","Key rights are documented with open assignment or licence issues.","Essential rights and material licence conditions are documented."]'::jsonb, null, 'A dated document with a named owner that shows: essential rights and material licence conditions are documented.', 'Legal / technology lead', '{}'::text[]),
  ('Q34', 'catalogue-2026.11-v1.1', 'T3', 2, 'CORE', 'Material contract change', 'Have you assessed how the proposed transaction could affect material contracts and any required consents?', '{}'::jsonb, '["Relevant contract consequences are unreviewed.","Key contracts are reviewed; material follow-up remains open.","Consequences and any required consents or responses are documented."]'::jsonb, null, 'A dated document with a named owner that shows: consequences and any required consents or responses are documented.', 'Legal / commercial', '{}'::text[]),
  ('Q35', 'catalogue-2026.11-v1.1', 'T3', 2, 'CORE', 'Disputes and claims', 'How thoroughly have existing or threatened disputes been assessed in the context of the transaction?', '{}'::jsonb, '["No reliable assessment exists.","Known matters are recorded with material gaps.","Material matters and proportionate treatment are documented."]'::jsonb, null, 'A dated document with a named owner that shows: material matters and proportionate treatment are documented.', 'Legal', '{}'::text[]),
  ('Q36', 'catalogue-2026.11-v1.1', 'T3', 2, 'CORE', 'Data protection preparation', 'How effectively have material data protection issues been identified and assigned remediation responsibilities?', '{}'::jsonb, '["Material issues have not been assessed.","An assessment exists with incomplete responses.","Material issues and remediation responsibilities are documented."]'::jsonb, null, 'A dated document with a named owner that shows: material issues and remediation responsibilities are documented.', 'Privacy / legal', '{}'::text[]),
  ('Q37', 'catalogue-2026.11-v1.1', 'T3', 3, 'REGULATED', 'Regulatory continuity', 'Have you assessed the continuity of essential licences and regulatory approvals through the transaction?', '{}'::jsonb, '["Continuity requirements are unreviewed.","Requirements are identified; execution remains incomplete.","Required approvals and continuity steps are documented."]'::jsonb, null, 'A dated document with a named owner that shows: required approvals and continuity steps are documented.', 'Regulatory / legal', '{}'::text[]),
  ('Q38', 'catalogue-2026.11-v1.1', 'T3', 3, 'INVESTOR_RIGHTS', 'Investor distribution rights', 'How clearly can you explain the impact of investor preferences and distribution rights under different exit scenarios?', '{}'::jsonb, '["Distribution rights are not mapped.","Rights are mapped; scenario outcomes remain incomplete.","Documented rights are reconciled to scenario outcomes, or absence is confirmed."]'::jsonb, null, 'A dated document with a named owner that shows: documented rights are reconciled to scenario outcomes, or absence is confirmed.', 'Legal / CFO', array['Q32']::text[]),
  ('Q39', 'catalogue-2026.11-v1.1', 'T3', 2, 'EMPLOYEE_EQUITY', 'Employee and management equity', 'How prepared are employee and management participation arrangements for the proposed transaction?', '{}'::jsonb, '["Plan rights or transaction consequences are unresolved.","Plans are mapped with outstanding treatment questions.","Rights and transaction treatment are documented for the relevant plans."]'::jsonb, null, 'A dated document with a named owner that shows: rights and transaction treatment are documented for the relevant plans.', 'Legal / people / tax', '{}'::text[]),
  ('Q40', 'catalogue-2026.11-v1.1', 'T4', 2, 'CORE', 'Data room readiness', 'How efficiently could your team locate, organise and securely provide information required for due diligence?', '{}'::jsonb, '["Information is dispersed without an index or owners.","An index exists; material gaps lack a complete response.","A permissioned index, owners and gap plan are maintained."]'::jsonb, null, 'A dated document with a named owner that shows: a permissioned index, owners and gap plan are maintained.', 'Project manager', array['Q41']::text[]),
  ('Q41', 'catalogue-2026.11-v1.1', 'T4', 2, 'CORE', 'Process team', 'Are transaction responsibilities, decision-making rules, capacity and milestones clearly assigned?', '{}'::jsonb, '["No responsible team is defined.","Key roles exist; capacity or decision rules remain open.","Roles, capacity, decision rules and milestones are agreed."]'::jsonb, null, 'A dated document with a named owner that shows: roles, capacity, decision rules and milestones are agreed.', 'Transaction lead', '{}'::text[]),
  ('Q42', 'catalogue-2026.11-v1.1', 'T4', 2, 'CORE', 'Known issue resolution', 'How effectively are known transaction preparation issues tracked and resolved?', '{}'::jsonb, '["Material known issues have no tracked response.","A list exists without complete ownership or milestones.","An active issue log records owners, dependencies and milestones."]'::jsonb, null, 'A dated document with a named owner that shows: an active issue log records owners, dependencies and milestones.', 'Transaction lead', '{}'::text[]),
  ('Q43', 'catalogue-2026.11-v1.1', 'T4', 1, 'CORE', 'Controlled disclosure', 'How well prepared is your business to control the staged disclosure of sensitive information during the process?', '{}'::jsonb, '["No disclosure plan exists.","Basic controls exist with material gaps.","A staged disclosure and access plan is approved."]'::jsonb, null, 'A dated document with a named owner that shows: a staged disclosure and access plan is approved.', 'Legal / transaction lead', array['Q41']::text[]),
  ('Q44', 'catalogue-2026.11-v1.1', 'S1', 3, 'SEPARATION', 'Sale perimeter', 'Can you clearly define the entities, assets, employees and obligations included in the proposed transfer?', '{}'::jsonb, '["Material perimeter boundaries are undefined.","A draft perimeter exists with open allocations.","Entities, assets, people and relevant obligations are mapped."]'::jsonb, null, 'A dated document with a named owner that shows: entities, assets, people and relevant obligations are mapped.', 'Corporate M&A / legal', '{}'::text[]),
  ('Q45', 'catalogue-2026.11-v1.1', 'T1', 3, 'SEPARATION', 'Standalone financials', 'How reliably can you demonstrate the standalone financial performance of the business being separated?', '{}'::jsonb, '["Standalone performance is unavailable.","Carve-out figures exist with unresolved allocation adjustments.","Standalone figures and allocation assumptions are reconciled."]'::jsonb, null, 'A dated document with a named owner that shows: standalone figures and allocation assumptions are reconciled.', 'CFO / carve-out finance', array['Q44']::text[]),
  ('Q46', 'catalogue-2026.11-v1.1', 'O3', 3, 'SEPARATION', 'Shared service continuity', 'How prepared is the business to maintain essential group-provided services following separation?', '{}'::jsonb, '["Essential dependencies lack a viable continuity response.","Dependencies are mapped; some continuity arrangements remain open.","Essential service continuity has an owned and executable plan."]'::jsonb, null, 'A dated document with a named owner that shows: essential service continuity has an owned and executable plan.', 'Separation lead', '{}'::text[]),
  ('Q47', 'catalogue-2026.11-v1.1', 'O4', 3, 'SEPARATION', 'Systems separation', 'How executable is your plan to separate essential systems or secure their continued lawful use?', '{}'::jsonb, '["Essential system separation or access is unplanned.","A plan exists with material gaps.","Rights, resources, sequence and service continuity are documented."]'::jsonb, null, 'A dated document with a named owner that shows: rights, resources, sequence and service continuity are documented.', 'IT / legal', '{}'::text[]),
  ('Q48', 'catalogue-2026.11-v1.1', 'T4', 3, 'SEPARATION', 'Transition execution', 'How clearly defined are the transitional arrangements, responsibilities and exit plans required after separation?', '{}'::jsonb, '["Required transitional arrangements are unplanned.","Draft arrangements exist with material gaps.","Required service arrangements, accountabilities and exit plans are prepared."]'::jsonb, null, 'A dated document with a named owner that shows: required service arrangements, accountabilities and exit plans are prepared.', 'Separation lead / legal', array['Q46', 'Q47']::text[]),
  ('Q49', 'catalogue-2026.11-v1.1', 'T2', 3, 'SEPARATION', 'Tax separation', 'Have the tax consequences and dependencies of separating the business from its current group been reviewed?', '{}'::jsonb, '["No transaction-specific separation tax review exists.","Initial review exists with material unresolved scope.","Group-related tax consequences and dependencies are documented."]'::jsonb, 'Can cover group tax arrangements, intercompany balances, transfer pricing and restructuring needs. It is not a tax opinion.', 'A dated document with a named owner that shows: group-related tax consequences and dependencies are documented.', 'Tax adviser / group tax', array['Q44']::text[]),
  ('Q50', 'catalogue-2026.11-v1.1', 'S3', 2, 'PE_CONTEXT', 'Demonstrated value creation', 'How convincingly can you distinguish investor-led value creation from broader market developments using evidence?', '{}'::jsonb, '["The improvement narrative is not supported.","Main initiatives are documented without a full performance bridge.","Initiatives and performance effects are reconciled with clear limitations."]'::jsonb, null, 'A dated document with a named owner that shows: initiatives and performance effects are reconciled with clear limitations.', 'Sponsor / CFO', '{}'::text[]),
  ('Q51', 'catalogue-2026.11-v1.1', 'T3', 3, 'CONVERTIBLE', 'Converting instruments', 'How clearly are outstanding convertible instruments and their consequences under different transaction scenarios documented?', '{}'::jsonb, '["Instruments or conversion consequences are unresolved.","Instruments are mapped with open scenario treatment.","Terms, conversion scenarios and consents are reconciled."]'::jsonb, null, 'A dated document with a named owner that shows: terms, conversion scenarios and consents are reconciled.', 'Legal / CFO', array['Q32']::text[]),
  ('Q52', 'catalogue-2026.11-v1.1', 'T2', 3, 'CROSS_BORDER', 'Cross-border tax coordination', 'How effectively are transaction tax workstreams coordinated across the relevant jurisdictions?', '{}'::jsonb, '["Relevant jurisdictions lack coordinated coverage.","Advisers are identified; scope or dependencies remain open.","Jurisdictions, responsible advisers and dependencies are documented."]'::jsonb, null, 'A dated document with a named owner that shows: jurisdictions, responsible advisers and dependencies are documented.', 'Lead tax adviser', array['Q26']::text[]),
  ('Q53', 'catalogue-2026.11-v1.1', 'T3', 3, 'ASSET_TRANSFER', 'Asset transfer execution', 'Have the legal transfer requirements and third-party steps for the proposed assets or business been mapped?', '{}'::jsonb, '["Material transfer requirements are unassessed.","Requirements are mapped with material gaps.","Assets, required transfers and relevant third-party steps are documented."]'::jsonb, null, 'A dated document with a named owner that shows: assets, required transfers and relevant third-party steps are documented.', 'Legal', '{}'::text[]),
  ('Q54', 'catalogue-2026.11-v1.1', 'S2', 3, 'PARTIAL', 'Post-transaction governance', 'How aligned are the expected governance rights and decision-making arrangements following a partial transaction?', '{}'::jsonb, '["Material future governance expectations conflict or are undefined.","A proposal exists with material open points.","Governance expectations and required negotiation points are aligned."]'::jsonb, null, 'A dated document with a named owner that shows: governance expectations and required negotiation points are aligned.', 'Shareholders / legal', '{}'::text[]),
  ('Q55', 'catalogue-2026.11-v1.1', 'T1', 2, 'PRIMARY_CAPITAL', 'Capital purpose and proceeds', 'How clearly are the company’s primary capital needs distinguished from proceeds paid to selling shareholders?', '{}'::jsonb, '["Company funding needs and seller liquidity are not distinguished.","An initial split exists without a fully linked funding plan.","Primary funding uses and any secondary proceeds are explicitly separated."]'::jsonb, null, 'A dated document with a named owner that shows: primary funding uses and any secondary proceeds are explicitly separated.', 'CFO / shareholders', '{}'::text[])
on conflict (catalogue_version, id) do update set
  domain = excluded.domain, local_weight = excluded.local_weight, route = excluded.route, name = excluded.name,
  question = excluded.question, context_wording = excluded.context_wording, anchors = excluded.anchors, help = excluded.help,
  evidence_request = excluded.evidence_request, suggested_contributor = excluded.suggested_contributor, depends_on = excluded.depends_on;

insert into public.profile_weights (catalogue_version, profile, domain, weight)
values
  ('catalogue-2026.11-v1.1', 'OWNER', 'S1', 35),
  ('catalogue-2026.11-v1.1', 'OWNER', 'S2', 35),
  ('catalogue-2026.11-v1.1', 'OWNER', 'S3', 30),
  ('catalogue-2026.11-v1.1', 'OWNER', 'O1', 25),
  ('catalogue-2026.11-v1.1', 'OWNER', 'O2', 20),
  ('catalogue-2026.11-v1.1', 'OWNER', 'O3', 25),
  ('catalogue-2026.11-v1.1', 'OWNER', 'O4', 15),
  ('catalogue-2026.11-v1.1', 'OWNER', 'O5', 15),
  ('catalogue-2026.11-v1.1', 'OWNER', 'T1', 25),
  ('catalogue-2026.11-v1.1', 'OWNER', 'T2', 25),
  ('catalogue-2026.11-v1.1', 'OWNER', 'T3', 25),
  ('catalogue-2026.11-v1.1', 'OWNER', 'T4', 25),
  ('catalogue-2026.11-v1.1', 'CORPORATE', 'S1', 30),
  ('catalogue-2026.11-v1.1', 'CORPORATE', 'S2', 35),
  ('catalogue-2026.11-v1.1', 'CORPORATE', 'S3', 35),
  ('catalogue-2026.11-v1.1', 'CORPORATE', 'O1', 25),
  ('catalogue-2026.11-v1.1', 'CORPORATE', 'O2', 15),
  ('catalogue-2026.11-v1.1', 'CORPORATE', 'O3', 25),
  ('catalogue-2026.11-v1.1', 'CORPORATE', 'O4', 25),
  ('catalogue-2026.11-v1.1', 'CORPORATE', 'O5', 10),
  ('catalogue-2026.11-v1.1', 'CORPORATE', 'T1', 20),
  ('catalogue-2026.11-v1.1', 'CORPORATE', 'T2', 25),
  ('catalogue-2026.11-v1.1', 'CORPORATE', 'T3', 25),
  ('catalogue-2026.11-v1.1', 'CORPORATE', 'T4', 30),
  ('catalogue-2026.11-v1.1', 'PE', 'S1', 30),
  ('catalogue-2026.11-v1.1', 'PE', 'S2', 30),
  ('catalogue-2026.11-v1.1', 'PE', 'S3', 40),
  ('catalogue-2026.11-v1.1', 'PE', 'O1', 30),
  ('catalogue-2026.11-v1.1', 'PE', 'O2', 20),
  ('catalogue-2026.11-v1.1', 'PE', 'O3', 20),
  ('catalogue-2026.11-v1.1', 'PE', 'O4', 15),
  ('catalogue-2026.11-v1.1', 'PE', 'O5', 15),
  ('catalogue-2026.11-v1.1', 'PE', 'T1', 25),
  ('catalogue-2026.11-v1.1', 'PE', 'T2', 20),
  ('catalogue-2026.11-v1.1', 'PE', 'T3', 25),
  ('catalogue-2026.11-v1.1', 'PE', 'T4', 30),
  ('catalogue-2026.11-v1.1', 'VC', 'S1', 25),
  ('catalogue-2026.11-v1.1', 'VC', 'S2', 40),
  ('catalogue-2026.11-v1.1', 'VC', 'S3', 35),
  ('catalogue-2026.11-v1.1', 'VC', 'O1', 20),
  ('catalogue-2026.11-v1.1', 'VC', 'O2', 20),
  ('catalogue-2026.11-v1.1', 'VC', 'O3', 20),
  ('catalogue-2026.11-v1.1', 'VC', 'O4', 20),
  ('catalogue-2026.11-v1.1', 'VC', 'O5', 20),
  ('catalogue-2026.11-v1.1', 'VC', 'T1', 20),
  ('catalogue-2026.11-v1.1', 'VC', 'T2', 20),
  ('catalogue-2026.11-v1.1', 'VC', 'T3', 35),
  ('catalogue-2026.11-v1.1', 'VC', 'T4', 25)
on conflict (catalogue_version, profile, domain) do update set weight = excluded.weight;

-- Record the migrations, so a later `supabase db push` does not run them again.
do $record$
begin
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
  insert into supabase_migrations.schema_migrations (version, name) values
    ('20261110120000', 'init_schema'),
    ('20261110120100', 'seed_catalogue'),
    ('20261110170000', 'narratives'),
    ('20261111120000', 'seed_catalogue_v1_1')
  on conflict (version) do nothing;
end
$record$;

commit;

-- Make the new tables visible to the API immediately.
notify pgrst, 'reload schema';
