-- Harden hybrid search input handling and close anonymous table-read access.

drop policy if exists "Allow anonymous read on documents" on public.documents;
drop policy if exists "Allow anonymous read on document_chunks" on public.document_chunks;

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
    params as (
      select
        case
          when nullif(btrim(query_text), '') is null then null
          else pgroonga_escape(nullif(btrim(query_text), ''))
        end as escaped_query,
        least(greatest(coalesce(match_limit, 10), 1), 50) as safe_match_limit
    ),
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
      cross join params p
      join public.documents d on c.document_id = d.id
      where p.escaped_query is not null
        and (
          c.chunk_text &@~ p.escaped_query
          or c.heading &@~ p.escaped_query
        )
      order by pgroonga_score(c.tableoid, c.ctid) desc
      limit greatest(p.safe_match_limit * 2, 20)
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
      cross join params p
      join public.documents d on c.document_id = d.id
      where c.embedding is not null
        and query_embedding is not null
      order by c.embedding <=> query_embedding
      limit greatest(p.safe_match_limit * 2, 20)
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
  select
    combined.chunk_id,
    combined.document_id,
    combined.page_path,
    combined.page_title,
    combined.section_id,
    combined.heading,
    combined.body,
    combined.rrf_score
  from combined
  cross join params p
  order by combined.rrf_score desc
  limit p.safe_match_limit;
$$;
