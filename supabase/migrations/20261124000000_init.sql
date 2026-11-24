-- Vault: Initial Schema, Full-Text Search, Row Level Security, and Default Categories Seed
-- Uses 'simple' text search configuration so Arabic, French, and English tokenize cleanly without stemming issues.

create extension if not exists pgcrypto;

-- 1. Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- 2. Items
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  url text not null,
  title text,
  description text,
  thumbnail_url text,
  source text not null default 'web' check (source in ('youtube', 'instagram', 'facebook', 'x', 'tiktok', 'web')),
  type text not null default 'article' check (type in ('video', 'post', 'article', 'ebook')),
  note text,
  category_id uuid references public.categories(id) on delete set null,
  status text not null default 'todo' check (status in ('todo', 'done')),
  created_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' ||
      coalesce(note, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(url, '')
    )
  ) stored,
  unique (user_id, url)
);

create index if not exists items_search_gin_idx on public.items using gin (search);
create index if not exists items_user_created_idx on public.items (user_id, created_at desc);
create index if not exists items_user_category_idx on public.items (user_id, category_id);

-- 3. Tags
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- 4. Item Tags (junction)
create table if not exists public.item_tags (
  item_id uuid references public.items(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  primary key (item_id, tag_id)
);

-- 5. Row Level Security
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;

-- Categories RLS
create policy "categories_select_own" on public.categories
  for select using (user_id = auth.uid());
create policy "categories_insert_own" on public.categories
  for insert with check (user_id = auth.uid());
create policy "categories_update_own" on public.categories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "categories_delete_own" on public.categories
  for delete using (user_id = auth.uid());

-- Items RLS
create policy "items_select_own" on public.items
  for select using (user_id = auth.uid());
create policy "items_insert_own" on public.items
  for insert with check (
    user_id = auth.uid()
    and (
      category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = category_id and c.user_id = auth.uid()
      )
    )
  );
create policy "items_update_own" on public.items
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (
      category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = category_id and c.user_id = auth.uid()
      )
    )
  );
create policy "items_delete_own" on public.items
  for delete using (user_id = auth.uid());

-- Tags RLS
create policy "tags_select_own" on public.tags
  for select using (user_id = auth.uid());
create policy "tags_insert_own" on public.tags
  for insert with check (user_id = auth.uid());
create policy "tags_update_own" on public.tags
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tags_delete_own" on public.tags
  for delete using (user_id = auth.uid());

-- Item Tags RLS (must own both item and tag)
create policy "item_tags_select_own" on public.item_tags
  for select using (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "item_tags_insert_own" on public.item_tags
  for insert with check (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = auth.uid())
  );
create policy "item_tags_delete_own" on public.item_tags
  for delete using (
    exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  );

-- 6. Seed Default Categories on First Login / Signup
create or replace function public.seed_default_categories_for_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, position)
  values
    (target_user_id, 'Quran', 0),
    (target_user_id, 'AI', 1),
    (target_user_id, 'English', 2),
    (target_user_id, 'Discipline', 3),
    (target_user_id, 'Ahadith Nabawiya', 4)
  on conflict (user_id, name) do nothing;
end;
$$;

create or replace function public.handle_new_user_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_categories_for_user(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seed_categories on auth.users;
create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute function public.handle_new_user_categories();
