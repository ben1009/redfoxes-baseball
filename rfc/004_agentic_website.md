# Agentic Website Design Document

> 让网站对 AI Agent 友好 — 结构化数据、语义标记与机器可读接口
> Last updated: 2026-04-30

---

## 1. Overview

This RFC proposes making the Red Foxes Baseball static website **agent-friendly** — easily discoverable, navigable, and actionable by AI agents (browser-use agents, MCP clients, LLM-powered assistants, search crawlers, etc.) without requiring a backend API server.

The website already has human-facing content (HTML pages), a search backend (RFC 003), and analytics. This layer adds **machine-facing semantics** so that agents can:

1. **Understand site structure** at a glance (via `llms.txt` + JSON manifest)
2. **Extract structured data** from any page (via Schema.org JSON-LD)
3. **Navigate with intent** (via semantic HTML + `data-action` attributes)
4. **Perform actions** (sponsor, search, view video, check rules) with predictable outcomes
5. **Respect boundaries** (password protection, rate limits, CORS)

### Goals

- **Zero backend required** — all additions are static files or HTML markup
- **Human-invisible** — agents get richer context; humans see no UI changes
- **Incremental** — pages can be upgraded one at a time
- **Standard-based** — use existing conventions (`llms.txt`, Schema.org, sitemap.xml)
- **Chinese-aware** — structured data and manifests support bilingual content

### Non-Goals

- Building a REST API (the site remains static)
- Real-time agent collaboration or WebSocket channels
- AI-generated dynamic content
- Replacing human-readable HTML with machine-only formats

---

## 2. Quick Reference: What Changes

| File / Markup | Purpose | Agent Benefit |
|---------------|---------|---------------|
| `llms.txt` | Site overview, page inventory, action catalog | Agent reads one file to understand the entire site |
| `agent-manifest.json` | Machine-readable page graph with URLs, types, and capabilities | Agent can plan navigation without parsing HTML |
| `sitemap.xml` | Standard crawler sitemap with priorities | Search engines and agents discover all pages |
| JSON-LD (`<script type="application/ld+json">`) | Schema.org structured data per page | Agent extracts entities (team, event, video, person) |
| Semantic HTML (`<main>`, `<article>`, `<section>`, `<time>`) | Proper document outline | Agent understands content hierarchy |
| `data-action` attributes | Actionable elements annotated with intent | Agent knows what buttons/links do |
| `AGENTS.md` (this project already has one) | Agent-specific instructions for the codebase | Developer agents understand conventions |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Agent (LLM / Browser-use / MCP)      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ llms.txt    │  │ sitemap.xml │  │ agent-manifest.json │  │
│  │ (overview)  │  │ (discovery) │  │ (page graph)        │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         └─────────────────┴────────────────────┘            │
│                              │                              │
│                              ▼                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Individual HTML Pages                              │    │
│  │  ├── JSON-LD (Schema.org)  → entities               │    │
│  │  ├── Semantic HTML tags    → document outline       │    │
│  │  ├── data-action attrs     → actionable intents     │    │
│  │  └── aria-label / role       → accessibility hints  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Components

### 4.1 `llms.txt` — Site Overview for LLMs

