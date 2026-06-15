-- STRIKEPULSE Supabase schema
-- Run this in the Supabase SQL editor after creating the project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  alert_type text not null,
  label text not null,
  contract text,
  enabled boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  symbol text not null,
  signal text,
  contract text,
  outcome text,
  entry_trigger text,
  stop text,
  target text,
  note text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.paper_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  starting_cash numeric(14,2) not null default 25000,
  cash numeric(14,2) not null default 25000,
  realized_pnl numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.paper_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  paper_account_id uuid references public.paper_accounts(id) on delete cascade,
  symbol text not null,
  contract text,
  action text not null check (action in ('BUY', 'SELL', 'CLOSE')),
  quantity integer not null check (quantity > 0),
  entry_premium numeric(12,4),
  exit_premium numeric(12,4),
  pnl numeric(14,2) not null default 0,
  process_grade text,
  process_score integer,
  plan jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.journal_entries add column if not exists client_id text;
alter table public.paper_trades add column if not exists client_id text;

create unique index if not exists journal_entries_user_client_idx on public.journal_entries(user_id, client_id);
create unique index if not exists paper_trades_user_client_idx on public.paper_trades(user_id, client_id);

create table if not exists public.signal_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  symbol text not null,
  direction text,
  confidence integer,
  quality_gate text,
  nine_sig integer,
  strike_score integer,
  reasons jsonb not null default '[]'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.watchlists enable row level security;
alter table public.alerts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.paper_accounts enable row level security;
alter table public.paper_trades enable row level security;
alter table public.signal_history enable row level security;
alter table public.user_preferences enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "watchlists_manage_own" on public.watchlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "alerts_manage_own" on public.alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "journal_entries_manage_own" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "paper_accounts_manage_own" on public.paper_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "paper_trades_manage_own" on public.paper_trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "signal_history_select_own_or_public" on public.signal_history
  for select using (user_id is null or auth.uid() = user_id);
create policy "signal_history_insert_own" on public.signal_history
  for insert with check (user_id is null or auth.uid() = user_id);

create policy "user_preferences_manage_own" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists watchlists_user_symbol_idx on public.watchlists(user_id, symbol);
create index if not exists alerts_user_symbol_idx on public.alerts(user_id, symbol);
create index if not exists journal_entries_user_created_idx on public.journal_entries(user_id, created_at desc);
create index if not exists paper_trades_user_created_idx on public.paper_trades(user_id, created_at desc);
create index if not exists signal_history_symbol_created_idx on public.signal_history(symbol, created_at desc);
