-- Answer library for the shop assistant: good general answers are kept and
-- reused when another customer asks the same or a similar question, so the
-- reply is instant and costs no AI call. Personal questions are never stored.

create extension if not exists pg_trgm;

create table if not exists public.chat_answer_cache (
  id uuid primary key default gen_random_uuid(),
  question text not null,                 -- what the customer typed (first time)
  question_key text not null,             -- simplified form used for matching
  answer text not null,
  product_ids uuid[] not null default '{}',
  product_prices numeric(12,2)[] not null default '{}', -- prices when saved; a change makes the answer stale
  quick_replies text[] not null default '{}',
  source text not null default 'ai' check (source in ('ai', 'admin')),
  pinned boolean not null default false,  -- pinned answers never expire
  hits int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz                  -- null = never
);

create unique index if not exists chat_answer_cache_key_idx
  on public.chat_answer_cache (question_key);

create index if not exists chat_answer_cache_key_trgm_idx
  on public.chat_answer_cache using gin (question_key gin_trgm_ops);

-- Closest saved answers to a question, above a similarity threshold, as JSON
-- (the app's rpc() helper reads one value per call).
create or replace function public.match_chat_answer(p_key text, p_threshold real default 0.55)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(m order by m.rank_pinned desc, m.rank_admin desc, m.similarity desc), '[]'::jsonb)
  from (
    select c.id, c.question, c.question_key, c.answer, c.product_ids, c.product_prices,
           c.quick_replies, c.source, c.hits,
           similarity(c.question_key, p_key) as similarity,
           c.pinned as rank_pinned,
           (c.source = 'admin') as rank_admin
    from public.chat_answer_cache c
    where (c.pinned or c.expires_at is null or c.expires_at > now())
      and c.question_key % p_key
      and similarity(c.question_key, p_key) >= p_threshold
    order by c.pinned desc, (c.source = 'admin') desc, similarity(c.question_key, p_key) desc
    limit 3
  ) m
$$;