A plain-text file at the site root, following the [llms.txt convention](https://llmstxt.org/). It provides a concise, agent-readable summary of the entire website.

**Location**: `https://ben1009.github.io/redfoxes-baseball/llms.txt`

**Content structure**:
```
# 烈光少棒赤狐队 (Red Foxes Youth Baseball Team)

> A static website for the Red Foxes youth baseball team. Language: Chinese (Simplified).
> Live at: https://ben1009.github.io/redfoxes-baseball/

## Overview

This site contains match reviews, tournament rules, data analysis reports,
and a sponsor page for the Red Foxes youth baseball team.
All content is static HTML with embedded CSS/JS. No login required
except for the match review page (password protected, hint provided).

## Pages

- [首页 / Home](index.html) — Navigation hub with links to all content
- [友谊赛战术复盘](match_review.html) — 7 tactical video clips with analysis (requires password, hint: year coach started baseball)
- [猛虎杯 U10 竞赛章程](u10_rules.html) — Tournament rules and schedule
- [PONY U10 竞赛规则](pony_u10_rules.html) — PONY league rules (Tianjin division)
- [小组赛数据分析](tigercup_groupstage.html) — Group stage match analysis (multi-AI)
- [决赛数据分析](tigercup_finalstage.html) — Final stage match analysis (multi-AI)
- [赞助赤狐](sponsor_me.html) — Sponsor support page with like counter

## Actions Available

- Search: Press Cmd/Ctrl+K on any page to open site-wide search
- Sponsor: Visit sponsor_me.html and click the like button
- View Rules: Navigate to u10_rules.html or pony_u10_rules.html
- View Analysis: Navigate to tigercup_groupstage.html or tigercup_finalstage.html
- Watch Videos: Navigate to match_review.html (password required)

## Key Data

- Team: 烈光少棒赤狐队 (Red Foxes Youth Baseball Team)
- Motto: "友谊第一，比赛第二 · 烈光少棒加油"
- Coach: 张锦新
- Tournaments: 猛虎杯 (Tiger Cup), PONY U10
- Password hint for match_review: "张锦新 哪年开始接触从事棒球运动？"

## Technical Notes

- Static site, no API server
- Search powered by Supabase Edge Function (hybrid full-text + vector)
- Like counter powered by Supabase Edge Function + Redis
- All videos hosted on Bilibili (embedded iframes)
```

### 4.2 `agent-manifest.json` — Machine-Readable Page Graph

A JSON file that agents can parse programmatically to understand site topology and capabilities.

**Location**: `https://ben1009.github.io/redfoxes-baseball/agent-manifest.json`

```json
{
  "$schema": "./agent-manifest.schema.json",
  "site": {
    "name": "烈光少棒赤狐队",
    "name_en": "Red Foxes Youth Baseball Team",
    "url": "https://ben1009.github.io/redfoxes-baseball/",
    "language": "zh-CN",
    "description": "烈光少棒赤狐队官方网站，包含比赛复盘、竞赛规则、数据分析和赞助信息。"
  },
  "pages": [
    {
      "path": "index.html",
      "title": "烈光少棒赤狐队 | 首页",
      "type": "hub",
      "description": "导航首页，链接到所有内容页面",
      "actions": ["navigate"],
      "requires_auth": false
    },
    {
      "path": "match_review.html",
      "title": "烈光 vs 飞雪 友谊赛复盘",
      "type": "review",
      "description": "七个战术片段的详细分析与视频讲解",
      "actions": ["watch_video", "read_analysis"],
      "requires_auth": true,
      "auth_hint": "张锦新 哪年开始接触从事棒球运动？",
      "auth_type": "password_sha256",
      "content_count": 7
    },
    {
      "path": "u10_rules.html",
      "title": "猛虎杯 U10 竞赛章程",
      "type": "rules",
      "description": "北京市第八届猛虎杯春季棒球比赛 U10 投手投打组完整竞赛规程",
      "actions": ["read_rules", "view_schedule"],
      "requires_auth": false,
      "tags": ["U10", "猛虎杯", "投手投打组"]
    },
    {
      "path": "pony_u10_rules.html",
      "title": "PONY U10 竞赛规则",
      "type": "rules",
      "description": "2026年春季PONY小马棒球联赛 U10组（Bronco-10）竞赛规则",
      "actions": ["read_rules", "view_schedule"],
      "requires_auth": false,
      "tags": ["PONY", "U10", "Bronco-10", "天津赛区"]
    },
    {
      "path": "tigercup_groupstage.html",
      "title": "猛虎杯小组赛数据分析",
      "type": "analysis",
      "description": "小组赛球员表现数据深度分析，多AI联合评估",
      "actions": ["read_analysis", "view_data"],
      "requires_auth": false,
      "tags": ["猛虎杯", "小组赛", "数据分析"],
      "ai_sources": ["Kimi", "Gemini", "ChatGPT"]
    },
    {
      "path": "tigercup_finalstage.html",
      "title": "猛虎杯决赛数据分析",
      "type": "analysis",
      "description": "决赛球员表现数据深度分析，多AI联合评估",
      "actions": ["read_analysis", "view_data"],
      "requires_auth": false,
      "tags": ["猛虎杯", "决赛", "数据分析"],
      "ai_sources": ["Kimi", "Gemini", "ChatGPT"]
    },
    {
      "path": "sponsor_me.html",
      "title": "赞助赤狐",
      "type": "sponsor",
      "description": "支持球队训练器材、比赛日补给",
      "actions": ["sponsor", "like"],
      "requires_auth": false
    }
  ],
  "global_actions": [
    {
      "name": "search",
      "trigger": "Cmd+K or Ctrl+K",
      "description": "Open site-wide hybrid search modal"
    },
    {
      "name": "navigate",
      "trigger": "Click nav-card or page-nav link",
      "description": "Navigate between pages"
    }
  ],
  "api_endpoints": [
    {
      "name": "site-search",
      "url": "https://ohwiimchzlesczdvasbh.supabase.co/functions/v1/site-search?q={query}",
      "method": "GET",
      "description": "Hybrid full-text + vector search across all pages"
    },
    {
      "name": "sponsor-likes-count",
      "url": "https://ohwiimchzlesczdvasbh.supabase.co/functions/v1/sponsor-likes/count",
      "method": "GET",
      "description": "Read the global like counter"
    },
    {
      "name": "sponsor-likes-like",
      "url": "https://ohwiimchzlesczdvasbh.supabase.co/functions/v1/sponsor-likes/like",
      "method": "POST",
      "description": "Increment the global like counter"
    },
    {
      "name": "sponsor-likes-unlike",
      "url": "https://ohwiimchzlesczdvasbh.supabase.co/functions/v1/sponsor-likes/unlike",
      "method": "POST",
      "description": "Decrement the global like counter"
    }
  ]
}
```

### 4.3 `sitemap.xml` — Standard Discovery

Standard XML sitemap for search engines and agents.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://ben1009.github.io/redfoxes-baseball/index.html</loc>
    <lastmod>2026-04-30</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://ben1009.github.io/redfoxes-baseball/match_review.html</loc>
    <lastmod>2026-04-30</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://ben1009.github.io/redfoxes-baseball/u10_rules.html</loc>
    <lastmod>2026-04-30</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://ben1009.github.io/redfoxes-baseball/pony_u10_rules.html</loc>
    <lastmod>2026-04-30</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://ben1009.github.io/redfoxes-baseball/tigercup_groupstage.html</loc>
    <lastmod>2026-04-30</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://ben1009.github.io/redfoxes-baseball/tigercup_finalstage.html</loc>
    <lastmod>2026-04-30</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://ben1009.github.io/redfoxes-baseball/sponsor_me.html</loc>
    <lastmod>2026-04-30</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
```

### 4.4 JSON-LD Structured Data per Page

Each page includes a `<script type="application/ld+json">` block describing its primary entity.

**index.html** — SportsTeam:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SportsTeam",
  "name": "烈光少棒赤狐队",
  "alternateName": "Red Foxes Youth Baseball Team",
  "sport": "Baseball",
  "description": "烈光少棒赤狐队官方网站",
  "url": "https://ben1009.github.io/redfoxes-baseball/",
  "slogan": "友谊第一，比赛第二 · 烈光少棒加油",
  "member": {
    "@type": "Person",
    "name": "张锦新",
    "jobTitle": "教练"
  }
}
</script>
```

**match_review.html** — VideoObject + SportsEvent:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "烈光 vs 飞雪 友谊赛复盘",
  "description": "烈光少棒赤狐队与飞雪队的友谊赛战术复盘",
  "performer": [
    { "@type": "SportsTeam", "name": "烈光少棒赤狐队" },
    { "@type": "SportsTeam", "name": "飞雪队" }
  ],
  "subjectOf": {
    "@type": "VideoObject",
    "name": "友谊赛战术复盘视频",
    "description": "七个战术片段的详细分析"
  }
}
</script>
```

**u10_rules.html** — SportsEvent:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "猛虎杯 U10 棒球比赛",
  "description": "北京市第八届猛虎杯春季棒球比赛 U10 投手投打组",
  "sport": "Baseball",
  "eventStatus": "EventScheduled"
}
</script>
```

