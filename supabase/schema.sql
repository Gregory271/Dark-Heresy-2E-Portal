create extension if not exists pgcrypto;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  invite_code_hash text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role text not null default 'player' check (role in ('gm', 'player')),
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table if not exists public.characters (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  character_data jsonb not null,
  step integer not null default 0 check (step >= 0),
  origin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists characters_campaign_updated_idx
  on public.characters(campaign_id, updated_at desc);

alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.characters enable row level security;

grant select on public.campaigns to authenticated;
grant select on public.campaign_members to authenticated;
grant select, insert, update, delete on public.characters to authenticated;

create or replace function public.is_campaign_member(requested_campaign uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = requested_campaign and user_id = auth.uid()
  );
$$;

create or replace function public.is_campaign_gm(requested_campaign uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = requested_campaign and user_id = auth.uid() and role = 'gm'
  );
$$;

revoke all on function public.is_campaign_member(uuid) from public;
revoke all on function public.is_campaign_gm(uuid) from public;
grant execute on function public.is_campaign_member(uuid) to authenticated;
grant execute on function public.is_campaign_gm(uuid) to authenticated;

create or replace function public.create_campaign(
  campaign_name text,
  supplied_invite_code text,
  creator_display_name text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_campaign_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(supplied_invite_code) < 8 then raise exception 'Invite code must be at least 8 characters'; end if;
  insert into public.campaigns(name, invite_code_hash, created_by)
  values (campaign_name, extensions.crypt(supplied_invite_code, extensions.gen_salt('bf')), auth.uid())
  returning id into new_campaign_id;
  insert into public.campaign_members(campaign_id, user_id, display_name, role)
  values (new_campaign_id, auth.uid(), creator_display_name, 'gm');
  return new_campaign_id;
end;
$$;

create or replace function public.join_campaign(
  requested_campaign uuid,
  supplied_invite_code text,
  member_display_name text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_hash text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select invite_code_hash into stored_hash from public.campaigns where id = requested_campaign;
  if stored_hash is null or extensions.crypt(supplied_invite_code, stored_hash) <> stored_hash then
    raise exception 'Invalid campaign or invite code';
  end if;
  insert into public.campaign_members(campaign_id, user_id, display_name, role)
  values (requested_campaign, auth.uid(), member_display_name, 'player')
  on conflict (campaign_id, user_id)
  do update set display_name = excluded.display_name;
  return 'joined';
end;
$$;

revoke all on function public.create_campaign(text, text, text) from public;
revoke all on function public.join_campaign(uuid, text, text) from public;
grant execute on function public.create_campaign(text, text, text) to authenticated;
grant execute on function public.join_campaign(uuid, text, text) to authenticated;

-- Keep the setup script safe to run again when restoring or updating a project.
drop policy if exists "Members can see their campaign" on public.campaigns;
drop policy if exists "Members can see campaign membership" on public.campaign_members;
drop policy if exists "Campaign members can read characters" on public.characters;
drop policy if exists "Members can create their own characters" on public.characters;
drop policy if exists "Owners and GMs can update characters" on public.characters;
drop policy if exists "Owners and GMs can delete characters" on public.characters;

create policy "Members can see their campaign"
on public.campaigns for select to authenticated
using (exists (
  select 1 where public.is_campaign_member(id)
));

create policy "Members can see campaign membership"
on public.campaign_members for select to authenticated
using (public.is_campaign_member(campaign_id));

create policy "Campaign members can read characters"
on public.characters for select to authenticated
using (public.is_campaign_member(campaign_id));

create policy "Members can create their own characters"
on public.characters for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_campaign_member(campaign_id)
);

create policy "Owners and GMs can update characters"
on public.characters for update to authenticated
using (
  owner_id = auth.uid()
  or public.is_campaign_gm(campaign_id)
)
with check (
  owner_id = auth.uid()
  or public.is_campaign_gm(campaign_id)
);

create policy "Owners and GMs can delete characters"
on public.characters for delete to authenticated
using (
  owner_id = auth.uid()
  or public.is_campaign_gm(campaign_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'characters'
  ) then
    alter publication supabase_realtime add table public.characters;
  end if;
end;
$$;
