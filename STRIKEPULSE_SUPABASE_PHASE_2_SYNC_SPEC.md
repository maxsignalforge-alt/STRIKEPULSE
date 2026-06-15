# STRIKEPULSE Supabase Phase 2 Sync Spec

Status: Architecture only  
Cloud sync flag: must remain `cloudSyncEnabled: false` until implementation is explicitly approved  
Scope: authenticated cloud backup and merge for STRIKEPULSE local user data  
Out of scope: broker execution, broker credentials, real account tracking, screenshot uploads, billing, public sharing

## 1. Objective

Phase 2 should let signed-in users preserve STRIKEPULSE state across devices without breaking the current local-first product.

The goal is not to make Supabase the immediate source of truth. The goal is to add a safe cloud backup layer that can later become bidirectional sync after the schema, Row Level Security policies, and conflict rules are proven.

## 2. Current Local Sources

Current browser storage records:

- `strikepulseJournal`: journal entries
- `strikepulsePracticeAccount`: fake demo-money paper account, open positions, and paper trade history
- `strikepulseSignalMemory`: recent signal snapshots
- `strikepulseSignalLedger`: Proof Engine signal records
- `strikepulseFeedback`: local beta feedback entries
- `strikepulseUserPreferences`: theme and preference state
- `strikepulseAlerts`: local alert configuration
- `strikepulseNotifications`: local notification history

Local storage remains the source of truth until Phase 2 passes upload, pull, and merge testing.

## 3. Current Supabase Coverage

`database.sql` already defines:

- `profiles`
- `watchlists`
- `alerts`
- `journal_entries`
- `paper_accounts`
- `paper_trades`
- `signal_history`
- `user_preferences`

Existing strengths:

- RLS is enabled.
- Most user-owned tables use `auth.uid() = user_id`.
- `journal_entries` and `paper_trades` have `client_id`.
- Unique indexes exist on `(user_id, client_id)` for journal and paper trades.
- Backend backup support already exists for `journal_entries`, `paper_accounts`, and `paper_trades`.

Current gaps:

- Proof Engine ledger is not first-class cloud data.
- Replay examples are not first-class cloud data.
- Signal Graveyard is not first-class cloud data.
- Feedback entries are not first-class cloud data.
- `signal_history` currently allows nullable `user_id` reads, which is not ideal for private Phase 2 sync.
- Current sync is closer to manual backup than full two-way merge.

## 4. Non-Negotiable Safety Rules

- Keep `cloudSyncEnabled: false` until a dedicated implementation step.
- No frontend service-role key.
- No market-data provider keys in frontend files.
- No brokerage credentials.
- No real account balances.
- No payment information.
- No screenshot image upload in Phase 2.
- No AI upload of journal notes by default.
- Do not delete local data after upload.
- Do not overwrite local data from cloud until merge rules are tested.
- Every synced user row must be scoped by `auth.uid()`.

## 5. Recommended Phase 2 Data Model

### Existing Tables To Keep

#### `journal_entries`

Purpose: saved journal notes and outcomes.

Required additions:

- `signal_id text`
- `updated_at timestamptz default now()`
- `client_updated_at timestamptz`
- `deleted_at timestamptz`
- `redaction_version text`

Conflict key:

- `(user_id, client_id)`

Notes:

- Sync redacted note text only.
- Keep raw unredacted local notes out of cloud.

#### `paper_accounts`

Purpose: fake demo-money paper account summary.

Required additions:

- `client_updated_at timestamptz`

Conflict key:

- `(user_id)`

Notes:

- This is simulated balance only.
- UI must continue saying paper money / no broker execution.

#### `paper_trades`

Purpose: fake demo-money paper trade events.

Required additions:

- `signal_id text`
- `position_id text`
- `opened_at timestamptz`
- `closed_at timestamptz`
- `client_updated_at timestamptz`
- `deleted_at timestamptz`

Conflict key:

- `(user_id, client_id)`

Notes:

- Treat BUY and CLOSE as events.
- Do not represent these as real brokerage fills.

#### `user_preferences`

Purpose: user theme, privacy mode, feature preferences.

Required additions:

- `client_updated_at timestamptz`

Conflict key:

- `(user_id)`

### New Tables To Add

