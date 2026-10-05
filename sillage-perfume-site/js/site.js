/* Sillage — shared site code: demo accounts, subscriptions, mobile menu.
   Accounts are stored in this browser's localStorage only. This is a
   front-end demo: a real store needs a server, hashed passwords and a
   payment provider. */

const Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
};

/* ---------- small helpers ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function addMonths(iso, n) {
  const d = new Date(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.toISOString();
}

function addDays(iso, n) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function newOrderNumber() {
  return 'SLG-' + String(Math.floor(100000 + Math.random() * 900000));
}

/* ---------- multi-bottle helpers ---------- */
// The "Choose my own" cart, as a list of fragrance ids (older single-pick storage still works)
function getCartSelections() {
  const ids = FRAGRANCES.map(f => f.id);
  let list = Store.get('sillage_selections', null);
  if (!Array.isArray(list)) {
    let single = null;
    try { single = localStorage.getItem('sillage_selection'); } catch (e) {}
    list = single ? [single] : [];
  }
  return list.filter((id, i) => ids.includes(id) && list.indexOf(id) === i);
}
function setCartSelections(list) {
  Store.set('sillage_selections', list);
  try { localStorage.removeItem('sillage_selection'); } catch (e) {}
}
// A subscription's chosen bottles (supports the older single "selection" field)
function subSelections(sub) {
  if (!sub) return [];
  if (Array.isArray(sub.selections) && sub.selections.length) return sub.selections;
  return sub.selection ? [sub.selection] : [];
}
// The fragrance ids in one order
function orderIds(order) {
  if (Array.isArray(order.items) && order.items.length) return order.items;
  return order.fragranceId ? [order.fragranceId] : [];
}
function totalPrice(ids) {
  return ids.reduce((sum, id) => sum + ((findFragrance(id) || {}).price || 0), 0);
}
function bottleCount(n) { return n === 1 ? '1 bottle' : `${n} bottles`; }

// Rows of bottles (thumbnail, family, name, price) for summaries
function bottleRowsHTML(ids, note) {
  return ids.map(findFragrance).filter(Boolean).map(f => `
    <div class="bottle-row">
      <div class="bottle-thumb"><img src="${f.img}" alt="${esc(f.name)} bottle"></div>
      <div class="bottle-info">
        <p class="fam">${esc(f.family)}</p>
        <h3>${esc(f.name)}</h3>
        ${note ? `<p class="bottle-note">${note}</p>` : ''}
      </div>
      <span class="bottle-price">$${formatPrice(f.price)}</span>
    </div>`).join('');
}

function findFragrance(id) {
  return FRAGRANCES.find(f => f.id === id) || null;
}

/* ---------- accounts ---------- */
const Auth = (function () {
  const ACCOUNTS = 'sillage_accounts';
  const SESSION = 'sillage_session';

  // Not real security — just keeps passwords out of plain sight in the demo.
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return 'd' + h.toString(16);
  }
  function norm(email) { return String(email || '').trim().toLowerCase(); }
  function all() { return Store.get(ACCOUNTS, {}) || {}; }
  function saveAll(a) { Store.set(ACCOUNTS, a); }

  function current() {
    const email = Store.get(SESSION, null);
    if (!email) return null;
    return all()[email] || null;
  }

  function save(user) {
    const a = all();
    a[user.email] = user;
    saveAll(a);
  }

  function splitName(name) {
    const parts = name.trim().split(/\s+/);
    return { first: parts[0] || '', last: parts.slice(1).join(' ') };
  }

  function signUp(name, email, password) {
    name = String(name || '').trim();
    email = norm(email);
    if (!name) return { error: 'Enter your name.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address, like name@example.com.' };
    if (String(password || '').length < 8) return { error: 'Use a password with at least 8 characters.' };
    const a = all();
    if (a[email]) return { error: 'An account with that email already exists. Sign in instead.' };
    const n = splitName(name);
    const user = {
      name, email,
      pw: hash(email + ':' + password),
      createdAt: new Date().toISOString(),
      address: { first: n.first, last: n.last, street: '', city: '', zip: '' },
      subscription: null
    };
    a[email] = user;
    saveAll(a);
    Store.set(SESSION, email);
    return { user };
  }

  function signIn(email, password) {
    email = norm(email);
    const u = all()[email];
    if (!u || u.pw !== hash(email + ':' + password)) {
      return { error: "That email and password don't match an account in this browser." };
    }
    Store.set(SESSION, email);
    return { user: u };
  }

  function signOut() { Store.remove(SESSION); }

  function deleteAccount() {
    const u = current();
    if (!u) return;
    const a = all();
    delete a[u.email];
    saveAll(a);
    signOut();
  }

  // A ready-made account with a few months of history, for quick walkthroughs.
  function useSample() {
    const now = new Date().toISOString();
    const started = addDays(addMonths(now, -4), 6);
    const pool = ['amber-hour', 'velvet-fig', 'midnight-iris', 'copper-leaf', 'smoked-cedar'];
    const picks = ['velvet-fig', 'copper-leaf', 'amber-hour', 'midnight-iris'];
    const history = picks.map((id, i) => ({
      date: addMonths(started, i),
      fragranceId: id,
      mode: 'random',
      price: averagePrice(pool),
      status: 'delivered',
      orderNumber: newOrderNumber()
    }));
    const user = {
      name: 'Jordan Reyes',
      email: 'jordan@example.com',
      pw: hash('jordan@example.com:sillage-demo'),
      createdAt: addDays(started, -2),
      address: { first: 'Jordan', last: 'Reyes', street: '128 Amberwood Lane', city: 'Portland', zip: '97201' },
      subscription: {
        mode: 'random',
        selection: null,
        pool,
        status: 'active',
        startedAt: started,
        nextShip: addMonths(started, 4),
        skippedDate: null,
        pausedUntil: null,
        prePauseNext: null,
        cancelledAt: null,
        cancelReason: '',
        history
      }
    };
    save(user);
    Store.set(SESSION, user.email);
    return user;
  }

  return { current, save, signUp, signIn, signOut, deleteAccount, useSample };
})();

