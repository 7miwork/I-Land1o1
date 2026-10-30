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

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>\"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function roleBadge(role) {
    const safe = esc(role || 'student');
    const cls = 'role-' + safe;
    const label = { student: 'Schüler:in', parent: 'Elternteil', teacher: 'Lehrer:in', admin: 'Admin' }[role] || safe;
    return '<span class="role-badge ' + cls + '">' + esc(label) + '</span>';
  }

  function statusBadge(status) {
    const safe = esc(status || 'incomplete');
    const cls = 'status-' + safe;
    return '<span class="' + cls + '">' + (status == null ? '–' : esc(status)) + '</span>';
  }

  async function boot() {
    if (!client) {
      appContent.hidden = false;
      return;
    }
    const { data } = await client.auth.getSession();
    if (!data || !data.session || !data.session.user) {
      window.location.replace('/login/index.html?next=/dashboard/admin/');
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
      btnLogout.onclick = async () => { await client.auth.signOut(); window.location.replace('/'); };
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
      const tdName = document.createElement('td');
      tdName.textContent = u.display_name || '–';
      const small = document.createElement('small');
      small.style.color = 'var(--sand)';
      small.textContent = u.email || '–';
      tdName.appendChild(document.createElement('br'));
      tdName.appendChild(small);

      const tdRole = document.createElement('td');
      tdRole.innerHTML = roleBadge(u.role);

      const tdEdit = document.createElement('td');
      const sel = document.createElement('select');
      sel.className = 'role-select';
      sel.value = u.role;
      ['student', 'parent', 'teacher', 'admin'].forEach((r) => {
        const o = document.createElement('option');
        o.value = r;
        o.textContent = { student: 'Schüler:in', parent: 'Elternteil', teacher: 'Lehrer:in', admin: 'Admin' }[r];
        sel.appendChild(o);
      });
      const btn = document.createElement('button');
      btn.className = 'btn-save';
      btn.textContent = 'Speichern';
      btn.addEventListener('click', async () => {
        if (myRole !== 'admin') { showMsg('usersMsg', 'Nur Admins dürfen Rollen ändern.', 'error'); return; }
        const { error } = await client.from('profiles').update({ role: sel.value }).eq('id', u.id);
        if (error) showMsg('usersMsg', error.message, 'error');
        else { showMsg('usersMsg', 'Rolle gespeichert.', 'ok'); loadDashboard(); }
      });

      tdEdit.appendChild(sel);
      tdEdit.appendChild(document.createElement('br'));
      tdEdit.appendChild(btn);

      const tdDate = document.createElement('td');
      tdDate.textContent = fmtDate(u.created_at);

      tr.appendChild(tdName);
      tr.appendChild(tdRole);
      tr.appendChild(tdEdit);
      tr.appendChild(tdDate);
      tbody.appendChild(tr);
    }
  }

  async function renderSubs(subs) {
    const tbody = document.getElementById('subsBody');
    tbody.innerHTML = '';
    for (const s of subs) {
      const tr = document.createElement('tr');
      const tdUser = document.createElement('td');
      tdUser.textContent = s.user_id ? 'User ' + s.user_id.slice(0, 8) : '–';
      const tdPlan = document.createElement('td');
      tdPlan.textContent = s.plan || '–';
      const tdStatus = document.createElement('td');
      tdStatus.innerHTML = statusBadge(s.status);
      const tdDate = document.createElement('td');
      tdDate.textContent = fmtDate(s.current_period_end);
      tr.append(tdUser, tdPlan, tdStatus, tdDate);
      tbody.appendChild(tr);
    }
  }

  async function renderLinks(links) {
    const tbody = document.getElementById('linksBody');
    tbody.innerHTML = '';
    for (const l of links) {
      const tr = document.createElement('tr');
      const tdP = document.createElement('td');
      tdP.textContent = 'Parent ' + (l.parent_id || '–').slice(0, 8);
      const tdS = document.createElement('td');
      tdS.textContent = 'Student ' + (l.student_id || '–').slice(0, 8);
      const tdD = document.createElement('td');
      tdD.textContent = fmtDate(l.created_at);
      tr.append(tdP, tdS, tdD);
      tbody.appendChild(tr);
    }
  }

  boot();
})();
