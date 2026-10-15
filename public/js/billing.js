// Кредиты и оплата на странице: вход по ссылке из письма, пакеты кредитов (Paddle), списание при скачивании.
// Если сервер без базы (или его нет — старый хостинг), режим выключен и работает прежний дневной лимит.
import { t, lang, locale } from './i18n.js?v=4.0';
import { PACKS, parseModelId, FREE_PER_DAY, FREE_AREA_KM2, BLOCK_KM2, CREDITS_PER_BLOCK, CREDITS_PER_EXTRA, USD_PER_CREDIT } from './pricing.js?v=4.0';

export const state = { billing: false, checkout: false, freeLimit: FREE_PER_DAY, freeLeft: FREE_PER_DAY, counted: [], paid: [], user: null };
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
let openArea = () => {};
export const onOpenArea = (fn) => { openArea = fn; };
const emit = () => listeners.forEach((fn) => fn(state));

const api = async (path, body) => {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' } : { cache: 'no-store', credentials: 'same-origin' });
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) throw new Error(`api ${res.status}`);
  return { status: res.status, data: await res.json() };
};

// обезличенная статистика для админки: «сколько раз за сутки», без устройства и пользователя
export function track(kind) {
  if (!state.billing) return;
  fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind }), keepalive: true }).catch(() => {});
}

export async function refresh() {
  state.billing = false;
  state.freeLeft = 999999;
  state.freeLimit = 999999;
  emit();
  return state;
}

/** Скачивание участка: списывает кредиты или бесплатный слот. Если нужно заплатить — открывает окно. */
export async function charge(modelId) {
  return { ok: true };
}

/* ---------- окно аккаунта ---------- */

let dlg = null;
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k);
  return n;
};

function ensureDialog() {
  if (dlg) return dlg;
  dlg = el('dialog', { class: 'acct', 'aria-labelledby': 'acct-title' });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // щелчок по фону
  document.body.append(dlg);
  return dlg;
}

const usd = (v) => `$${v % 1 ? v.toFixed(2) : v}`;
// формы слова «кредит» по правилам языка: one / few / many (в казахском и татарском форма одна)
export function creditsLabel(n) {
  let form = 'many';
  try {
    const c = new Intl.PluralRules(lang).select(n);
    form = c === 'one' ? 'one' : c === 'few' ? 'few' : 'many';
  } catch { form = n === 1 ? 'one' : 'many'; }
  return t(`credits.${form}`, { n });
}

let view = 'buy', ctx = {};
export function open(next = 'buy', context = {}) {
  view = state.user || next === 'restore' ? next : 'signin';
  if (next === 'buy' && !state.user) view = 'signin';
  // пока оплата не подключена — честная заглушка «скоро», без входа и покупки (кроме входа ради промокода)
  if (!state.checkout && !state.user && !context.promo) view = 'soon';
  ctx = context;
  render();
  if (!dlg.open) dlg.showModal();
}

function rules() {
  return el('ul', { class: 'acct-rules' },
    el('li', {}, t('price.rule.free', { n: FREE_PER_DAY, km: FREE_AREA_KM2 })),
    el('li', {}, t('price.rule.extra', { c: creditsLabel(CREDITS_PER_EXTRA) })),
    el('li', {}, t('price.rule.size', { km: BLOCK_KM2, c: creditsLabel(CREDITS_PER_BLOCK), usd: usd(CREDITS_PER_BLOCK * USD_PER_CREDIT) })),
    el('li', {}, t('price.rule.keep')));
}

