"""Builds supabase/setup-all-in-one.sql from supabase/migrations, for pasting into the
Supabase SQL Editor when the CLI is not used. Run: python3 scripts/build-setup-sql.py"""
import glob
import os

files = sorted(glob.glob('supabase/migrations/*.sql'))
head = """-- ExitIQ database setup in one file, for the Supabase SQL Editor.
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
"""
body = ''.join(f"\n-- ════ {os.path.basename(f)} ════\n" + open(f).read() for f in files)
versions = [os.path.basename(f).split('_', 1) for f in files]
vals = ",\n    ".join(f"('{v}', '{n[:-4]}')" for v, n in versions)
tail = f"""
-- Record the migrations, so a later `supabase db push` does not run them again.
do $record$
begin
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
  insert into supabase_migrations.schema_migrations (version, name) values
    {vals}
  on conflict (version) do nothing;
end
$record$;

commit;

-- Make the new tables visible to the API immediately.
notify pgrst, 'reload schema';
"""
open('supabase/setup-all-in-one.sql', 'w').write(head + body + tail)
print('wrote supabase/setup-all-in-one.sql from', len(files), 'migrations')
