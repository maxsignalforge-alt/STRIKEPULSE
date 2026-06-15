-- STRIKEPULSE Supabase Phase 2 schema draft
-- Review only. Do not run until Phase 2 cloud sync implementation is approved.
--
-- Scope:
-- - Adds cloud-sync tables for Proof Engine, Replay, Signal Graveyard, and Feedback.
-- - Adds optional sync metadata columns to existing journal/paper/preference tables.
-- - Keeps all new Phase 2 records private to auth.uid().
--
-- Out of scope:
-- - Broker integration
-- - Trading execution
-- - Real account tracking
-- - Screenshot/image storage
-- - Public signal sharing

create extension if not exists pgcrypto;

-- Existing table hardening for Phase 2 sync metadata.
alter table public.journal_entries add column if not exists signal_id text;
alter table public.journal_entries add column if not exists updated_at timestamptz not null default now();
alter table public.journal_entries add column if not exists client_updated_at timestamptz;
alter table public.journal_entries add column if not exists deleted_at timestamptz;
alter table public.journal_entries add column if not exists redaction_version text;

alter table public.paper_accounts add column if not exists client_updated_at timestamptz;

alter table public.paper_trades add column if not exists signal_id text;
alter table public.paper_trades add column if not exists position_id text;
alter table public.paper_trades add column if not exists opened_at timestamptz;
alter table public.paper_trades add column if not exists closed_at timestamptz;
alter table public.paper_trades add column if not exists client_updated_at timestamptz;
alter table public.paper_trades add column if not exists deleted_at timestamptz;

alter table public.user_preferences add column if not exists client_updated_at timestamptz;

-- Proof Engine ledger: educational signal outcome records, not broker-verified performance.
create table if not exists public.proof_signal_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_id text not null,
  symbol text not null,
  signal_date timestamptz,
  eagle_score integer check (eagle_score is null or (eagle_score >= 0 and eagle_score <= 100)),
  confidence_band text,
  lightning_status text,
  lightning_in_probability integer check (lightning_in_probability is null or (lightning_in_probability >= 0 and lightning_in_probability <= 100)),
  lightning_out_probability integer check (lightning_out_probability is null or (lightning_out_probability >= 0 and lightning_out_probability <= 100)),
  system_verdict text,
  user_verdict text,
  paper_trade_outcome text,
  win_loss text check (win_loss is null or win_loss in ('Win', 'Loss', 'Breakeven', 'Skipped')),
  percent_move numeric(10,4),
  max_favorable_excursion numeric(10,4),
  max_adverse_excursion numeric(10,4),
  market_weather text,
  market_regime text,
  failure_reason text,
  snapshot jsonb not null default '{}'::jsonb,
  outcome jsonb not null default '{}'::jsonb,
  graveyard jsonb not null default '{}'::jsonb,
  linked_journal_ids text[] not null default '{}',
  linked_paper_trade_ids text[] not null default '{}',
  linked_replay_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_updated_at timestamptz,
  deleted_at timestamptz,
  unique (user_id, signal_id)
);

-- Signal Replay examples: candle-by-candle educational replay references.
create table if not exists public.signal_replay_examples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  signal_id text,
  symbol text not null,
  replay_type text,
  predicted_outcome text,
  actual_outcome text,
  score integer check (score is null or (score >= 0 and score <= 100)),
  timeline jsonb not null default '[]'::jsonb,
  market_conditions jsonb not null default '{}'::jsonb,
  indicators jsonb not null default '[]'::jsonb,
  lesson text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_updated_at timestamptz,
  deleted_at timestamptz,
  unique (user_id, client_id)
);

-- Signal Graveyard: failed/rejected signal lessons and warning signs.
create table if not exists public.signal_graveyard (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  signal_id text,
  symbol text not null,
  failure_type text,
  warning_signs text[] not null default '{}',
  failure_reason text,
  prevention_rule text,
  market_weather text,
  lightning_out_probability integer check (lightning_out_probability is null or (lightning_out_probability >= 0 and lightning_out_probability <= 100)),
  quality_score integer check (quality_score is null or (quality_score >= 0 and quality_score <= 100)),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_updated_at timestamptz,
  deleted_at timestamptz,
  unique (user_id, client_id)
);