function render() {
  const d = ensureDialog();
  d.innerHTML = '';
  const append = d.append.bind(d);
  d.append = (...nodes) => append(...nodes.filter((n) => n != null)); // пропускаем пустые блоки
  const close = el('button', { class: 'acct-close', type: 'button', 'aria-label': t('acct.close'), onclick: () => d.close() }, '×');
  const need = ctx.need ? el('p', { class: 'acct-need' }, t('acct.need', { c: creditsLabel(ctx.need) })) : null;

  if (view === 'soon') {
    const list = el('div', { class: 'acct-packs' });
    for (const p of PACKS)
      list.append(el('div', { class: 'acct-pack is-soon' }, el('span', { class: 'acct-pack-credits' }, creditsLabel(p.credits)), el('b', {}, usd(p.usd)), el('small', {}, t('acct.perCredit', { usd: usd(p.usd / p.credits) }))));
    d.append(close, el('h3', { id: 'acct-title' }, t('acct.soonTitle'), ' ', el('span', { class: 'badge badge-dark' }, t('acct.soonBadge'))), need,
      el('p', {}, t('acct.soonText')), list, rules(), el('p', { class: 'acct-legal muted' }, t('acct.legal')));
  } else if (view === 'signin') {
    const input = el('input', { type: 'email', required: '', placeholder: 'you@example.com', autocomplete: 'email', value: ctx.email ?? '' });
    const msg = el('p', { class: 'acct-msg', role: 'status' });
    const btn = el('button', { class: 'btn btn-dark btn-block', type: 'submit' }, t('acct.sendLink'));
    const form = el('form', {
      class: 'acct-form',
      onsubmit: async (e) => {
        e.preventDefault();
        btn.disabled = true;
        msg.textContent = '';
        try {
          const { data } = await api('/api/auth/request', { email: input.value, lang });
          if (data.ok) { ctx.email = input.value; view = 'sent'; ctx.devLink = data.devLink; render(); return; }
          msg.textContent = t(`acct.err.${data.reason}`, {}) || t('acct.err.generic');
        } catch { msg.textContent = t('acct.err.generic'); }
        btn.disabled = false;
      },
    }, input, btn, msg);
    const promo = ctx.promo ? el('p', { class: 'acct-need' }, t('promo.signin', { code: ctx.promo })) : null;
    d.append(close, el('h3', { id: 'acct-title' }, t('acct.signinTitle')), promo ?? need, el('p', { class: 'muted' }, t('acct.signinText')), form,
      ctx.promo ? null : promoForm(),
      el('button', { class: 'acct-link', type: 'button', onclick: () => { view = 'restore'; render(); } }, t('acct.restoreLink')), rules());
  } else if (view === 'sent') {
    d.append(close, el('h3', { id: 'acct-title' }, t('acct.sentTitle')), el('p', {}, t('acct.sentText', { email: ctx.email })),
      ctx.devLink ? el('p', { class: 'muted' }, el('a', { href: ctx.devLink }, 'dev: open link')) : null);
  } else if (view === 'restore') {
    const input = el('input', { type: 'text', required: '', placeholder: 'txn_01…', autocomplete: 'off' });
    const msg = el('p', { class: 'acct-msg', role: 'status' });
    const form = el('form', {
      class: 'acct-form',
      onsubmit: async (e) => {
        e.preventDefault();
        msg.textContent = '';
        try {
          const { data } = await api('/api/auth/restore', { txn: input.value, lang });
          msg.textContent = data.ok ? t('acct.restoreSent', { email: data.masked }) : t(`acct.err.${data.reason}`) || t('acct.err.generic');
        } catch { msg.textContent = t('acct.err.generic'); }
      },
    }, input, el('button', { class: 'btn btn-dark btn-block', type: 'submit' }, t('acct.restoreBtn')), msg);
    d.append(close, el('h3', { id: 'acct-title' }, t('acct.restoreTitle')), el('p', { class: 'muted' }, t('acct.restoreText')), form,
      el('button', { class: 'acct-link', type: 'button', onclick: () => { view = 'signin'; render(); } }, t('acct.back')));
  } else {
    const u = state.user;
    const list = el('div', { class: 'acct-packs' });
    for (const p of PACKS) {
      const price = el('b', { 'data-pack': p.id }, usd(p.usd));
      list.append(el('button', {
        class: 'acct-pack', type: 'button', disabled: state.checkout ? null : '',
        onclick: () => buy(p.id),
      }, el('span', { class: 'acct-pack-credits' }, creditsLabel(p.credits)), price, el('small', {}, t('acct.perCredit', { usd: usd(p.usd / p.credits) }))));
    }
    d.append(close, el('h3', { id: 'acct-title' }, t('acct.buyTitle')), need,
      el('p', { class: 'acct-balance' }, t('acct.balance', { c: creditsLabel(u?.credits ?? 0), email: u?.email ?? '' })),
      ctx.promoAdded ? el('p', { class: 'acct-promo-ok' }, t('promo.added', { c: creditsLabel(ctx.promoAdded) })) : null,
      list,
      state.checkout ? null : el('p', { class: 'acct-soon' }, t('acct.soonText')),
      myAreas(),
      promoForm(),
      rules(),
      el('p', { class: 'acct-legal muted' }, t('acct.legal')),
      el('button', { class: 'acct-link', type: 'button', onclick: logout }, t('acct.signout')));
    localizePrices();
  }
}

