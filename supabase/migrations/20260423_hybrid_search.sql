-- Hybrid Search Schema
-- Full-text + vector search for static site content

-- Extensions
create extension if not exists vector;
create extension if not exists pgroonga;

-- ============================================
-- Documents (page-level)
-- ============================================
create table if not exists public.documents (
  id          bigint generated always as identity primary key,
  url         text not null,
  page_path   text not null unique,
  title       text not null,
  category    text,
  tags        text[],
  summary     text,
  content     text not null,
  updated_at  timestamptz not null default now()
);

-- Page-level PGroonga index for Chinese-aware full-text search
create index if not exists documents_pgroonga_idx on public.documents
  using pgroonga (title, summary, content);

-- ============================================
-- Document Chunks (section-level with embeddings)
-- ============================================
create table if not exists public.document_chunks (
  id          bigint generated always as identity primary key,
  document_id bigint not null references public.documents(id) on delete cascade,
  chunk_index int not null,
  section_id  text not null,
  heading     text,
  chunk_text  text not null,
  embedding   vector(1536),
  token_count int,
  updated_at  timestamptz not null default now(),
  unique(document_id, chunk_index)
);

-- Chunk-level PGroonga index
create index if not exists chunks_pgroonga_idx on public.document_chunks
  using pgroonga (heading, chunk_text);

-- HNSW index for vector similarity (better performance/recall than IVFFlat)
create index if not exists chunks_vector_idx on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- Composite index for document lookups
create index if not exists chunks_document_idx on public.document_chunks(document_id);

-- Fallback GIN index for native Postgres FTS (if pgroonga unavailable)
create index if not exists chunks_fts_fallback_idx on public.document_chunks
  using gin(to_tsvector('simple', coalesce(heading, '') || ' ' || chunk_text));

-- ============================================
-- Hybrid Search Function (RRF)
-- ============================================
create or replace function public.hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_limit int default 10
)
returns table (
  chunk_id bigint,
  document_id bigint,
  page_path text,
  page_title text,
  section_id text,
  heading text,
  body text,
  rrf_score double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with
    fts_results as (
      select
        c.id as chunk_id,
        d.id as document_id,
        d.page_path,
        d.title as page_title,
        c.section_id,
        c.heading,
        c.chunk_text as body,
        row_number() over (order by pgroonga_score(c.tableoid, c.ctid) desc, c.id asc) as fts_rank
      from public.document_chunks c
      join public.documents d on c.document_id = d.id
      where c.chunk_text &@~ query_text
         or c.heading &@~ query_text
      order by pgroonga_score(c.tableoid, c.ctid) desc
      limit greatest(match_limit * 2, 20)
    ),
    vec_results as (
      select
        c.id as chunk_id,
        d.id as document_id,
        d.page_path,
        d.title as page_title,
        c.section_id,
        c.heading,
        c.chunk_text as body,
        row_number() over (order by c.embedding <=> query_embedding, c.id asc) as vec_rank
      from public.document_chunks c
      join public.documents d on c.document_id = d.id
      where c.embedding is not null
        and query_embedding is not null
      order by c.embedding <=> query_embedding
      limit greatest(match_limit * 2, 20)
    ),
    combined as (
      select
        coalesce(f.chunk_id, v.chunk_id) as chunk_id,
        coalesce(f.document_id, v.document_id) as document_id,
        coalesce(f.page_path, v.page_path) as page_path,
        coalesce(f.page_title, v.page_title) as page_title,
        coalesce(f.section_id, v.section_id) as section_id,
        coalesce(f.heading, v.heading) as heading,
        coalesce(f.body, v.body) as body,
        coalesce(1.0 / (60 + f.fts_rank), 0.0) +
        coalesce(1.0 / (60 + v.vec_rank), 0.0) as rrf_score
      from fts_results f
      full outer join vec_results v on f.chunk_id = v.chunk_id
    )
  select combined.chunk_id, combined.document_id, combined.page_path,
         combined.page_title, combined.section_id, combined.heading,
         combined.body, combined.rrf_score
  from combined
  order by combined.rrf_score desc
  limit match_limit;
$$;

-- ============================================
-- Access Control
-- ============================================
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

revoke all on table public.documents from anon;
revoke all on table public.documents from authenticated;
grant select, insert, update, delete on table public.documents to service_role;

revoke all on table public.document_chunks from anon;
revoke all on table public.document_chunks from authenticated;
grant select, insert, update, delete on table public.document_chunks to service_role;

revoke execute on function public.hybrid_search(text, vector(1536), int) from public;
revoke execute on function public.hybrid_search(text, vector(1536), int) from anon;
revoke execute on function public.hybrid_search(text, vector(1536), int) from authenticated;
grant execute on function public.hybrid_search(text, vector(1536), int) to service_role;

-- ============================================
-- Optional RLS Policies (defense-in-depth)
-- ============================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Allow anonymous read on documents'
      and tablename = 'documents'
      and schemaname = 'public'
  ) then
    create policy "Allow anonymous read on documents"
      on public.documents for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where policyname = 'Allow anonymous read on document_chunks'
      and tablename = 'document_chunks'
      and schemaname = 'public'
  ) then
    create policy "Allow anonymous read on document_chunks"
      on public.document_chunks for select to anon using (true);
  end if;
end $$;

-- ============================================
-- Auto-update updated_at trigger
-- ============================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

drop trigger if exists document_chunks_updated_at on public.document_chunks;
create trigger document_chunks_updated_at
  before update on public.document_chunks
  for each row execute function public.set_updated_at();
