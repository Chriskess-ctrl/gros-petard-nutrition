'use strict';

(() => {
  const root = document.querySelector('[data-push-reminders]');
  if (!root) return;

  const scheduleKey = 'gp-nutrition-reminder-schedules-v2';
  const deviceKey = 'gp-nutrition-push-device-v1';
  const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
  const pairingCodePattern = /^[A-Za-z0-9_-]{32,43}$/;
  const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  const choices = {
    weight: ['Pesée', 'weekly', 1, '07:30'],
    measure: ['Mensurations', 'monthly', 1, '08:00'],
    breakfast: ['Petit-déjeuner', 'daily', 0, '07:30'],
    'snack-am': ['Collation matin', 'daily', 0, '10:30'],
    lunch: ['Déjeuner', 'daily', 0, '12:30'],
    'snack-pm': ['Collation après-midi', 'daily', 0, '16:00'],
    dinner: ['Dîner', 'daily', 0, '20:00'],
  };
  const weekdays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const supported = window.isSecureContext && 'Notification' in window
    && 'serviceWorker' in navigator && 'PushManager' in window;
  const form = root.querySelector('#reminder-form');
  const cards = root.querySelector('#reminder-cards');
  const enable = root.querySelector('#reminder-enable');
  const disable = root.querySelector('#reminder-disable');
  const test = root.querySelector('#reminder-test-notification');
  const codeInput = root.querySelector('#reminder-code');
  const codeToggle = root.querySelector('#reminder-code-toggle');
  codeToggle?.addEventListener('click', () => {
    const visible = codeInput.type === 'password';
    codeInput.type = visible ? 'text' : 'password';
    codeToggle.setAttribute('aria-pressed', String(visible));
    codeToggle.setAttribute('aria-label', visible ? 'Masquer le code' : 'Afficher le code');
    codeToggle.title = visible ? 'Masquer le code' : 'Afficher le code';
  });
  const feedback = root.querySelector('#reminder-device-feedback');
  const scheduleFeedback = root.querySelector('#reminder-status');
  const bindings = new Map();
  let busy = false;

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }

  function validDay(day, frequency) {
    const value = Number(day);
    return Number.isInteger(value) && (frequency === 'monthly' ? value >= 1 && value <= 31 : value >= 0 && value <= 6);
  }

  function localSchedules() {
    const current = load(scheduleKey);
    const legacy = current ? null : load('gp-nutrition-reminder-schedules-v1');
    const legacyFlags = !current && !legacy && typeof readStoredData === 'function'
      ? readStoredData().reminders : null;
    return Object.fromEntries(Object.entries(choices).map(([kind, [, fallbackFrequency, fallbackDay, fallbackTime]]) => {
      const legacyKind = kind === 'dinner' ? 'food' : kind;
      const saved = current?.[kind] || legacy?.[legacyKind];
      const frequency = ['daily', 'weekly', 'monthly'].includes(saved?.frequency) ? saved.frequency : fallbackFrequency;
      const day = validDay(saved?.day, frequency) ? Number(saved.day) : Math.max(frequency === 'monthly' ? 1 : 0, fallbackDay);
      return [kind, {
        enabled: saved ? saved.enabled === true : legacyFlags?.[legacyKind] === true,
        frequency, day, time: timePattern.test(saved?.time) ? saved.time : fallbackTime,
      }];
    }));
  }

  function deviceState() {
    const value = load(deviceKey);
    return value && tokenPattern.test(value.token) && ['enrolling', 'active', 'expired', 'revoke'].includes(value.phase)
      ? value : null;
  }

  function storeDevice(value) {
    if (value) localStorage.setItem(deviceKey, JSON.stringify(value));
    else localStorage.removeItem(deviceKey);
  }

  function fillDays(select, frequency, day) {
    const values = frequency === 'monthly'
      ? Array.from({ length: 31 }, (_, index) => [index + 1, String(index + 1)])
      : weekdays.map((name, index) => [index, name]);
    select.replaceChildren(...values.map(([value, name]) => new Option(name, String(value))));
    if (validDay(day, frequency)) select.value = String(day);
  }

  for (const [kind, rule] of Object.entries(localSchedules())) {
    const [label] = choices[kind];
    const card = document.createElement('section');
    card.className = 'reminder-card';
    card.dataset.reminder = kind;
    card.innerHTML = '<label class="reminder-head"><span></span><input type="checkbox"></label>'
      + '<div class="reminder-options"><label>Fréquence<select data-field="frequency">'
      + '<option value="daily">Chaque jour</option><option value="weekly">Chaque semaine</option>'
      + '<option value="monthly">Chaque mois</option></select></label>'
      + '<label class="reminder-day">Jour<select data-field="day"></select></label>'
      + '<label>Heure<input type="time" required></label></div>';
    card.querySelector('span').textContent = label;
    const enabled = card.querySelector('input[type=checkbox]');
    const options = card.querySelector('.reminder-options');
    const frequency = card.querySelector('[data-field=frequency]');
    const day = card.querySelector('[data-field=day]');
    const time = card.querySelector('input[type=time]');
    enabled.checked = rule.enabled;
    options.hidden = !rule.enabled;
    frequency.value = rule.frequency;
    time.value = rule.time;
    day.parentElement.hidden = rule.frequency === 'daily';
    fillDays(day, rule.frequency, rule.day);
    enabled.addEventListener('change', () => { options.hidden = !enabled.checked; });
    frequency.addEventListener('change', () => {
      day.parentElement.hidden = frequency.value === 'daily';
      fillDays(day, frequency.value, day.value);
    });
    bindings.set(kind, { enabled, frequency, day, time });
    cards.append(card);
  }

  function saveForm() {
    const entries = [];
    for (const [kind, fields] of bindings) {
      const enabled = fields.enabled.checked;
      const time = fields.time.value;
      if (enabled && !timePattern.test(time)) {
        fields.time.focus();
        throw Error('Renseigne une heure pour « ' + choices[kind][0] + ' ».');
      }
      const frequency = fields.frequency.value;
      entries.push([kind, {
        enabled, frequency, day: frequency === 'daily' ? 0 : Number(fields.day.value),
        time: timePattern.test(time) ? time : choices[kind][3],
      }]);
    }
    const schedules = Object.fromEntries(entries);
    localStorage.setItem(scheduleKey, JSON.stringify(schedules));
    return schedules;
  }

  const apiErrors = {
    invalid_pairing_code: 'Le code d’activation est incorrect.',
    unsupported_push_service: 'Ouvre l’application dans Chrome sur ton Samsung pour activer ce service.',
    device_limit: 'La limite d’appareils est atteinte. Désactive les rappels sur un autre appareil.',
    subscription_in_use: 'Ce navigateur a déjà un abonnement. Désactive-le, puis réactive les rappels.',
    not_configured: 'Le service de notifications est en cours de configuration.',
    not_subscribed: 'Réactive les notifications sur cet appareil.',
    test_rate_limited: 'Attends une minute avant de refaire un test.',
    push_unavailable: 'Le service Push n’a pas accepté le test. Réessaie dans une minute.',
    temporarily_unavailable: 'Le relais Vercel ne parvient pas à joindre Cloudflare (erreur 502).',
    forbidden: 'La connexion entre Vercel et Cloudflare est refusée (erreur 403).',
  };

  async function api(action, token, body) {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body) headers['Content-Type'] = 'application/json';
    const response = await fetch('/api/reminders?action=' + action, {
      method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    }).catch(() => { throw Error('Le service de rappels est momentanément inaccessible.'); });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (result.error === 'not_subscribed' && token) storeDevice({ token, phase: 'expired' });
      throw Error(apiErrors[result.error] || ('Le service de rappels a répondu avec une erreur ' + response.status + ' (' + (result.error || 'inconnue') + ').'));
    }
    return result;
  }

  async function registration() {
    const worker = await navigator.serviceWorker.getRegistration();
    if (!worker?.active) throw Error('L’application termine son chargement. Réessaie dans un instant.');
    return worker;
  }

  function data(subscription, schedules) {
    return {
      subscription: subscription.toJSON(), schedules,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
    };
  }

  async function synchronize(device, schedules = localSchedules()) {
    if (!supported || Notification.permission !== 'granted') throw Error('Autorise les notifications pour cette application.');
    const worker = await registration();
    const subscription = await worker.pushManager.getSubscription();
    if (!subscription) {
      storeDevice({ token: device.token, phase: 'expired' });
      throw Error('Réactive les notifications sur cet appareil.');
    }
    await api('preferences', device.token, data(subscription, schedules));
  }

  async function disconnect(device) {
    storeDevice({ token: device.token, phase: 'revoke' });
    try {
      const worker = await navigator.serviceWorker?.getRegistration();
      const subscription = await worker?.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
    } catch { /* The server can still remove the subscription. */ }
    try {
      await api('unsubscribe', device.token, {});
      storeDevice(null);
    } catch {
      throw Error('Désactivation côté serveur en attente. Elle reprendra au retour du réseau.');
    }
  }

  function drawState() {
    const state = deviceState()?.phase;
    const permission = supported ? Notification.permission : 'unsupported';
    let message = 'Notifications désactivées sur cet appareil.';
    if (!supported) message = 'Les notifications sont indisponibles dans ce navigateur.';
    else if (permission === 'denied') message = 'Les notifications sont bloquées dans les réglages de ce navigateur.';
    else if (state === 'active') message = 'Notifications activées sur cet appareil.';
    else if (state === 'expired') message = 'Les notifications doivent être réactivées.';
    else if (state === 'revoke') message = 'Désactivation en attente.';

    root.querySelector('#reminder-device-status').textContent = message;
    root.querySelector('#reminder-enrollment').hidden = !supported || state === 'active' || state === 'revoke';
    test.hidden = state !== 'active' || permission !== 'granted';
    disable.hidden = !state;
    for (const control of [enable, disable, test, root.querySelector('#reminder-save-schedules')]) control.disabled = busy;
  }

  async function run(operation, output = feedback) {
    if (busy) return;
    busy = true;
    if (output) output.textContent = '';
    drawState();
    try {
      const message = await operation(deviceState());
      if (message && output) output.textContent = message;
    } catch (error) {
      if (output) output.textContent = error.message;
    } finally {
      busy = false;
      drawState();
    }
  }

  enable.addEventListener('click', () => run(async device => {
    if (device?.phase === 'active' || device?.phase === 'revoke') return;
    const code = codeInput.value.trim();
    if (!pairingCodePattern.test(code)) {
      codeInput.focus();
      throw Error('Renseigne ton code d’activation.');
    }
    const schedules = saveForm();
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') throw Error('Autorise les notifications dans les réglages de ce navigateur.');
    const { publicKey } = await api('config');
    const worker = await registration();
    const applicationServerKey = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
    const token = device?.token || btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    storeDevice({ token, phase: 'enrolling' });

    let subscription = await worker.pushManager.getSubscription();
    if (subscription) {
      const key = new Uint8Array(subscription.options.applicationServerKey || []);
      if (device?.phase === 'expired' || key.length !== applicationServerKey.length
          || !key.every((byte, index) => byte === applicationServerKey[index])) {
        await subscription.unsubscribe();
        subscription = null;
      }
    }
    subscription ||= await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    await api('subscribe', token, { code, ...data(subscription, schedules) });
    storeDevice({ token, phase: 'active' });
    codeInput.value = '';
    return 'Les horaires enregistrés sont synchronisés.';
  }));

  form.addEventListener('submit', event => {
    event.preventDefault();
    void run(async device => {
      const schedules = saveForm();
      if (device?.phase !== 'active') return 'Horaires enregistrés sur cet appareil.';
      try {
        await synchronize(device, schedules);
        return 'Horaires enregistrés et synchronisés.';
      } catch (error) {
        return 'Horaires enregistrés sur cet appareil. ' + error.message;
      }
    }, scheduleFeedback);
  });

  test.addEventListener('click', () => run(async device => {
    if (device?.phase !== 'active') return;
    await synchronize(device);
    await api('test', device.token, {});
    return 'Le service Push a accepté le test. Vérifie tes notifications.';
  }));

  disable.addEventListener('click', () => run(async device => {
    if (device) await disconnect(device);
    return 'Les notifications de cet appareil sont désactivées.';
  }));

  function resume(output = null) {
    const state = deviceState()?.phase;
    if (!navigator.onLine || !['active', 'revoke'].includes(state)) return;
    void run(device => device?.phase === 'revoke' ? disconnect(device) : synchronize(device), output);
  }
  document.querySelector('[data-plus-open=reminders]')?.addEventListener('click', () => resume(feedback));
  window.addEventListener('load', () => resume());
  window.addEventListener('online', () => resume(feedback));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
  window.addEventListener('storage', event => { if (event.key === deviceKey) drawState(); });
  drawState();
})();
