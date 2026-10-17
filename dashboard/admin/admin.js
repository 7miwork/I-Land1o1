/* ============================================================
   I-Land1o1 – Admin-Dashboard
   Zeigt Nutzer, Abos und Eltern-Kind-Verknüpfungen.
   Nur für Rollen 'admin' (und 'teacher' zum Lesen).
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

  const appContent = document.getElementById('appContent');
  const btnLogout = document.getElementById('btnLogout');
  const whoBox = document.getElementById('authWho');

  let client = null;
  let myRole = 'student';

  if (isConfigured && window.supabase) {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  function showMsg(id, text, kind) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = !text;
    el.textContent = text;
    el.className = 'msg msg--' + kind;
  }

  function fmtDate(iso) {
    if (!iso) return '–';
    try { return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return iso; }
  }

  function roleBadge(role) {
    const cls = 'role-' + (role || 'student');
    const label = { student: 'Schüler:in', parent: 'Elternteil', teacher: 'Lehrer:in', admin: 'Admin' }[role] || role;
    return '<span class="role-badge ' + cls + '">' + label + '</span>';
  }

  function statusBadge(status) {
    const cls = 'status-' + (status || 'incomplete');
    return '<span class="' + cls + '">' + (status || '–') + '</span>';
  }

  async function boot() {
    if (!client) {
      appContent.hidden = false;
      return;
    }
    const { data } = await client.auth.getSession();
    if (!data || !data.session || !data.session.user) {
      window.location.replace('/login/?next=/dashboard/admin/');
      return;
    }

    const { data: profile } = await client
      .from('profiles')
      .select('display_name, role')
      .eq('id', data.session.user.id)
      .maybeSingle();

    if (whoBox) whoBox.textContent = '🏴‍☠️ ' + (profile ? (profile.display_name || data.session.user.email) : data.session.user.email);
    myRole = profile ? profile.role : 'student';

    if (myRole !== 'admin' && myRole !== 'teacher') {
      appContent.hidden = false;
      const hero = document.querySelector('.hero');
      if (hero) hero.innerHTML = '<p class="kicker">⛔ Zugriff verweigert</p><h1>Nur für Admins</h1><p class="sub">Du hast keine Admin-Rechte.</p>';
      return;
    }

    if (btnLogout) {
      btnLogout.hidden = false;
      btnLogout.onclick = async () => { await client.auth.signOut(); window.location.replace('/login/'); };
    }

    appContent.hidden = false;
    await loadDashboard();
  }

  async function loadDashboard() {
    const [usersRes, subsRes, linksRes] = await Promise.all([
      client.from('profiles').select('*'),
      client.from('subscriptions').select('*'),
      client.from('parent_links').select('*'),
    ]);

    document.getElementById('countUsers').textContent = (usersRes.data || []).length;
    const activeSubs = (subsRes.data || []).filter(s => ['active', 'trialing', 'paid'].includes(s.status)).length;
    document.getElementById('countSubs').textContent = activeSubs;
    document.getElementById('countLinks').textContent = (linksRes.data || []).length;

    renderUsers(usersRes.data || []);
    renderSubs(subsRes.data || []);
    renderLinks(linksRes.data || []);
  }

  async function renderUsers(users) {
    const tbody = document.getElementById('usersBody');
    tbody.innerHTML = '';
    for (const u of users) {
      const tr = document.createElement('tr');
      const sel = document.createElement('select');
      sel.className = 'role-select';
      sel.value = u.role;
      ['student', 'parent', 'teacher', 'admin'].forEach(r => {
        const o = document.createElement('option'); o.value = r;
        o.textContent = { student: 'Schüler:in', parent: 'Elternteil', teacher: 'Lehrer:in', admin: 'Admin' }[r];
        sel.appendChild(o);
      });
      const btn = document.createElement('button');
      btn.className = 'btn-save'; btn.textContent = 'Speichern';
      btn.onclick = async () => {
        if (myRole !== 'admin') { showMsg('usersMsg', 'Nur Admins dürfen Rollen ändern.', 'error'); return; }
        const { error } = await client.from('profiles').update({ role: sel.value }).eq('id', u.id);
        if (error) showMsg('usersMsg', error.message, 'error');
        else { showMsg('usersMsg', 'Rolle gespeichert.', 'ok'); loadDashboard(); }
      };
      tr.innerHTML = '<td>' + (u.display_name || '–') + ' <br><small style="color:var(--sand)">' + (u.email || '–') + '</small></td>' +
        '<td>' + roleBadge(u.role) + '</td>' +
        '<td>' + sel.outerHTML + '<br>' + btn.outerHTML + '</td>' +
        '<td>' + fmtDate(u.created_at) + '</td>';
      tbody.appendChild(tr);
    }
  }

  async function renderSubs(subs) {
    const tbody = document.getElementById('subsBody');
    tbody.innerHTML = '';
    for (const s of subs) {
      const tr = document.createElement('tr');
      const userName = s.user_id ? 'User ' + s.user_id.slice(0, 8) : '–';
      tr.innerHTML = '<td>' + userName + '</td>' +
        '<td>' + (s.plan || '–') + '</td>' +
        '<td>' + statusBadge(s.status) + '</td>' +
        '<td>' + fmtDate(s.current_period_end) + '</td>';
      tbody.appendChild(tr);
    }
  }

  async function renderLinks(links) {
    const tbody = document.getElementById('linksBody');
    tbody.innerHTML = '';
    for (const l of links) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>Parent ' + (l.parent_id || '–').slice(0, 8) + '</td>' +
        '<td>Student ' + (l.student_id || '–').slice(0, 8) + '</td>' +
        '<td>' + fmtDate(l.created_at) + '</td>';
      tbody.appendChild(tr);
    }
  }

  boot();
})();