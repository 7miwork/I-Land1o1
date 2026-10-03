/* ============================================================
   I-Land1o1 – Auth (Supabase)
   Login / Registrierung / Session / Logout für das Dashboard.
   Läuft VOR dashboard.js und startet es via initDashboard().
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

  const overlay = document.getElementById('authOverlay');
  const form = document.getElementById('authForm');
  const emailInput = document.getElementById('authEmail');
  const pwInput = document.getElementById('authPassword');
  const nameInput = document.getElementById('authName');
  const nameWrap = document.getElementById('authNameWrap');
  const errBox = document.getElementById('authError');
  const btnLogin = document.getElementById('tabLogin');
  const btnSignup = document.getElementById('tabSignup');
  const btnSubmit = document.getElementById('authSubmit');
  const btnLogout = document.getElementById('btnLogout');
  const whoBox = document.getElementById('authWho');

  let mode = 'login';
  let client = null;

  if (isConfigured && window.supabase) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  function showError(msg) { errBox.textContent = msg; errBox.hidden = !msg; }

  function setMode(m) {
    mode = m;
    btnLogin.classList.toggle('active', m === 'login');
    btnSignup.classList.toggle('active', m === 'signup');
    btnSubmit.textContent = m === 'login' ? 'Anmelden ⚓' : 'Registrieren 🏴‍☠️';
    if (nameWrap) nameWrap.hidden = m !== 'signup';
    showError('');
  }

  function showAuth() {
    overlay.hidden = false;
    document.getElementById('appContent').hidden = true;
    if (btnLogout) btnLogout.hidden = true;
  }

  function showApp(user) {
    overlay.hidden = true;
    document.getElementById('appContent').hidden = false;
    if (whoBox) whoBox.textContent = user.email;
    // Piratenname aus profiles laden (Trigger legt die Zeile bei Signup an)
    client
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.display_name && whoBox) whoBox.textContent = '🏴‍☠️ ' + data.display_name;
      });
    if (btnLogout) {
      btnLogout.hidden = false;
      btnLogout.onclick = async () => {
        await client.auth.signOut();
        showAuth();
      };
    }
    if (!window.ilandDashboardInited && typeof window.initDashboard === 'function') {
      window.ilandDashboardInited = true;
      window.initDashboard(user.id, client);
    }
    if (typeof window.initBilling === 'function') window.initBilling(client);
  }

  async function boot() {
    if (!client) {
      // Supabase noch nicht konfiguriert -> Dashboard offen zeigen (Fallback)
      overlay.hidden = true;
      document.getElementById('appContent').hidden = false;
      if (!window.ilandDashboardInited && typeof window.initDashboard === 'function') {
        window.ilandDashboardInited = true;
        window.initDashboard('anon');
      }
      return;
    }
    const { data } = await client.auth.getSession();
    if (data.session && data.session.user) showApp(data.session.user);
    else showAuth();
  }

  btnLogin.addEventListener('click', () => setMode('login'));
  btnSignup.addEventListener('click', () => setMode('signup'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    const email = emailInput.value.trim();
    const password = pwInput.value;
    btnSubmit.disabled = true;
    try {
      if (mode === 'signup') {
        const pirateName = nameInput ? nameInput.value.trim() : '';
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: pirateName ? { display_name: pirateName } : {} },
        });
        if (error) throw error;
        if (data.session) {
          showApp(data.session.user); // E-Mail-Bestätigung deaktiviert
        } else {
          showError('Fast geschafft! Bitte bestätige die E-Mail, die wir dir geschickt haben, und melde dich dann an. 📬');
          setMode('login');
        }
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showApp(data.session.user);
      }
    } catch (err) {
      showError(readableError(err));
    } finally {
      btnSubmit.disabled = false;
    }
  });

  function readableError(err) {
    const m = (err && err.message) || '';
    if (/invalid login/i.test(m)) return 'E-Mail oder Passwort ist falsch.';
    if (/already registered|already exists/i.test(m)) return 'Diese E-Mail ist schon an Bord – bitte anmelden.';
    if (/confirm/i.test(m)) return 'Bitte zuerst die E-Mail bestätigen (Postfach prüfen).';
    if (/rate limit/i.test(m)) return 'Zu viele Versuche – bitte kurz warten.';
    if (/password/i.test(m) && /length|weak/i.test(m)) return 'Das Passwort ist zu schwach (mind. 6 Zeichen).';
    return m || 'Etwas ist schiefgelaufen. Bitte erneut versuchen.';
  }

  boot();
})();