/* ---------- мои участки ---------- */

function myAreas() {
  const areas = state.areas ?? [];
  if (!areas.length) return null;
  const fmtDate = new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' });
  const list = el('ul', { class: 'acct-areas' });
  for (const a of areas.slice(0, 30)) {
    const p = parseModelId(a.id);
    if (!p) continue;
    const km = (p.size / 1000).toFixed(2);
    list.append(el('li', {},
      el('span', { class: 'acct-area-name' }, `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`),
      el('span', { class: 'acct-area-meta' }, `${p.shape === 'circle' ? '⌀ ' + km : km + ' × ' + km} ${t('km')} · ${fmtDate.format(a.at)}`),
      el('button', { class: 'btn btn-line btn-sm acct-area-open', type: 'button', onclick: () => { dlg.close(); openArea(a.id); } }, t('acct.areaOpen'))));
  }
  return el('div', { class: 'acct-areas-box' }, el('h4', {}, t('acct.areasTitle')), el('p', { class: 'muted' }, t('acct.areasText')), list);
}

/* ---------- промокоды ---------- */

// код из ссылки ?promo=… ждёт входа здесь, даже если человек ушёл за письмом
const PROMO_KEY = 'ue:promo';
const pendingPromo = {
  get: () => { try { return localStorage.getItem(PROMO_KEY) ?? ''; } catch { return ''; } },
  set: (v) => { try { if (v) localStorage.setItem(PROMO_KEY, v); else localStorage.removeItem(PROMO_KEY); } catch { /* приватный режим */ } },
};
const errText = (key) => { const s = t(key); return s === key ? t('acct.err.generic') : s; };

async function redeem(code) {
  const { data } = await api('/api/promo/redeem', { code });
  if (data.ok && state.user) { state.user.credits = data.credits; emit(); }
  return data;
}

function promoForm() {
  const input = el('input', { type: 'text', placeholder: t('promo.placeholder'), autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '32', required: '', value: ctx.promoCode ?? '' });
  const btn = el('button', { class: 'btn btn-dark', type: 'submit' }, t('promo.apply'));
  const msg = el('p', { class: 'acct-msg', role: 'status' }, ctx.promoError ? errText(`promo.err.${ctx.promoError}`) : '');
  const form = el('form', {
    class: 'acct-promo-form',
    onsubmit: async (e) => {
      e.preventDefault();
      btn.disabled = true;
      msg.textContent = '';
      // без входа код запоминается и применяется сразу после входа по ссылке из письма
      if (!state.user) {
        const code = input.value.trim().toUpperCase();
        if (!/^[A-Z0-9-]{3,32}$/.test(code)) { msg.textContent = t('promo.err.notfound'); btn.disabled = false; return; }
        pendingPromo.set(code);
        ctx = { ...ctx, promo: code };
        render();
        return;
      }
      try {
        const data = await redeem(input.value);
        if (data.ok) { ctx = { ...ctx, promoAdded: data.added, promoError: null, promoCode: '' }; render(); return; }
        msg.textContent = errText(`promo.err.${data.reason}`);
      } catch { msg.textContent = t('acct.err.generic'); }
      btn.disabled = false;
    },
  }, input, btn);
  const box = el('details', { class: 'acct-promo' }, el('summary', {}, t('promo.toggle')), form, msg);
  if (ctx.promoError || ctx.promoCode) box.open = true;
  return box;
}

