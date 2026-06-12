
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  filters jsonb not null,
  min_yield numeric,
  frequency text not null check (frequency in ('instant','daily')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_notified_at timestamptz
);
create index saved_searches_user_idx on public.saved_searches(user_id);
create index saved_searches_active_freq_idx on public.saved_searches(is_active, frequency);

grant select, insert, update, delete on public.saved_searches to authenticated;
grant all on public.saved_searches to service_role;
alter table public.saved_searches enable row level security;
create policy "saved_searches_owner_all" on public.saved_searches
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  search_id uuid,
  listings_count int not null default 0,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);
create index email_log_user_idx on public.email_log(user_id, created_at desc);

grant select on public.email_log to authenticated;
grant all on public.email_log to service_role;
alter table public.email_log enable row level security;
create policy "email_log_owner_read" on public.email_log
  for select to authenticated using (auth.uid() = user_id);
