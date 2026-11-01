/* ============================================================
   I-Land1o1 – SMS-Verifizierung (Code-Eingabe)
   Aufruf: /dashboard/verify-sms.html?phone=+491712345678
   ============================================================ */

(function () {
  const cfg = window.ILAND_CONFIG || {};
  const isConfigured =
    typeof cfg.SUPABASE_URL === 'string'
    && cfg.SUPABASE_URL.indexOf('HIER_') !== 0
    && /^https:\/\/.+\..+/.test(cfg.SUPABASE_URL)
    && typeof cfg.SUPABASE_ANON_KEY === 'string'
    && cfg.SUPABASE_ANON_KEY.indexOf('HIER_') !== 0
    && cfg.SUPABASE_ANON_KEY.length > 20;

  const params = new URLSearchParams(window.location.search);
  const phoneNumber = params.get('phone') || '';

  const els = {
    phoneField: document.getElementById('verifyPhone'),
    codeField: document.getElementById('verifyCode'),
    verifyBtn: document.getElementById('verifyBtn'),
    resultBox: document.getElementById('verifyResult'),
    resendLink: document.getElementById('resendLink'),
  };

  let client = null;
  if (isConfigured && window.supabase) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  if (els.phoneField && phoneNumber) {
    els.phoneField.value = phoneNumber;
  }

  function showResult(msg, kind) {
    if (!els.resultBox) return;
    els.resultBox.hidden = false;
    els.resultBox.textContent = msg;
    els.resultBox.className = 'verify-result' + (kind === 'ok' ? ' verify-result--ok' : ' verify-result--error');
  }

  function hideResult() {
    if (!els.resultBox) return;
    els.resultBox.hidden = true;
    els.resultBox.textContent = '';
  }

  async function verifyCode() {
    hideResult();
    const code = els.codeField ? els.codeField.value.trim() : '';
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      showResult('Bitte einen gültigen 6-stelligen Code eingeben.', 'error');
      return;
    }

    if (!client) {
      showResult('Verifizierung ist gerade nicht verfügbar. Bitte später erneut versuchen.', 'error');
      return;
    }

    els.verifyBtn.disabled = true;
    els.verifyBtn.textContent = 'Prüfe…';

    try {
      const { data, error } = await client.functions.invoke('verify-sms-code', {
        body: { phoneNumber, code },
      });

      if (error) throw error;

      if (data && data.success) {
        showResult('✅ Telefonnummer erfolgreich verifiziert! Weiterleitung…', 'ok');
        setTimeout(() => {
          window.location.href = '/dashboard/';
        }, 1500);
      } else {
        showResult(data && data.message ? data.message : 'Verifizierung fehlgeschlagen.', 'error');
        els.verifyBtn.disabled = false;
        els.verifyBtn.textContent = 'Verifizieren ⚓';
      }
    } catch (err) {
      showResult(err && err.message ? err.message : 'Ein Fehler ist aufgetreten.', 'error');
      els.verifyBtn.disabled = false;
      els.verifyBtn.textContent = 'Verifizieren ⚓';
    }
  }

  async function resendCode() {
    hideResult();
    if (!client) {
      showResult('Verifizierung ist gerade nicht verfügbar.', 'error');
      return;
    }

    els.verifyBtn.disabled = true;
    els.verifyBtn.textContent = 'Sende…';

    try {
      const { data, error } = await client.functions.invoke('request-phone-verification', {
        body: { phoneNumber },
      });

      if (error) throw error;

      if (data && data.success) {
        showResult('✅ Neuer Code wurde per SMS versendet.', 'ok');
        els.codeField.value = '';
        els.codeField.focus();
      } else {
        showResult(data && data.message ? data.message : 'Code konnte nicht versendet werden.', 'error');
        els.verifyBtn.disabled = false;
        els.verifyBtn.textContent = 'Verifizieren ⚓';
      }
    } catch (err) {
      showResult(err && err.message ? err.message : 'Ein Fehler ist aufgetreten.', 'error');
      els.verifyBtn.disabled = false;
      els.verifyBtn.textContent = 'Verifizieren ⚓';
    }
  }

  if (els.verifyBtn) {
    els.verifyBtn.addEventListener('click', verifyCode);
  }

  if (els.codeField) {
    els.codeField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') verifyCode();
    });
    // Nur Ziffern erlauben
    els.codeField.addEventListener('input', (e) => {
      els.codeField.value = els.codeField.value.replace(/[^0-9]/g, '');
    });
  }

  if (els.resendLink) {
    els.resendLink.addEventListener('click', (e) => {
      e.preventDefault();
      resendCode();
    });
  }

  // Session prüfen – wenn nicht eingeloggt, zum Login
  if (client) {
    client.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        window.location.href = '/login/index.html?next=' + encodeURIComponent('/dashboard/verify-sms.html?phone=' + encodeURIComponent(phoneNumber));
      } else {
        // Automatisch Verifizierungscode per SMS anfragen, sobald die Seite geladen ist
        resendCode();
      }
    });
  } else {
    // Ohne Client können wir nichts tun, aber zumindest den Resend-Link aktivieren
    if (els.resendLink) {
      els.resendLink.style.display = 'inline';
    }
  }
})();