-- Feedback entries: redacted beta feedback only.
create table if not exists public.feedback_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  type text,
  area text,
  severity text check (severity is null or severity in ('Low', 'Medium', 'High')),
  message text not null,
  symbol text,
  redaction_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_updated_at timestamptz,
  deleted_at timestamptz,
  unique (user_id, client_id)
);

alter table public.proof_signal_ledger enable row level security;
alter table public.signal_replay_examples enable row level security;
alter table public.signal_graveyard enable row level security;
alter table public.feedback_entries enable row level security;

-- Owner-only RLS policies. These names are explicit to avoid broad public signal access.
create policy "proof_signal_ledger_select_own" on public.proof_signal_ledger
  for select using (auth.uid() = user_id);
create policy "proof_signal_ledger_insert_own" on public.proof_signal_ledger
  for insert with check (auth.uid() = user_id);
create policy "proof_signal_ledger_update_own" on public.proof_signal_ledger
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "proof_signal_ledger_delete_own" on public.proof_signal_ledger
  for delete using (auth.uid() = user_id);

create policy "signal_replay_examples_select_own" on public.signal_replay_examples
  for select using (auth.uid() = user_id);
create policy "signal_replay_examples_insert_own" on public.signal_replay_examples
  for insert with check (auth.uid() = user_id);
create policy "signal_replay_examples_update_own" on public.signal_replay_examples
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "signal_replay_examples_delete_own" on public.signal_replay_examples
  for delete using (auth.uid() = user_id);

create policy "signal_graveyard_select_own" on public.signal_graveyard
  for select using (auth.uid() = user_id);
create policy "signal_graveyard_insert_own" on public.signal_graveyard
  for insert with check (auth.uid() = user_id);
create policy "signal_graveyard_update_own" on public.signal_graveyard
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "signal_graveyard_delete_own" on public.signal_graveyard
  for delete using (auth.uid() = user_id);

create policy "feedback_entries_select_own" on public.feedback_entries
  for select using (auth.uid() = user_id);
create policy "feedback_entries_insert_own" on public.feedback_entries
  for insert with check (auth.uid() = user_id);
create policy "feedback_entries_update_own" on public.feedback_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "feedback_entries_delete_own" on public.feedback_entries
  for delete using (auth.uid() = user_id);

create index if not exists proof_signal_ledger_user_created_idx on public.proof_signal_ledger(user_id, created_at desc);
create index if not exists proof_signal_ledger_user_symbol_idx on public.proof_signal_ledger(user_id, symbol);
create index if not exists proof_signal_ledger_user_signal_idx on public.proof_signal_ledger(user_id, signal_id);

create index if not exists signal_replay_examples_user_created_idx on public.signal_replay_examples(user_id, created_at desc);
create index if not exists signal_replay_examples_user_symbol_idx on public.signal_replay_examples(user_id, symbol);
create index if not exists signal_replay_examples_user_signal_idx on public.signal_replay_examples(user_id, signal_id);

create index if not exists signal_graveyard_user_created_idx on public.signal_graveyard(user_id, created_at desc);
create index if not exists signal_graveyard_user_symbol_idx on public.signal_graveyard(user_id, symbol);
create index if not exists signal_graveyard_user_signal_idx on public.signal_graveyard(user_id, signal_id);

create index if not exists feedback_entries_user_created_idx on public.feedback_entries(user_id, created_at desc);
create index if not exists feedback_entries_user_area_idx on public.feedback_entries(user_id, area);

create index if not exists journal_entries_user_signal_idx on public.journal_entries(user_id, signal_id);
create index if not exists paper_trades_user_signal_idx on public.paper_trades(user_id, signal_id);

-- Phase 2 note:
-- Existing public.signal_history policies allow nullable user_id records. Keep that table unused for
-- private Phase 2 sync unless/until public signal sharing is deliberately designed.
