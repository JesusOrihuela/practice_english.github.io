/* ============================================================
   network-status.js — Offline / reconnect indicator
   Slides in from the top when the user loses connectivity;
   briefly shows "restored" on reconnect then hides itself.
   No dependencies. Self-initialising IIFE.
   ============================================================ */
(function () {
  let _banner    = null;
  let _hideTimer = null;

  function _ensureBanner() {
    if (_banner) return _banner;
    _banner = document.createElement('div');
    _banner.setAttribute('role', 'status');
    _banner.setAttribute('aria-live', 'assertive'); // interrupts — losing connection is urgent
    _banner.setAttribute('aria-atomic', 'true');
    Object.assign(_banner.style, {
      position:   'fixed',
      top:        '0',
      left:       '0',
      right:      '0',
      zIndex:     '10001',
      padding:    '0.55rem 1rem',
      textAlign:  'center',
      fontSize:   '0.84rem',
      fontWeight: '600',
      fontFamily: 'inherit',
      color:      '#fff',
      transition: 'transform 0.25s ease, opacity 0.25s ease',
      transform:  'translateY(-100%)',
      opacity:    '0',
    });
    // Append after body is available
    (document.body || document.documentElement).appendChild(_banner);
    return _banner;
  }

  function _show(text, bg) {
    clearTimeout(_hideTimer);
    const b = _ensureBanner();
    b.textContent       = text;
    b.style.background  = bg;
    // Force a reflow so the transition plays even if the element was just created
    b.getBoundingClientRect();
    b.style.transform = 'translateY(0)';
    b.style.opacity   = '1';
  }

  function _hide(delayMs) {
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(() => {
      if (!_banner) return;
      _banner.style.transform = 'translateY(-100%)';
      _banner.style.opacity   = '0';
    }, delayMs);
  }

  function _onOffline() {
    _show('📶 No connection — progress saved locally', '#b91c1c');
  }

  function _onOnline() {
    _show('✓ Connection restored', '#15803d');
    _hide(3000);
  }

  window.addEventListener('offline', _onOffline);
  window.addEventListener('online',  _onOnline);

  // Show immediately if already offline when the script runs
  if (!navigator.onLine) {
    if (document.body) {
      _onOffline();
    } else {
      document.addEventListener('DOMContentLoaded', _onOffline, { once: true });
    }
  }
}());
