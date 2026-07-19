/* ============================================================
   backup-reminder.js — In-app toast for progress backup reminder.
   Appears bottom-right (same container as download-panel.js).
   Auto-dismisses after 10 s. Shows a CTA that scrolls to the
   backup section in Mi Perfil.
   ============================================================ */

const AppBackupReminder = (() => {

  const _LAST_EXPORT_KEY = 'pe_last_export';
  const _DAYS_THRESHOLD  = 30;

  function _daysSinceLast() {
    const ts = parseInt(localStorage.getItem(_LAST_EXPORT_KEY) || '0', 10);
    if (!ts) return Infinity;
    return (Date.now() - ts) / (1000 * 60 * 60 * 24);
  }

  /** Returns true when the user should be nudged to export. */
  function shouldShow() {
    return _daysSinceLast() >= _DAYS_THRESHOLD;
  }

  function _getContainer() {
    let c = document.getElementById('pe-download-panels');
    if (!c) {
      c = document.createElement('div');
      c.id = 'pe-download-panels';
      Object.assign(c.style, {
        position: 'fixed', bottom: '1.25rem', right: '1.25rem',
        display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem',
        zIndex: '9999', pointerEvents: 'none',
      });
      document.body.appendChild(c);
    }
    return c;
  }

  /**
   * Show the backup reminder toast.
   * @param {Function} [onCtaClick] — called when the user taps the CTA button.
   */
  function show(onCtaClick) {
    const t = (typeof AppLang !== 'undefined')
      ? function (k, fb) { var v = AppLang.t(k); return v !== k ? v : (fb || k); }
      : function (k, fb) { return fb || k; };

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: '240px',
      background: 'var(--clr-surface, #fff)',
      color: 'var(--clr-text, #1e293b)',
      border: '1px solid var(--clr-border, #e2e8f0)',
      borderRadius: '0.6rem',
      padding: '0.75rem 1rem',
      fontSize: '0.8rem',
      boxShadow: '0 4px 16px rgba(0,0,0,.12)',
      opacity: '0',
      transform: 'translateY(6px)',
      transition: 'opacity .3s, transform .3s',
      pointerEvents: 'auto',
    });
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');

    // Title row (title + close button)
    const titleRow = document.createElement('div');
    Object.assign(titleRow.style, {
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-between', gap: '6px', marginBottom: '6px',
    });

    const title = document.createElement('div');
    Object.assign(title.style, { fontWeight: '700', lineHeight: '1.3', flex: '1' });
    title.textContent = t('backup_reminder_title', '💾 Exporta tu progreso');
    titleRow.appendChild(title);

    const closeBtn = document.createElement('button');
    Object.assign(closeBtn.style, {
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: '0.9rem', lineHeight: '1', padding: '0',
      color: 'var(--clr-text-muted, #64748b)', flexShrink: '0',
    });
    closeBtn.setAttribute('aria-label', t('backup_reminder_close', 'Cerrar'));
    closeBtn.textContent = '✕';
    titleRow.appendChild(closeBtn);
    panel.appendChild(titleRow);

    // Body text
    const body = document.createElement('div');
    Object.assign(body.style, {
      color: 'var(--clr-text-muted, #64748b)',
      lineHeight: '1.4',
      marginBottom: '10px',
    });
    body.textContent = t('backup_reminder_body', 'Han pasado más de 30 días. Exporta tu progreso desde Mi Perfil.');
    panel.appendChild(body);

    // CTA button
    const cta = document.createElement('button');
    Object.assign(cta.style, {
      display: 'inline-block',
      background: 'var(--clr-primary, #2563eb)',
      color: '#fff',
      border: 'none',
      borderRadius: '999px',
      padding: '6px 14px',
      fontSize: '0.78rem',
      fontWeight: '700',
      fontFamily: 'inherit',
      cursor: 'pointer',
      transition: 'opacity .15s',
    });
    cta.textContent = t('backup_reminder_cta', 'Exportar →');
    panel.appendChild(cta);

    _getContainer().appendChild(panel);

    // Animate in
    requestAnimationFrame(function () {
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
    });

    function _hide() {
      clearTimeout(autoTimer);
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(6px)';
      setTimeout(function () { if (panel.parentNode) panel.parentNode.removeChild(panel); }, 350);
    }

    var autoTimer = setTimeout(_hide, 10000);

    closeBtn.addEventListener('click', _hide);
    cta.addEventListener('click', function () {
      _hide();
      if (onCtaClick) onCtaClick();
    });
  }

  return { shouldShow, show };
})();
