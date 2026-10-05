/* ============================================================
   I-Land1o1 – Abo & Zahlung (Stripe via Supabase Edge Functions)
   ------------------------------------------------------------
   Sicherheitsregel: Der Browser kennt NUR Tarif-Namen.
   Die Preise und der Stripe-Schlüssel liegen in der Edge Function.
   ============================================================ */

(function () {
  const section = document.getElementById('premiumSection');
  const box = document.getElementById('premiumBox');
  const msg = document.getElementById('premiumMsg');
  if (!section || !box) return;

  let sb = null;

  // Muss mit supabase/functions/_shared/plans.ts uebereinstimmen
  const PLANS = {
    'level1-monthly': { label: 'Level 1 · monatlich', hint: 'jederzeit kündbar', featured: true },
    'level1-once': { label: 'Level 1 · einmalig', hint: '11 Lektionen, kein Abo', badge: 'Einmalig' },
  };
  // 'paid' = Einmalzahlung (dauerhaft), 'active'/'trialing' = Abo
  const ACTIVE = ['active', 'trialing', 'past_due', 'paid'];

  function showMsg(text, kind = 'info') {
    if (!msg) return;
    msg.hidden = !text;
    msg.textContent = text;
    msg.className = 'premium-msg premium-msg--' + kind;
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return iso;
    }
  }

  function setBusy(btn, busy, labelBusy = 'Einen Moment…') {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.textContent;
      btn.textContent = labelBusy;
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.label || btn.textContent;
      btn.disabled = false;
    }
  }

  async function startCheckout(btn, plan) {
    if (!sb) return;
    setBusy(btn, true);
    const { data, error } = await sb.functions.invoke('create-checkout-session', { body: { plan } });
    if (error || !data || !data.url) {
      setBusy(btn, false);
      showMsg(
        data && data.alreadySubscribed
          ? 'Du hast schon ein aktives Abo – unten kannst du es verwalten.'
          : 'Die Kasse konnte nicht geöffnet werden. Bitte kurz später nochmal versuchen.',
        'error'
      );
      await refresh();
      return;
    }
    window.location.href = data.url;
  }

  async function openPortal(btn) {
    if (!sb) return;
    setBusy(btn, true);
    const { data, error } = await sb.functions.invoke('create-portal-session');
    if (error || !data || !data.url) {
      setBusy(btn, false);
      showMsg('Das Kundenportal konnte nicht geöffnet werden.', 'error');
      return;
    }
    window.location.href = data.url;
  }

  function renderActive(sub) {
    const label = PLANS[sub.plan]?.label || sub.plan;
    const end = sub.current_period_end ? fmtDate(sub.current_period_end) : '–';
    const isOneTime = sub.status === 'paid';
    const statusLine = isOneTime
      ? '✨ dauerhaft freigeschaltet – kein Abo, keine Verlängerung'
      : sub.status === 'past_due'
        ? 'Zahlung offen – bitte prüfen'
        : 'läuft bis ' + end;
    const note = sub.cancel_at_period_end
      ? `<p class="premium-hint premium-msg--warn">Gekündigt – läuft bis ${end} weiter.</p>`
      : '';
    box.innerHTML = `
      <div class="premium-card is-active">
        <p class="premium-kicker">Dein Zugang</p>
        <h3 class="premium-title">✅ ${label}</h3>
        <p class="premium-price">${statusLine}</p>
        ${note}
        <button class="btn btn-play" id="btnPortal">🧾 ${
          isOneTime ? 'Rechnung herunterladen' : 'Abo verwalten (Zahlung, Rechnungen)'
        }</button>
      </div>`;
    const btn = document.getElementById('btnPortal');
    btn.addEventListener('click', () => openPortal(btn));
  }

  function renderPlans() {
    box.innerHTML = `
      <div class="premium-grid">
        ${Object.entries(PLANS)
          .map(
            ([key, p], i) => `
          <div class="premium-card${p.featured ? ' is-featured' : ''}">
            <p class="premium-kicker">${p.badge ? p.badge + ' · ' : ''}${p.label}</p>
            <p class="premium-hint">${p.hint}</p>
            <p class="premium-note">Den Preis siehst du sicher in der Kasse.</p>
            <button class="btn btn-play" data-plan="${key}">⚓ ${p.badge ? 'Einmal kaufen' : 'Abo starten'}</button>
          </div>`
          )
          .join('')}
      </div>
      <p class="premium-note">Abgerechnet über Stripe · monatlich kündbar · Zahlung mit Karte</p>`;
    box.querySelectorAll('[data-plan]').forEach((btn) => {
      btn.addEventListener('click', () => startCheckout(btn, btn.dataset.plan));
    });
  }

  async function refresh() {
    if (!sb) return;
    section.hidden = false;
    const { data: sub } = await sb.from('subscriptions').select('*').maybeSingle();
    if (sub && ACTIVE.includes(sub.status)) renderActive(sub);
    else renderPlans();
  }

  // Wird von auth.js nach erfolgreichem Login aufgerufen
  window.initBilling = function (client) {
    sb = client;
    refresh();
  };

  // Rueckkehr aus dem Stripe-Checkout auswerten
  const params = new URLSearchParams(window.location.search);
  const checkout = params.get('checkout');
  if (checkout === 'erfolg') {
    showMsg('Willkommen an Bord! 🎉 Dein Abo ist aktiv.', 'ok');
    // Webhook kann 1–2 Sekunden brauchen -> kurz warten, dann laden
    setTimeout(() => refresh(), 2000);
  } else if (checkout === 'abgebrochen') {
    showMsg('Kein Stress – es wurde nichts abgebucht.', 'info');
    refresh();
  }
})();