**pony_u10_rules.html** — SportsEvent:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "2026年春季PONY小马棒球联赛",
  "description": "天津君奥棒球联赛暨PONY小马棒球联赛合作联盟赛 U10组（Bronco-10）竞赛规则",
  "sport": "Baseball",
  "eventStatus": "EventScheduled"
}
</script>
```

**tigercup_groupstage.html / finalstage.html** — Article:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "猛虎杯小组赛数据分析",
  "description": "小组赛球员表现数据深度分析，多AI联合评估",
  "author": [
    { "@type": "Organization", "name": "Kimi" },
    { "@type": "Organization", "name": "Gemini" },
    { "@type": "Organization", "name": "ChatGPT" }
  ],
  "about": {
    "@type": "SportsEvent",
    "name": "猛虎杯棒球比赛"
  }
}
</script>
```

**sponsor_me.html** — DonateAction:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "DonateAction",
  "name": "赞助赤狐",
  "description": "支持烈光少棒赤狐队训练器材与比赛日补给",
  "recipient": {
    "@type": "SportsTeam",
    "name": "烈光少棒赤狐队"
  }
}
</script>
```

### 4.5 Semantic HTML Improvements

Current HTML is mostly `<div>`-based. Upgrade to semantic tags for better document outline:

| Current Pattern | Improved Pattern |
|-----------------|------------------|
| `<div class="header">` | `<header>` |
| `<div class="nav-grid">` | `<nav aria-label="主导航">` |
| `<div class="container">` | `<main>` |
| `<div class="video-card">` | `<article class="video-card">` |
| `<div class="footer">` | `<footer>` |
| `<div class="ai-card">` | `<section class="ai-card">` |
| `<div class="page-nav">` | `<nav aria-label="页面导航">` |

Additional attributes:
- `<time datetime="2026-04">2026年4月</time>` for dates
- `<figure>` + `<figcaption>` for images with captions
- `<details>` + `<summary>` for collapsible sections (rules, analysis)
- `lang="zh-CN"` on all pages (already present)

### 4.6 `data-action` Attributes

Annotate interactive elements with machine-readable intent:

```html
<!-- Navigation -->
<a href="match_review.html" class="nav-card" data-action="navigate" data-target="match_review.html">

