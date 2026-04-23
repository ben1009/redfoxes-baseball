-- Round 5 fix: escape PGroonga query text to prevent syntax errors
-- from unbalanced parentheses or special characters in user input

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
      where c.chunk_text &@~ pgroonga_escape(query_text)
         or c.heading &@~ pgroonga_escape(query_text)
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