#### `proof_signal_ledger`

Purpose: cloud backup for Proof Engine signal outcome records.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `signal_id text not null`
- `symbol text not null`
- `signal_date timestamptz`
- `eagle_score integer`
- `lightning_status text`
- `lightning_in_probability integer`
- `lightning_out_probability integer`
- `system_verdict text`
- `user_verdict text`
- `paper_trade_outcome text`
- `win_loss text`
- `percent_move numeric(10,4)`
- `max_favorable_excursion numeric(10,4)`
- `max_adverse_excursion numeric(10,4)`
- `market_weather text`
- `market_regime text`
- `failure_reason text`
- `snapshot jsonb not null default '{}'::jsonb`
- `linked_journal_ids text[] not null default '{}'`
- `linked_paper_trade_ids text[] not null default '{}'`
- `linked_replay_ids text[] not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `client_updated_at timestamptz`
- `deleted_at timestamptz`

Conflict key:

- `(user_id, signal_id)`

RLS:

- select/insert/update/delete only when `auth.uid() = user_id`

#### `signal_replay_examples`

Purpose: saved replay references and educational examples.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `client_id text not null`
- `signal_id text`
- `symbol text not null`
- `replay_type text`
- `predicted_outcome text`
- `actual_outcome text`
- `score integer`
- `timeline jsonb not null default '[]'::jsonb`
- `market_conditions jsonb not null default '{}'::jsonb`
- `indicators jsonb not null default '[]'::jsonb`
- `lesson text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `client_updated_at timestamptz`
- `deleted_at timestamptz`

Conflict key:

- `(user_id, client_id)`

RLS:

- select/insert/update/delete only when `auth.uid() = user_id`

#### `signal_graveyard`

Purpose: failed/rejected signal records and prevention lessons.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `client_id text not null`
- `signal_id text`
- `symbol text not null`
- `failure_type text`
- `warning_signs text[] not null default '{}'`
- `failure_reason text`
- `prevention_rule text`
- `market_weather text`
- `lightning_out_probability integer`
- `quality_score integer`
- `snapshot jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `client_updated_at timestamptz`
- `deleted_at timestamptz`

Conflict key:

- `(user_id, client_id)`

RLS:

- select/insert/update/delete only when `auth.uid() = user_id`

#### `feedback_entries`

Purpose: local beta feedback, optionally synced after redaction.

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `client_id text not null`
- `type text`
- `area text`
- `severity text`
- `message text not null`
- `symbol text`
- `redaction_version text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `client_updated_at timestamptz`
- `deleted_at timestamptz`

Conflict key:

- `(user_id, client_id)`

RLS:

- select/insert/update/delete only when `auth.uid() = user_id`

Notes:

- Sync only redacted feedback.
- Do not sync empty feedback.
- Do not sync personal info patterns.

## 6. RLS Policy Standard

Every private Phase 2 table should follow this pattern:

```sql
alter table public.table_name enable row level security;

create policy "table_name_select_own" on public.table_name
  for select using (auth.uid() = user_id);

create policy "table_name_insert_own" on public.table_name
  for insert with check (auth.uid() = user_id);

create policy "table_name_update_own" on public.table_name
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "table_name_delete_own" on public.table_name
  for delete using (auth.uid() = user_id);
```

Avoid public-readable signal records in Phase 2. Public/shared signal cards can be planned later with a separate explicit sharing table.

## 7. Sync Direction Strategy

### Gate 1: Read-Only Cloud Pull

Purpose: prove auth, RLS, and empty-state reads.

Behavior:

- User signs in.
- App asks backend for cloud state.
- Backend returns records owned by `auth.uid()`.
- App displays cloud availability but does not merge or overwrite local data.

Pass criteria:

- Signed-in user can read own empty tables.
- Signed-out user gets local fallback.
- Another user cannot read the first user's records.

### Gate 2: One-Way Upload

Purpose: back up local data without changing local behavior.

Upload:

- Journal entries
- Paper account
- Paper trades
- User preferences

Do not upload yet:

- Proof ledger
- Replay examples
- Graveyard
- Feedback

Pass criteria:

- Repeated uploads do not create duplicates.
- Local data remains unchanged after upload.
- Sync failure returns to local fallback.