<!-- Search -->
<button class="search-trigger" data-action="search" aria-label="搜索">

<!-- Like -->
<button class="like-btn" data-action="like" data-endpoint="sponsor-likes-like">

<!-- Video -->
<div class="video-container" data-action="watch_video" data-video-id="BVxxxxx">

<!-- Rule section -->
<section id="early-end" data-action="read_rules" data-topic="提前结束比赛">
```

This allows agents to:
- Discover what actions are available without parsing CSS classes
- Understand the semantic purpose of a button/link
- Know which API endpoint to call for interactive actions

### 4.7 `robots.txt` Update

GitHub Pages only serves `robots.txt` as an authoritative robots file when it is available at the host root. Because this site is published under `/redfoxes-baseball/`, a project-level `robots.txt` is still useful as documentation for agents that explicitly fetch it, but it should not be treated as reliable crawler enforcement.

```
User-agent: *
Allow: /
Sitemap: https://ben1009.github.io/redfoxes-baseball/sitemap.xml

# Agent-specific hints
User-agent: *
Disallow: /redfoxes-baseball/supabase/
Disallow: /redfoxes-baseball/workers/
Disallow: /redfoxes-baseball/scripts/
Disallow: /redfoxes-baseball/test/
Disallow: /redfoxes-baseball/rfc/
```

---

## 5. Page-by-Page Implementation Plan

### Phase 1: Global Files (One-time)

1. Create `llms.txt` at repo root
2. Create `agent-manifest.json` at repo root
3. Create `agent-manifest.schema.json` at repo root
4. Create `sitemap.xml` at repo root
5. Update `robots.txt`
6. Update `AGENTS.md` with agentic conventions

### Phase 2: index.html (Hub)

1. Add JSON-LD (`SportsTeam`)
2. Wrap content in `<main>`, `<header>`, `<nav>`, `<footer>`
3. Add `data-action` to nav cards
4. Add `data-action` to search trigger

### Phase 3: Content Pages (Per-page)

For each page (`match_review.html`, `u10_rules.html`, `pony_u10_rules.html`, `tigercup_groupstage.html`, `tigercup_finalstage.html`, `sponsor_me.html`):

1. Add JSON-LD appropriate to page type
2. Upgrade `<div>` containers to semantic tags (`<article>`, `<section>`, `<main>`)
3. Add `data-action` attributes to interactive elements
4. Add `<time>` elements where dates appear
5. Ensure all images have `alt` text

---

## 6. Example: Before vs After

### Before (match_review.html excerpt)
```html
<div class="video-card" id="video1">
    <div class="video-title">一垒有人，打者击出滚地球</div>
    <div class="video-container">
        <iframe src="//player.bilibili.com/..." scrolling="no"></iframe>
    </div>
    <div class="video-analysis">
        <p>这是比赛中非常典型的一个局面...</p>
    </div>
