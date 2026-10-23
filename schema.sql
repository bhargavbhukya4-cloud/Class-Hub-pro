-- CLASS HUB on Supabase. Paste this whole file into Supabase -> SQL Editor -> Run (once).

create table if not exists public.docs (
  path text primary key,
  parent text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists docs_parent_idx on public.docs (parent);
create index if not exists docs_class_idx on public.docs (split_part(path, '/', 2));
alter table public.docs replica identity full;
alter table public.docs enable row level security;

-- Who is who in a class (reads the class member records)
create or replace function public.is_member(cid text) returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from docs where path = 'classes/' || cid || '/mem/' || auth.uid()::text and data->>'s' = 'approved') $fn$;
create or replace function public.is_admin(cid text) returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from docs where path = 'classes/' || cid || '/mem/' || auth.uid()::text and data->>'s' = 'approved' and data->>'r' in ('owner','admin')) $fn$;
create or replace function public.is_owner(cid text) returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from docs where path = 'classes/' || cid || '/mem/' || auth.uid()::text and data->>'s' = 'approved' and data->>'r' = 'owner') $fn$;
create or replace function public.is_creator(cid text) returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from docs where path = 'classes/' || cid and data->>'own' = auth.uid()::text) $fn$;

-- READ rules
create or replace function public.r_ok(p text, d jsonb) returns boolean language plpgsql stable security definer set search_path = public as $fn$
declare k text = split_part(p,'/',1); c text = split_part(p,'/',2); t text = split_part(p,'/',3); u text = auth.uid()::text;
begin
  if u is null then return false; end if;
  if k = 'data' then return split_part(p,'/',3) = u;
  elsif k = 'c' then return is_member(c);
  elsif k = 'classes' then
    if t = '' then return true;
    elsif t = 'mem' then return split_part(p,'/',4) = u or is_member(c);
    else return false; end if;
  end if;
  return false;
end $fn$;

-- WRITE rules (ins = true when creating a new record)
create or replace function public.w_ok(p text, d jsonb, ins boolean) returns boolean language plpgsql stable security definer set search_path = public as $fn$
declare k text = split_part(p,'/',1); c text = split_part(p,'/',2); t text = split_part(p,'/',3); u text = auth.uid()::text;
begin
  if u is null then return false; end if;
  if k = 'data' then return split_part(p,'/',3) = u;
  elsif k = 'c' then return is_member(c) and (t not in ('cfg','asg','ann') or is_admin(c));
  elsif k = 'classes' then
    if t = '' then
      if ins then return d->>'own' = u; else return is_admin(c); end if;
    elsif t = 'mem' then
      if ins then
        return split_part(p,'/',4) = u and ((d->>'s' = 'pending' and d->>'r' = 'member')
               or (d->>'s' = 'approved' and d->>'r' = 'owner' and is_creator(c)));
      else
        return is_owner(c) or (is_admin(c) and d->>'r' <> 'owner');
      end if;
    end if;
  end if;
  return false;
end $fn$;

-- DELETE rules
create or replace function public.d_ok(p text, d jsonb) returns boolean language plpgsql stable security definer set search_path = public as $fn$
declare k text = split_part(p,'/',1); c text = split_part(p,'/',2); t text = split_part(p,'/',3); u text = auth.uid()::text;
begin
  if u is null then return false; end if;
  if k = 'data' then return split_part(p,'/',3) = u;
  elsif k = 'c' then return is_member(c) and (t not in ('cfg','asg','ann') or is_admin(c));
  elsif k = 'classes' and t = 'mem' then
    return (split_part(p,'/',4) = u and d->>'s' <> 'blocked' and d->>'r' <> 'owner')
        or (is_admin(c) and d->>'r' <> 'owner');
  end if;
  return false;
end $fn$;

drop policy if exists docs_select on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;
create policy docs_select on public.docs for select to authenticated using (r_ok(path, data));
create policy docs_insert on public.docs for insert to authenticated with check (w_ok(path, data, true));
create policy docs_update on public.docs for update to authenticated using (w_ok(path, data, false)) with check (w_ok(path, data, false));
create policy docs_delete on public.docs for delete to authenticated using (d_ok(path, data));

-- Live updates
alter publication supabase_realtime add table public.docs;

-- FILE STORAGE (PDFs, photos, videos): private bucket, only approved members of a class can use that class's folder
insert into storage.buckets (id, name, public, file_size_limit) values ('class-files', 'class-files', false, 20971520) on conflict (id) do nothing;
drop policy if exists cf_select on storage.objects;
drop policy if exists cf_insert on storage.objects;
drop policy if exists cf_delete on storage.objects;
create policy cf_select on storage.objects for select to authenticated using (bucket_id = 'class-files' and public.is_member(split_part(name, '/', 1)));
create policy cf_insert on storage.objects for insert to authenticated with check (bucket_id = 'class-files' and public.is_member(split_part(name, '/', 1)));
create policy cf_delete on storage.objects for delete to authenticated using (bucket_id = 'class-files' and public.is_member(split_part(name, '/', 1)));
