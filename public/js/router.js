// Lightweight SPA-style router for the public marketing site (index, about,
// services, employers, job-seekers, blogs, contact, jobs, job/:id, register,
// login). Clicking an internal link fetches the target page, swaps the
// content in place (no full browser reload), and shows a loading bar +
// body-level loading overlay while it does. Back/forward buttons work too.
//
// It intentionally does NOT touch the Agency/Client/Candidate dashboards —
// those are only ever entered via a real redirect after login, and their
// inline scripts share global variable names (JOBS, CANDIDATES, etc.) that
// aren't safe to re-run through a soft-navigation swap.
(function () {
  if (document.querySelector('.app')) return; // dashboard shell — skip SPA routing here

  // ---------- top progress bar ----------
  var bar = document.createElement('div');
  bar.id = 'route-progress';
  document.body.appendChild(bar);
  var barHideTimer = null;
  function startBar() {
    clearTimeout(barHideTimer);
    bar.style.transition = 'none';
    bar.style.width = '0%';
    bar.style.opacity = '1';
    void bar.offsetWidth; // force reflow so the width transition below actually animates
    bar.style.transition = 'width 0.5s ease-out';
    bar.style.width = '75%';
  }
  function finishBar() {
    bar.style.transition = 'width 0.2s ease-out';
    bar.style.width = '100%';
    barHideTimer = setTimeout(function () {
      bar.style.transition = 'opacity 0.25s ease-out';
      bar.style.opacity = '0';
    }, 180);
  }

  // ---------- body-level loading overlay ----------
  var overlay = document.createElement('div');
  overlay.id = 'route-loading-overlay';
  overlay.innerHTML = '<div class="route-spinner"></div>';
  document.body.appendChild(overlay);
  function showOverlay() { overlay.classList.add('show'); }
  function hideOverlay() { overlay.classList.remove('show'); }

  // ---------- helpers ----------
  function isRoutableLink(a) {
    if (!a || !a.href) return false;
    if (a.hasAttribute('download')) return false;
    if (a.target && a.target !== '' && a.target !== '_self') return false;
    var url;
    try { url = new URL(a.href, window.location.href); } catch (e) { return false; }
    if (url.origin !== window.location.origin) return false;
    if (url.pathname.startsWith('/api/')) return false;
    if (url.pathname.startsWith('/agency') || url.pathname.startsWith('/client') || url.pathname.startsWith('/candidate')) return false;
    // a real file (.css, .png, .pdf, old-style .html link, etc.) — let the browser handle it normally
    if (/\.[a-z0-9]{2,5}$/i.test(url.pathname)) return false;
    return true;
  }

  // track which external scripts (api.js, dashboard.js, ...) are already on
  // the page, so a page reached only via soft-navigation (e.g. index.html
  // never loads api.js, but job-seekers.html needs it) still gets them loaded
  var loadedScriptSrcs = {};
  document.querySelectorAll('script[src]').forEach(function (s) {
    try { loadedScriptSrcs[new URL(s.src, window.location.href).pathname] = true; } catch (e) {}
  });

  function loadExternalScript(src) {
    return new Promise(function (resolve) {
      var el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = resolve; // don't let a failed script hang navigation
      document.body.appendChild(el);
    });
  }

  async function runPageScript(container) {
    var scripts = Array.prototype.slice.call(container.querySelectorAll('script'));
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      if (s.src) {
        var srcPath;
        try { srcPath = new URL(s.src, window.location.href).pathname; } catch (e) { continue; }
        // router.js/include.js already did their one-time setup on the very
        // first load — re-running them would add duplicate click/scroll listeners
        if (srcPath === '/js/router.js' || srcPath === '/js/include.js') continue;
        if (loadedScriptSrcs[srcPath]) continue;
        loadedScriptSrcs[srcPath] = true;
        await loadExternalScript(s.src);
      } else {
        try {
          // runs in its own function scope, so this page's top-level let/const
          // never collides with a previously-visited page's declarations
          (new Function(s.textContent))();
        } catch (e) {
          console.error('router: page script error', e);
        }
      }
    }
  }

  function markActiveNav() {
    var here = window.location.pathname;
    document.querySelectorAll('.site-nav a[data-nav]').forEach(function (a) {
      var target = a.getAttribute('data-nav');
      var isHome = target === '/' && here === '/';
      var isMatch = target !== '/' && here === target;
      a.classList.toggle('active', isHome || isMatch);
    });
  }

  async function navigate(url, isPopstate) {
    startBar();
    showOverlay();
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('bad response ' + res.status);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      document.title = doc.title || document.title;
      document.body.innerHTML = doc.body.innerHTML;
      // the swap above removed our own bar/overlay nodes — re-attach them
      document.body.appendChild(bar);
      document.body.appendChild(overlay);
      if (!isPopstate) window.history.pushState({ asrRoute: true }, '', url);
      const targetUrl = new URL(url, window.location.href);
      const anchorEl = targetUrl.hash ? document.getElementById(targetUrl.hash.slice(1)) : null;
      if (anchorEl) anchorEl.scrollIntoView(); else window.scrollTo(0, 0);
      await runPageScript(document.body);
      markActiveNav();
      finishBar();
    } catch (e) {
      // robust fallback: do a real navigation instead of leaving the page stuck
      window.location.href = url;
      return;
    }
    hideOverlay();
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a');
    if (!isRoutableLink(a)) return;
    var url = new URL(a.href, window.location.href);
    var samePath = url.pathname + url.search === window.location.pathname + window.location.search;
    if (samePath) {
      if (!url.hash) e.preventDefault(); // identical link — nothing to do
      return; // same-page anchor (has a hash) — let the browser scroll natively
    }
    e.preventDefault();
    navigate(a.href, false);
  });

  window.addEventListener('popstate', function () {
    navigate(window.location.href, true);
  });
})();
