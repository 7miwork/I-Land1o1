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
  const phoneCountry = document.getElementById('phoneCountry');
  const phone = document.getElementById('phone');
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
      errorBox.textContent = '';
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
    if (/already registered|already exists/i.test(m)) return 'Diese E-Mail ist schon registriert – bitte anmelden.';
    if (/confirm/i.test(m)) return 'Bitte bestätige zuerst die E-Mail im Postfach. 📬';
    if (/rate limit|too many/i.test(m)) return 'Zu viele Versuche – bitte kurz warten.';
    if (/password/i.test(m)) return 'Das Passwort ist zu schwach (mindestens 6 Zeichen).';
    if (/invalid email/i.test(m)) return 'Bitte eine gültige E-Mail-Adresse eingeben.';
    return m || 'Etwas ist schiefgelaufen. Bitte erneut versuchen.';
  }

  function isValidEmail(mail) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
  }

  // Handynummer: Ländervorwahl + Nummer zusammensetzen, Leerzeichen entfernen
  function formattedPhone() {
    if (!phoneCountry || !phone) return '';
    const cc = phoneCountry.value.trim();
    const num = phone.value.replace(/\s+/g, '').replace(/^\+/, '');
    if (!num) return '';
    return cc + num;
  }

  // Handynummer validieren: Mindestens 5 Ziffern insgesamt (ohne + und Leerzeichen)
  function isValidPhone(pn) {
    if (!pn) return false;
    const digits = pn.replace(/\D/g, '');
    return digits.length >= 5;
  }

  function formattedPhone() {
    if (!phoneCountry || !phone) return '';
    const cc = phoneCountry.value.trim();
    const num = phone.value.replace(/\s+/g, '').replace(/^\+/, '');
    if (!num) return '';
    return cc + num;
  }

  // Nach erfolgreichem Login/Registrierung: prüfen ob Telefon verifiziert ist
  async function routeAfterAuth(user) {
    if (!client) {
      window.location.href = '/dashboard/';
      return;
    }
    try {
      const { data: profile, error } = await client
        .from('profiles')
        .select('phone_verified, phone_number')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !profile) {
        window.location.href = '/dashboard/';
        return;
      }

      if (!profile.phone_verified) {
        const phoneToVerify = profile.phone_number || formattedPhone();
        window.location.href = '/dashboard/verify-sms.html?phone=' + encodeURIComponent(phoneToVerify);
      } else {
        window.location.href = '/dashboard/';
      }
    } catch (err) {
      console.error('Route check failed:', err);
      window.location.href = '/dashboard/';
    }
  }

  function goDashboard(user) {
    routeAfterAuth(user);
  }

  // Wenn schon eingeloggt -> Routing prüfen
  if (client) {
    client.getSession().then(({ data: { session } }) => {
      if (session) routeAfterAuth(session.user);
    });
  }

  tabLogin.addEventListener('click', () => setMode('login'));
  tabSignup.addEventListener('click', () => setMode('signup'));
  form.addEventListener('change', syncRole);

  // Hash-Handler: #signup in der URL öffnet automatisch den Registrieren-Tab
  (function () {
    if (window.location.hash === '#signup') {
      setMode('signup');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  })();

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
    if (!isValidEmail(mail)) {
      showError('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }
    if (mode === 'signup' && pw.length < 6) {
      showError('Das Passwort muss mindestens 6 Zeichen haben.');
      return;
    }
    if (mode === 'signup') {
      const phoneNumber = formattedPhone();
      if (!phoneNumber || !isValidPhone(phoneNumber)) {
        showError('Bitte eine gültige Handynummer mit Ländervorwahl eingeben.');
        return;
      }
    }

    submit.disabled = true;
    try {
      if (mode === 'signup') {
        const payload = name.value.trim();
        const phoneNumber = formattedPhone();
        const { data, error } = await client.auth.signUp({
          email: mail,
          password: pw,
          options: {
            data: {
              ...(payload ? { display_name: payload } : {}),
              phone: phoneNumber,
              role: selectedRole(),
            },
          },
        });
        if (error) throw error;

        if (!data.session) {
          // E-Mail-Bestätigung nötig → Login-Tab zeigen, Einladung kann erst nach Bestätigung eingelöst werden
          setMode('login');
          showError('Fast geschafft! Bitte bestätige die E-Mail, die wir dir geschickt haben. 📬', 'ok');
          return;
        }

        // Eltern-Code direkt einlösen, falls angegeben
        const code = invite ? invite.value.trim() : '';
        if (code && selectedRole() === 'student') {
          const { error: linkError } = await client.rpc('accept_invite', { p_code: code });
          if (linkError) {
            showError('Einladungs-Code konnte nicht eingelöst werden: ' + linkError.message);
            submit.disabled = false;
            return;
          }
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

  setMode('login');
})();