### Gate 3: Expanded Upload

Purpose: back up the STRIKEPULSE learning layer.

Upload:

- Proof ledger
- Replay examples
- Signal Graveyard
- Redacted feedback

Pass criteria:

- Records are idempotent by `(user_id, signal_id)` or `(user_id, client_id)`.
- Educational-only labels remain visible.
- No screenshot images are uploaded.

### Gate 4: Two-Way Merge

Purpose: support multiple devices.

Merge rules:

- Match records by `client_id` or `signal_id`.
- Prefer highest `client_updated_at`.
- If timestamps are missing, preserve local and add cloud as a separate record.
- Never delete local records from a cloud response unless `deleted_at` exists and deletion sync has been explicitly enabled.
- If conflict cannot be resolved, keep both records and mark local conflict metadata.

## 8. Backend API Recommendation

Keep backend-mediated sync.

Recommended endpoints:

- `GET /api/user/state`
- `POST /api/user/state`
- `POST /api/user/state/pull-preview`
- `POST /api/user/state/upload`
- `POST /api/user/state/merge-preview`

Why backend-mediated:

- Keeps service role key server-side only.
- Centralizes validation and redaction.
- Allows rate limiting.
- Gives one place to enforce payload size limits.
- Avoids putting database implementation details in the browser.

## 9. Payload Shape

Recommended upload body:

```json
{
  "clientVersion": "0.1.0-prototype",
  "syncMode": "upload-only",
  "deviceId": "local-device-id",
  "clientGeneratedAt": "2026-06-11T00:00:00.000Z",
  "journalEntries": [],
  "paperAccount": {},
  "paperTrades": [],
  "userPreferences": {},
  "signalLedger": [],
  "signalReplays": [],
  "signalGraveyard": [],
  "feedbackEntries": []
}
```

Validation:

- Reject payloads above configured size.
- Reject unknown `syncMode`.
- Reject unauthenticated sync.
- Reject records without `client_id` or `signal_id`.
- Redact notes and feedback before insert/upsert.

## 10. Security Concerns

Highest risks:

- Service role key leakage.
- Overly broad RLS policies.
- Sensitive journal/feedback content synced without redaction.
- Publicly readable signal records that accidentally include user context.
- Sync endpoint used for spam payloads.

Mitigations:

- Keep service role in backend env only.
- Add strict RLS owner policies.
- Add backend payload validation.
- Add payload size limits.
- Add rate limits per user.
- Keep screenshots local.
- Keep `cloudSyncEnabled` off until all tests pass.

## 11. Testing Plan

### Auth/RLS Tests

- Signed-out sync returns local fallback.
- Signed-in user can read own rows.
- User A cannot read User B rows.
- Insert with wrong `user_id` is rejected.
- Update with wrong `user_id` is rejected.

### Idempotency Tests

- Upload same journal twice: one row.
- Upload same paper trade twice: one row.
- Upload same proof signal twice: one row.
- Upload same feedback twice: one row.

### Fallback Tests

- Supabase unavailable: local app still works.
- Backend unavailable: local app still works.
- Expired session: sync pauses and local app still works.
- RLS failure: sync reports failure and keeps local source intact.

### Privacy Tests

- Journal email is redacted before cloud write.
- Feedback phone number is redacted before cloud write.
- No brokerage credentials are accepted.
- No screenshot bytes are present in payload.

## 12. Implementation Order

1. Create SQL migration for missing Phase 2 tables.
2. Tighten `signal_history` Phase 2 policy or leave it unused for private sync.
3. Add backend validators and mappers for preferences only.
4. Add read-only cloud pull preview.
5. Add upload-only journal/paper sync with current backend behavior.
6. Add upload-only preferences.
7. Add upload-only Proof Engine ledger.
8. Add upload-only Replay, Graveyard, and redacted Feedback.
9. Add merge preview.
10. Only after all tests pass, consider setting `cloudSyncEnabled: true` for development.

## 13. Decision

Do not enable Phase 2 yet.

The next safest concrete task is a SQL migration draft named something like:

`supabase_phase_2_schema.sql`

That draft should add the missing Proof, Replay, Graveyard, and Feedback tables plus RLS policies, without modifying application behavior.
