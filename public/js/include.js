// Client-side fallback loader for the shared header/footer/topbar/modal partials.
//
// server.js normally injects these server-side (no flicker) — but some static
// hosting setups (e.g. Hostinger's static-file layer) serve .html files
// directly from disk for any URL that matches a real file, bypassing our
// Node app entirely except for "/". On those hosts the placeholder divs below
// arrive empty, so this script fetches and fills them in as a safety net.
//
// It is a no-op wherever server-side injection already happened, because in
// that case the placeholder div no longer exists (getElementById returns null).
(function () {
  function inject(placeholderId, url, afterInject) {
    var el = document.getElementById(placeholderId);
    if (!el) return; // already server-injected, or not present on this page
    fetch(url)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        el.outerHTML = html;
        if (afterInject) afterInject();
      })
      .catch(function () { /* fail quietly — rest of the page still works */ });
  }

  function markActiveNav() {
    var here = window.location.pathname;
    document.querySelectorAll('.site-nav a[data-nav]').forEach(function (a) {
      var target = a.getAttribute('data-nav');
      var isHome = target === '/' && here === '/';
      var isMatch = target !== '/' && here === target;
      if (isHome || isMatch) a.classList.add('active');
    });
  }

  inject('site-header', '/partials/header.html', markActiveNav);
  inject('site-footer', '/partials/footer.html');

  // dashboard shell (agency/client/candidate): once the top bar arrives late,
  // re-run initAccountMenu with whichever user we already fetched so the
  // name/avatar aren't left blank
  inject('dash-topbar', '/partials/dash-topbar.html', function () {
    if (window.__ASR_ME && typeof initAccountMenu === 'function') initAccountMenu(window.__ASR_ME);
  });
  inject('dash-account-modal', '/partials/dash-account-modal.html');
})();