</div>
```

### After
```html
<article class="video-card" id="video1" data-action="watch_video" data-video-id="BVxxxxx">
    <h3 class="video-title">一垒有人，打者击出滚地球</h3>
    <figure class="video-container">
        <iframe src="//player.bilibili.com/..." scrolling="no" title="一垒有人滚地球战术片段"></iframe>
    </figure>
    <section class="video-analysis" data-action="read_analysis" data-topic="滚地球处理">
        <p>这是比赛中非常典型的一个局面...</p>
    </section>
</article>
```

Plus JSON-LD in `<head>`:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "一垒有人，打者击出滚地球",
  "description": "友谊赛战术复盘：一垒有人时打者击出滚地球的处理",
  "uploadDate": "2026-04",
  "publisher": { "@type": "SportsTeam", "name": "烈光少棒赤狐队" }
}
</script>
```

---

## 7. Testing Strategy

### 7.1 Automated Tests

Add tests to the existing Jest + Playwright suite:

| Test | What it checks |
|------|---------------|
| `agent.llms_txt.test.js` | `llms.txt` exists, contains site name, lists all pages |
| `agent.manifest.test.js` | `agent-manifest.json` is valid JSON, has all pages, schema reference resolves |
| `agent.sitemap.test.js` | `sitemap.xml` is valid XML, contains all page URLs |
| `agent.jsonld.test.js` | Each page has at least one JSON-LD block or JSON-LD graph with valid `@type` values |
| `agent.semantic.test.js` | Each page has `<main>`, `<header>`, `<footer>` |
| `agent.data_action.test.js` | Interactive elements have `data-action` attributes |

### 7.2 Manual Checklist

- [ ] `llms.txt` renders as plain text when fetched
- [ ] `agent-manifest.json` passes JSON validation
- [ ] Google Rich Results Test passes for each page type
- [ ] W3C HTML validator reports no errors after semantic changes
- [ ] Screen reader (NVDA/VoiceOver) correctly announces page structure

### 7.3 Agent Smoke Test

```bash
# Verify llms.txt is readable
curl -s https://ben1009.github.io/redfoxes-baseball/llms.txt | head -20

# Verify manifest is valid JSON
curl -s https://ben1009.github.io/redfoxes-baseball/agent-manifest.json | jq .

# Verify sitemap is valid XML
curl -s https://ben1009.github.io/redfoxes-baseball/sitemap.xml | xmllint --noout -
```

---

## 8. Security & Privacy Considerations

| Concern | Mitigation |
|---------|-----------|
| Password hash exposure | JSON-LD must NOT include `password_hash`; auth info is only in `llms.txt` (hint) and `agent-manifest.json` (`auth_hint`, `auth_type` only) |
| API endpoint enumeration | `agent-manifest.json` lists public endpoints only; internal Supabase URLs are already public (Edge Functions) |
| Content scraping | Structured data makes scraping easier — but all content is already public HTML; `robots.txt` allows all |
| Prompt injection via `data-action` | `data-action` values are hardcoded in HTML, not user-generated; no dynamic rendering |
| LLM context pollution | `llms.txt` is concise (under 2KB) to avoid wasting agent context windows |

---

## 9. Operational Considerations

### 9.1 Maintenance

| Trigger | Action |
|---------|--------|
| New page added | Update `llms.txt`, `agent-manifest.json`, `sitemap.xml`; update `agent-manifest.schema.json` if new fields are introduced |
| Page title changed | Update `agent-manifest.json`, JSON-LD, `llms.txt` |
| Manifest fields changed | Update `agent-manifest.schema.json` and manifest tests |
| New action added (e.g. new widget) | Add `data-action` to HTML, document in `llms.txt` |
| Content updated | Update `<lastmod>` in `sitemap.xml` |

### 9.2 Deployment

All files are static — deploy with the rest of the site via GitHub Pages:

```bash
# No build step required
# Just ensure these files are in the repo root:
# - llms.txt
# - agent-manifest.json
# - agent-manifest.schema.json
# - sitemap.xml
# - robots.txt
```

---

## 10. Future Improvements

| Idea | Effort | Impact |
|------|--------|--------|
| `llms-full.txt` — complete content in markdown for RAG | Medium | Agents can answer questions without browsing every page |
| Per-page markdown extraction | Low | Better for LLM context ingestion |
| MCP server wrapper | Medium | Expose site as Model Context Protocol server |
| Agent-specific CSS (`@media speech`) | Low | Better for voice/narration agents |
| Web App Manifest (`manifest.json`) | Low | PWA support + agent installability hints |

---

## 11. Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | Initial RFC draft |
