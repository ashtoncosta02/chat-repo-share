create table public.voice_audio_cache (
  id text primary key,
  text text not null,
  voice_id text,
  created_at timestamptz not null default now()
);

create index voice_audio_cache_created_at_idx on public.voice_audio_cache (created_at);

alter table public.voice_audio_cache enable row level security;

-- No policies = no access for anon or authenticated users.
-- Only the service role (used by supabaseAdmin) can read/write.
