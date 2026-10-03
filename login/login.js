/* ============================================================
   I-Land1o1 – Login-Seite (Hauptseite /login)
   Gleiche Supabase-Instanz wie das Dashboard, gleicher Look
   wie die Hauptseite. Nach erfolgreichem Login: /dashboard/
   ============================================================ */

(function () {
  const cfg = window.ILAND_CONFIG || {};
  const isConfigured =
    typeof cfg.SUPABASE_URL === 'string' &&
    typeof cfg.SUPABASE_ANON_KEY === 'string' &&
    /^https:\/\/.+\..+/.test(cfg.SUPABASE_URL) &&
    cfg.SUPABASE_ANON_KEY.length > 20;

  const form = document.getElementById('loginForm');
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const title = document.getElementById('formTitle');
  const submit = document.getElementById('submit');
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const name = document.getElementById('name');
  const invite = document.getElementById('invite');
  const signupFields = document.getElementById('signupFields');
  const inviteBlock = document.getElementById('inviteBlock');
  const errorBox = document.getElementById('error');

  let mode = 'login';
  let client = null;
  if (isConfigured && window.supabase) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  function showError(msg, kind) {
    if (!msg) {
      errorBox.hidden = true;
      return;
    }
    errorBox.hidden = false;
    errorBox.textContent = msg;
    errorBox.className = 'error' + (kind ? ' ' + kind : '');
  }

  function selectedRole() {
    const checked = form.querySelector('input[name="role"]:checked');
    return checked ? checked.value : 'student';
  }

  function syncRole() {
    if (inviteBlock) inviteBlock.hidden = selectedRole() !== 'student';
  }

  function setMode(m) {
    mode = m;
    tabLogin.classList.toggle('active', m === 'login');
    tabSignup.classList.toggle('active', m === 'signup');
    signupFields.hidden = m !== 'signup';
    title.textContent = m === 'login' ? 'Willkommen zurück!' : 'Neues Konto anlegen';
    submit.textContent = m === 'login' ? 'Anmelden ⚓' : 'Registrieren 🏴‍☠️';
    password.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    syncRole();
    showError('');
  }

  function readableError(err) {
    const m = (err && err.message) || '';
    if (/invalid login credentials/i.test(m)) return 'E-Mail oder Passwort ist falsch.';
    if (/email not confirmed/i.test(m)) return 'Bitte bestätige zuerst die E-Mail im Postfach.';
    if (/already registered|already exists/i.test(m)) return 'Diese E-Mail ist schon dabei – bitte anmelden.';
    if (/confirm/i.test(m)) return 'Bitte bestätige zuerst die E-Mail im Postfach. 📬';
    if (/rate limit|too many/i.test(m)) return 'Zu viele Versuche – bitte kurz warten.';
    if (/password/i.test(m)) return 'Das Passwort ist zu schwach (mindestens 6 Zeichen).';
    return m || 'Etwas ist schiefgelaufen. Bitte erneut versuchen.';
  }

  function goDashboard(user) {
    // Weiter zur naechsten Seite, falls per ?next= gewuenscht
    const next = new URLSearchParams(window.location.search).get('next');
    const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard/';
    window.location.replace(safe + (user ? '?angemeldet=1' : ''));
  }

  tabLogin.addEventListener('click', () => setMode('login'));
  tabSignup.addEventListener('click', () => setMode('signup'));
  form.addEventListener('change', syncRole);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');

    const mail = email.value.trim();
    const pw = password.value;

    if (!client) {
      showError('Login ist gerade nicht verfügbar. Bitte später erneut versuchen.');
      return;
    }
    if (!mail || !pw) {
      showError('Bitte E-Mail und Passwort ausfüllen.');
      return;
    }

    submit.disabled = true;
    try {
      if (mode === 'signup') {
        const payload = name.value.trim();
        const { data, error } = await client.auth.signUp({
          email: mail,
          password: pw,
          options: {
            data: {
              ...(payload ? { display_name: payload } : {}),
              role: selectedRole(),
            },
          },
        });
        if (error) throw error;

        if (!data.session) {
          // Bestaetigung per E-Mail noetig -> Login-Tab zeigen
          setMode('login');
          showError('Fast geschafft! Bitte bestätige die E-Mail, die wir dir geschickt haben. 📬', 'ok');
          return;
        }

        // Eltern-Code direkt einloesen, falls angegeben
        const code = invite ? invite.value.trim() : '';
        if (code && selectedRole() === 'student') {
          const { error: linkError } = await client.rpc('accept_invite', { p_code: code });
          if (linkError) console.warn('Eltern-Code nicht eingelöst:', linkError.message);
        }
        goDashboard(data.session.user);
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email: mail, password: pw });
        if (error) throw error;
        goDashboard(data.session.user);
      }
    } catch (err) {
      showError(readableError(err));
    } finally {
      submit.disabled = false;
    }
  });

  // Schon angemeldet? Dann direkt weiter zum Dashboard
  (async () => {
    if (!client) return;
    const { data } = await client.auth.getSession();
    if (data.session && data.session.user) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('abmelden') !== '1') {
        // Nicht automatisch weiterleiten, damit man den Login sieht.
        // Erst beim Absenden geht es weiter.
      }
    }
  })();

  setMode('login');
})();