/* ---------- Paddle ---------- */

let paddleReady = null, paddleCfg = null;
// языки окна оплаты Paddle; казахский и татарский — по-русски
const PADDLE_LOCALE = { en: 'en', ru: 'ru', es: 'es', pt: 'pt', de: 'de', fr: 'fr', kk: 'ru', tt: 'ru' };
function loadPaddle() {
  paddleReady ??= (async () => {
    const { data } = await api('/api/paddle/config');
    if (!data.enabled) throw new Error('checkout off');
    paddleCfg = data;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
      s.onload = resolve; s.onerror = reject;
      document.head.append(s);
    });
    if (data.environment === 'sandbox') window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({
      token: data.token,
      eventCallback: (ev) => { if (ev.name === 'checkout.completed') afterPurchase(); },
    });
    return window.Paddle;
  })();
  paddleReady.catch(() => { paddleReady = null; });
  return paddleReady;
}

// цены в валюте покупателя (Paddle сам определяет страну)
async function localizePrices() {
  if (!state.checkout) return;
  try {
    const P = await loadPaddle();
    const res = await P.PricePreview({ items: paddleCfg.packs.map((p) => ({ priceId: p.priceId, quantity: 1 })) });
    for (const li of res.data.details.lineItems) {
      const pack = paddleCfg.packs.find((p) => p.priceId === li.price.id);
      const b = dlg?.querySelector(`[data-pack="${pack?.id}"]`);
      if (b) b.textContent = li.formattedTotals.total;
    }
  } catch { /* остаются цены в долларах */ }
}

async function buy(packId) {
  try {
    const P = await loadPaddle();
    const pack = paddleCfg.packs.find((p) => p.id === packId);
    dlg.close();
    P.Checkout.open({
      items: [{ priceId: pack.priceId, quantity: 1 }],
      customer: state.user ? { email: state.user.email } : undefined,
      customData: state.user ? { email: state.user.email } : undefined,
      settings: { displayMode: 'overlay', theme: 'light', locale: PADDLE_LOCALE[lang] ?? 'en' },
    });
  } catch {
    alertMsg(t('acct.checkoutOff'));
  }
}

// кредиты начисляет уведомление Paddle — ждём его несколько секунд
async function afterPurchase() {
  const before = state.user?.credits ?? 0;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    await refresh();
    if ((state.user?.credits ?? 0) > before) break;
  }
}

async function logout() {
  try { await api('/api/auth/logout', {}); } catch { /* всё равно сбрасываем */ }
  state.user = null;
  dlg?.close();
  emit();
}

function alertMsg(text) {
  ensureDialog();
  dlg.innerHTML = '';
  dlg.append(el('button', { class: 'acct-close', type: 'button', onclick: () => dlg.close() }, '×'), el('p', {}, text));
  if (!dlg.open) dlg.showModal();
}

// вход по ссылке из письма: ?login=<токен>
// и промокод по ссылке: ?promo=<код> — применяется сразу или после входа
export async function handleLoginLink() {
  const params = new URLSearchParams(location.search);
  const token = params.get('login');
  const promoParam = params.get('promo');
  if (promoParam) pendingPromo.set(promoParam.trim().toUpperCase().slice(0, 32));
  if (token || promoParam) {
    params.delete('login');
    params.delete('promo');
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
  }
  if (token) {
    try {
      const { data } = await api('/api/auth/verify', { token });
      if (data.ok) { state.user = data.user; emit(); }
      else { alertMsg(t('acct.err.expired')); return; }
    } catch { alertMsg(t('acct.err.generic')); return; }
  }
  const code = state.billing ? pendingPromo.get() : '';
  if (!code) { if (token) open('buy'); return; }
  if (!state.user) { open('signin', { promo: code }); return; }
  try {
    const data = await redeem(code);
    if (data.reason !== 'rate') pendingPromo.set('');
    open('buy', data.ok ? { promoAdded: data.added } : { promoError: data.reason, promoCode: code });
  } catch { open('buy', { promoError: 'generic', promoCode: code }); }
}

export const rerender = () => { if (dlg?.open) render(); };