/* ---------- subscriptions ---------- */
const Sub = {
  price(sub) {
    if (sub.mode === 'chosen') return totalPrice(subSelections(sub));
    return averagePrice(sub.pool);
  },

  pick(sub) {
    if (sub.mode === 'chosen') return subSelections(sub)[0];
    const pool = sub.pool && sub.pool.length ? sub.pool : FRAGRANCES.map(f => f.id);
    return pool[Math.floor(Math.random() * pool.length)];
  },

  shipment(sub, date, status) {
    const order = { date, fragranceId: Sub.pick(sub), mode: sub.mode, price: Sub.price(sub), status, orderNumber: newOrderNumber() };
    if (sub.mode === 'chosen') order.items = subSelections(sub).slice();
    return order;
  },

  // Where an order is in its (simulated) journey: 1 placed, 2 preparing, 3 shipped, 4 delivered
  stage(order) {
    if (order.status === 'delivered') return 4;
    const days = (Date.now() - new Date(order.date)) / 864e5;
    return days >= 3 ? 3 : 2;
  },

  create(mode, selections, pool) {
    const now = new Date().toISOString();
    const sub = {
      mode,
      selection: null,
      selections: mode === 'chosen' ? selections.slice() : [],
      pool: pool && pool.length ? pool.slice() : FRAGRANCES.map(f => f.id),
      status: 'active',
      startedAt: now,
      nextShip: addMonths(now, 1),
      skippedDate: null,
      pausedUntil: null,
      prePauseNext: null,
      cancelledAt: null,
      cancelReason: '',
      history: []
    };
    sub.history.push(Sub.shipment(sub, now, 'preparing'));
    return sub;
  },

  // Moves time forward: delivers old orders, ships due bottles, ends finished pauses.
  catchUp(sub) {
    if (!sub) return sub;
    const now = new Date();
    if (sub.status === 'paused' && sub.pausedUntil && new Date(sub.pausedUntil) <= now) {
      sub.status = 'active';
      sub.pausedUntil = null;
      sub.prePauseNext = null;
    }
    if (sub.status === 'active') {
      let guard = 0;
      while (new Date(sub.nextShip) <= now && guard < 24) {
        sub.history.push(Sub.shipment(sub, sub.nextShip, 'preparing'));
        sub.nextShip = addMonths(sub.nextShip, 1);
        guard++;
      }
    }
    if (sub.skippedDate && new Date(sub.skippedDate) <= now) sub.skippedDate = null;
    sub.history.forEach(h => {
      if (!h.orderNumber) h.orderNumber = newOrderNumber();
      if (h.status === 'preparing' && (now - new Date(h.date)) > 5 * 864e5) h.status = 'delivered';
    });
    return sub;
  }
};

/* ---------- mobile menu ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.site-nav');
  const toggle = document.querySelector('.nav-toggle');
  if (!nav || !toggle) return;
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
});
