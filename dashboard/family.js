/* ============================================================
   I-Land1o1 – Familie: Eltern-Code erstellen / einlösen
   ------------------------------------------------------------
   Modell:
   - Der ZAHLER ist immer ein Eltern-Konto (dort liegt auch Stripe).
   - Kinder bekommen ein eigenes Konto und lösen den Eltern-Code ein.
   - Reihenfolge ist egal: Code bei der Registrierung oder später.
   ============================================================ */

(function () {
  const section = document.getElementById('familySection');
  const box = document.getElementById('familyBox');
  const msg = document.getElementById('familyMsg');
  if (!section || !box) return;

  let sb = null;
  let me = null;

  function showMsg(text, kind = 'info') {
    if (!msg) return;
    msg.hidden = !text;
    msg.textContent = text;
    msg.className = 'premium-msg premium-msg--' + kind;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      showMsg('Code kopiert: ' + code, 'ok');
    } catch {
      showMsg('Code zum Abtippen: ' + code, 'ok');
    }
  }

  // ---------- Eltern-Ansicht ----------
  async function renderParent(profile) {
    const [{ data: links }, { data: invites }] = await Promise.all([
      sb.from('parent_links').select('student_id').eq('parent_id', me.id),
      sb.from('parent_invites').select('code, status, accepted_at').eq('parent_id', me.id).order('created_at', { ascending: false }),
    ]);

    const childIds = (links || []).map((l) => l.student_id);
    let children = [];
    if (childIds.length) {
      const { data } = await sb.from('profiles').select('id, display_name').in('id', childIds);
      children = data || [];
    }

    const openInvites = (invites || []).filter((i) => i.status === 'open');

    box.innerHTML = `
      <div class="premium-card is-active">
        <p class="premium-kicker">Dein Abo gilt für</p>
        <h3 class="premium-title">👨‍👩‍👧 ${children.length} ${children.length === 1 ? 'Kind' : 'Kinder'}</h3>
        ${children.length
          ? `<ul class="family-list">${children
              .map((c) => `<li>⛏️ ${escapeHtml(c.display_name)}</li>`)
              .join('')}</ul>`
          : '<p class="premium-note">Noch kein Kind verknüpft – erstell unten einen Code und gib ihn deinem Kind.</p>'}
      </div>

      <div class="premium-card">
        <p class="premium-kicker">Einladung</p>
        <h3 class="premium-title">${openInvites.length ? 'Code für dein Kind' : 'Neuen Code erstellen'}</h3>
        <p class="premium-note">Gib den Code deinem Kind – es trägt ihn bei der Registrierung ein
          oder später im Bereich „Familie". Ein Kind kann nur bei einem Elternteil hängen.</p>
        ${
          openInvites.length
            ? `<div class="family-codes">${openInvites
                .map(
                  (i) => `<button class="family-code" data-code="${escapeHtml(i.code)}">${escapeHtml(i.code)} <span>📋 kopieren</span></button>`
                )
                .join('')}</div>`
            : ''
        }
        <button class="btn btn-play" id="btnNewCode">${openInvites.length ? '+ weiteren Code erstellen' : '⚓ Code erstellen'}</button>
      </div>`;

    const newBtn = document.getElementById('btnNewCode');
    if (newBtn) {
      newBtn.addEventListener('click', async () => {
        newBtn.disabled = true;
        const { error } = await sb.rpc('create_invite');
        newBtn.disabled = false;
        if (error) {
          showMsg('Code konnte nicht erstellt werden: ' + error.message, 'error');
          return;
        }
        renderParent(profile);
      });
    }
    box.querySelectorAll('.family-code').forEach((b) => {
      b.addEventListener('click', () => copyCode(b.dataset.code));
    });
  }
  // ---------- Kind-Ansicht ----------
  async function renderStudent(profile) {
    const { data: link } = await sb
      .from('parent_links')
      .select('parent_id')
      .eq('student_id', me.id)
      .maybeSingle();

    let parentName = null;
    if (link?.parent_id) {
      const { data } = await sb.from('profiles').select('display_name').eq('id', link.parent_id).maybeSingle();
      parentName = data?.display_name;
    }

    const { data: hasAccess } = await sb.rpc('has_course_access', { p_user: me.id });

    if (link) {
      box.innerHTML = `
        <div class="premium-card is-active">
          <p class="premium-kicker">Dein Elternkonto</p>
          <h3 class="premium-title">👨‍👩‍👧 ${escapeHtml(parentName || 'Elternteil')}</h3>
          <p class="premium-note">${
            hasAccess
              ? '✅ Dein Abo ist aktiv – du hast Zugang zu allen Lektionen.'
              : 'ℹ️ Für den Zugang zu allen Lektionen braucht dein Elternteil ein aktives Abo.'
          }</p>
        </div>`;
      return;
    }

    box.innerHTML = `
      <div class="premium-card">
        <p class="premium-kicker">Noch nicht verknüpft</p>
        <h3 class="premium-title">🏴‍☠️ Eltern-Code eingeben</h3>
        <p class="premium-note">Falls deine Eltern den Abo kaufen, geben sie dir einen Code wie
          <strong>ILAND-XXXXXX</strong>. Damit wird dein Konto mit ihrem Abo verbunden.</p>
        <input id="familyCode" class="family-input" type="text" autocomplete="off" placeholder="ILAND-XXXXXX" />
        <button class="btn btn-play" id="btnAccept">🔗 Code einlösen</button>
      </div>`;

    const btn = document.getElementById('btnAccept');
    btn.addEventListener('click', async () => {
      const code = document.getElementById('familyCode').value.trim();
      if (!code) return;
      btn.disabled = true;
      const { error } = await sb.rpc('accept_invite', { p_code: code });
      btn.disabled = false;
      if (error) {
        showMsg(error.message, 'error');
        return;
      }
      showMsg('Code eingelöst – dein Abo gilt jetzt für dich! 🎉', 'ok');
      setTimeout(() => renderStudent(profile), 600);
    });
  }

  async function init(client, user) {
    sb = client;
    me = user;
    section.hidden = false;
    const { data: profile } = await sb
      .from('profiles')
      .select('id, role, display_name')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile) return;
    if (profile.role === 'parent') renderParent(profile);
    else renderStudent(profile);
  }

  window.initFamily = init;
})();