-- Gempire · Conversas e memórias das Diamantes
-- Execute este arquivo no SQL Editor do projeto Supabase.

create extension if not exists pgcrypto;

create table if not exists public.diamond_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  save_id text not null,
  diamond_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists diamond_chat_messages_history_idx
  on public.diamond_chat_messages (user_id, save_id, diamond_id, created_at desc);

create table if not exists public.diamond_chat_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  save_id text not null,
  diamond_id text not null,
  memory_type text not null default 'general',
  content text not null check (char_length(content) between 1 and 1000),
  importance smallint not null default 3 check (importance between 1 and 5),
  source_message_id uuid references public.diamond_chat_messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists diamond_chat_memories_lookup_idx
  on public.diamond_chat_memories (user_id, save_id, diamond_id, importance desc, created_at desc);

alter table public.diamond_chat_messages enable row level security;
alter table public.diamond_chat_memories enable row level security;

drop policy if exists "Players can read their own Diamond messages" on public.diamond_chat_messages;
create policy "Players can read their own Diamond messages"
  on public.diamond_chat_messages for select
  using (auth.uid() = user_id);

-- A escrita de mensagens é feita pela Edge Function após validar o JWT.
-- O cliente do navegador não recebe permissão para forjar mensagens de assistente.

drop policy if exists "Players can delete their own Diamond messages" on public.diamond_chat_messages;
create policy "Players can delete their own Diamond messages"
  on public.diamond_chat_messages for delete
  using (auth.uid() = user_id);

drop policy if exists "Players can read their own Diamond memories" on public.diamond_chat_memories;
create policy "Players can read their own Diamond memories"
  on public.diamond_chat_memories for select
  using (auth.uid() = user_id);

-- Memórias são gravadas exclusivamente pela Edge Function com a identidade autenticada.
-- Não há política de INSERT/UPDATE para o cliente público.
