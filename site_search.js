/**
 * Site Search - Hybrid full-text + vector search UI
 * Self-contained vanilla JS module. Injects modal, CSS, and search trigger.
 *
 * Configurable via:
 *   window.REDFOXES_SEARCH_API_URL = 'https://<project>.supabase.co/functions/v1/site-search';
 */

(function () {
  'use strict';

  const API_URL =
    (typeof window !== 'undefined' && window.REDFOXES_SEARCH_API_URL) ||
    'https://ohwiimchzlesczdvasbh.supabase.co/functions/v1/site-search';

  const DEBOUNCE_MS = 200;
  const MAX_RESULTS = 10;

  let modal = null;
  let input = null;
  let resultsContainer = null;
  let activeIndex = -1;
  let debounceTimer = null;
  let abortController = null;

  // ============ CSS Injection ============
  const CSS = `
.search-trigger-btn {
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.25);
  border-radius: 8px;
  padding: 6px 12px;
  color: #fffaf1;
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s, border-color 0.2s;
  backdrop-filter: blur(4px);
}
.search-trigger-btn:hover {
  background: rgba(255,255,255,0.25);
  border-color: rgba(255,255,255,0.4);
}
.search-trigger-inline {
  margin-left: 4px;
  align-self: center;
}
.search-trigger-header-wrap {
  display: flex;
  justify-content: center;
  margin-top: 14px;
}
.search-trigger-btn kbd {
  font-size: 11px;
  padding: 2px 5px;
  border-radius: 4px;
  background: rgba(0,0,0,0.25);
  border: 1px solid rgba(255,255,255,0.15);
  font-family: var(--font-mono, monospace);
}
.search-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
}
.search-modal[hidden] {
  display: none !important;
}
.search-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(3px);
}
.search-container {
  position: relative;
  width: 90%;
  max-width: 640px;
  background: #fff9ef;
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.35);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}
.search-input-wrap {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #e8dcc8;
  gap: 10px;
}
.search-input-wrap::before {
  content: '🔍';
  font-size: 18px;
  opacity: 0.6;
}
.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 16px;
  color: #2a2117;
  font-family: inherit;
}
.search-input::placeholder {
  color: #a09078;
}
.search-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #e8dcc8;
  border-top-color: #c0392b;
  border-radius: 50%;
  animation: ss-spin 0.8s linear infinite;
  display: none;
}
.search-spinner.active {
  display: block;
}
@keyframes ss-spin {
  to { transform: rotate(360deg); }
}
.search-results {
  overflow-y: auto;
  padding: 8px 0;
  min-height: 60px;
}
.search-result {
  display: block;
  padding: 10px 18px;
  text-decoration: none;
  color: inherit;
  border-left: 3px solid transparent;
  transition: background 0.15s;
}
.search-result:hover,
.search-result.active {
  background: #f5e6c8;
  border-left-color: #c0392b;
}
.search-result-title {
  font-weight: 700;
  font-size: 14px;
  color: #2a2117;
  margin-bottom: 2px;
}
.search-result-heading {
  font-size: 12px;
  color: #6f4b30;
  margin-bottom: 4px;
}
.search-result-excerpt {
  font-size: 13px;
  color: #4a3b2a;
  line-height: 1.5;
}
.search-result-excerpt mark {
  background: #ffe8b2;
  color: #2a2117;
  padding: 0 2px;
  border-radius: 3px;
}
.search-empty,
.search-error {
  padding: 24px 18px;
  text-align: center;
  color: #6f4b30;
  font-size: 14px;
}
.search-footer {
  padding: 10px 18px;
  border-top: 1px solid #e8dcc8;
  font-size: 12px;
  color: #a09078;
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
}
.search-footer kbd {
  font-size: 11px;
  padding: 2px 5px;
  border-radius: 4px;
  background: #f0e6d4;
  border: 1px solid #d8cbb5;
  font-family: var(--font-mono, monospace);
}
@media (max-width: 480px) {
  .search-modal {
    padding-top: 0;
    align-items: stretch;
  }
  .search-container {
    width: 100%;
    max-width: 100%;
    border-radius: 0;
    max-height: 100vh;
  }
  .search-footer {
    justify-content: center;
  }
}
`;

  function injectStyles() {
    if (document.getElementById('site-search-styles')) return;
    const style = document.createElement('style');
    style.id = 'site-search-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ============ Trigger Injection ============
  function injectTrigger() {
    if (document.getElementById('site-search-trigger')) return;

    const trigger = document.createElement('button');
    trigger.id = 'site-search-trigger';
    trigger.className = 'search-trigger-btn';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', '搜索');
    trigger.innerHTML = '<span>🔍</span> <span>搜索</span> <kbd>Ctrl K</kbd>';
    trigger.addEventListener('click', openModal);

    // Try to place in a sensible location
    const pageNav = document.querySelector('nav.page-nav');
    const navContainer = pageNav && pageNav.querySelector('.nav-container');

    const targets = [
      document.querySelector('.header'),          // index.html
      navContainer,                               // rules/analysis pages (inside flex container)
      document.querySelector('header'),           // match_review
      document.querySelector('.topbar'),          // sponsor_me.html
      document.querySelector('body'),             // fallback
    ];

    for (const target of targets) {
      if (!target) continue;
      if (target.classList && target.classList.contains('nav-container')) {
        // Inside nav flex container: add spacing class and append
        trigger.classList.add('search-trigger-inline');
        target.appendChild(trigger);
      } else if (target.tagName.toLowerCase() === 'body') {
        target.insertBefore(trigger, target.firstChild);
        trigger.style.position = 'fixed';
        trigger.style.top = '12px';
        trigger.style.right = '12px';
        trigger.style.zIndex = '9998';
      } else if (target.tagName.toLowerCase() === 'header' || target.classList.contains('header')) {
        // Center in header
        const wrap = document.createElement('div');
        wrap.className = 'search-trigger-header-wrap';
        wrap.appendChild(trigger);
        target.appendChild(wrap);
      } else {
        target.appendChild(trigger);
      }
      break;
    }
  }

  // ============ Modal ============
  function createModal() {
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'searchModal';
    modal.className = 'search-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', '搜索');

    modal.innerHTML = `
      <div class="search-backdrop"></div>
      <div class="search-container">
        <div class="search-input-wrap">
          <input type="search" class="search-input" placeholder="搜索内容…" autocomplete="off" autocapitalize="off">
          <div class="search-spinner"></div>
        </div>
        <div class="search-results"></div>
        <div class="search-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
          <span><kbd>Enter</kbd> 打开</span>
          <span><kbd>Esc</kbd> 关闭</span>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    input = modal.querySelector('.search-input');
    resultsContainer = modal.querySelector('.search-results');

    modal.querySelector('.search-backdrop').addEventListener('click', closeModal);
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onInputKeydown);
  }

  function openModal() {
    createModal();
    modal.hidden = false;
    input.focus();
    input.select();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    activeIndex = -1;
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  // ============ Search Logic ============
  function onInput() {
    clearTimeout(debounceTimer);
    const query = input.value.trim();

    if (!query) {
      resultsContainer.innerHTML = '';
      activeIndex = -1;
      setSpinner(false);
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      return;
    }

    setSpinner(true);
    debounceTimer = setTimeout(() => performSearch(query), DEBOUNCE_MS);
  }

  function setSpinner(active) {
    const spinner = modal.querySelector('.search-spinner');
    if (spinner) spinner.classList.toggle('active', active);
  }

  async function performSearch(query) {
    if (abortController) abortController.abort();
    const currentController = new AbortController();
    abortController = currentController;

    try {
      const res = await fetch(
        `${API_URL}?q=${encodeURIComponent(query)}`,
        { signal: currentController.signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderResults(data.results || [], query);
    } catch (err) {
      if (err.name === 'AbortError') return;
      resultsContainer.innerHTML =
        '<div class="search-error">搜索服务暂时不可用，请稍后再试</div>';
    } finally {
      setSpinner(false);
      // Only clear if this request's controller is still the active one.
      // Prevents an older (slower) request from wiping out a newer one.
      if (abortController === currentController) {
        abortController = null;
      }
    }
  }

  function renderResults(results, query) {
    activeIndex = -1;

    if (results.length === 0) {
      resultsContainer.innerHTML = '<div class="search-empty">未找到相关结果</div>';
      return;
    }

    const terms = query.split(/\s+/).filter(Boolean);
    const frag = document.createDocumentFragment();

    results.forEach((r, i) => {
      const a = document.createElement('a');
      a.className = 'search-result';
      a.href = r.url;
      a.dataset.index = String(i);

      const title = document.createElement('div');
      title.className = 'search-result-title';
      title.textContent = r.page_title;

      const heading = document.createElement('div');
      heading.className = 'search-result-heading';
      heading.textContent = r.heading || '';

      const excerpt = document.createElement('div');
      excerpt.className = 'search-result-excerpt';
      excerpt.innerHTML = highlightTerms(escapeHtml(r.excerpt || r.body || ''), terms);

      a.appendChild(title);
      if (r.heading) a.appendChild(heading);
      a.appendChild(excerpt);

      a.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal();
        window.location.href = r.url;
      });

      frag.appendChild(a);
    });

    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(frag);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function highlightTerms(text, terms) {
    if (!terms.length) return text;
    // Sort by length descending so longer phrases match before shorter
    // substrings (e.g. "baseball" before "base").
    const sortedTerms = [...terms].sort((a, b) => b.length - a.length);
    const pattern = new RegExp(
      '(' + sortedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')',
      'gi'
    );
    return text.replace(pattern, '<mark>$1</mark>');
  }

  // ============ Keyboard Navigation ============
  function onInputKeydown(e) {
    const items = resultsContainer.querySelectorAll('.search-result');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      updateActive(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, -1);
      updateActive(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        items[activeIndex].click();
      } else if (items.length > 0) {
        items[0].click();
      }
    } else if (e.key === 'Escape') {
      closeModal();
    }
  }

  function updateActive(items) {
    items.forEach((item, i) => {
      item.classList.toggle('active', i === activeIndex);
      if (i === activeIndex) item.scrollIntoView({ block: 'nearest' });
    });
  }

  // ============ Global Shortcuts ============
  document.addEventListener('keydown', (e) => {
    // Skip shortcuts when user is typing in an input, textarea, or contenteditable
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) {
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openModal();
    }
    if (e.key === 'Escape' && modal && !modal.hidden) {
      e.preventDefault();
      closeModal();
    }
  });

  // ============ Init ============
  function init() {
    injectStyles();
    injectTrigger();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
