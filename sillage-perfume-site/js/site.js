/* Sillage — shared site code: cloud accounts, subscriptions, mobile menu.
   Accounts use Firebase Authentication and Cloud Firestore, so they sync
   across devices. This is still a front-end demo: a real store also needs
   a payment provider and server-side order handling. */

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

/* ---------- accounts ----------
   Firebase Authentication + Cloud Firestore. Accounts live in the cloud,
   so signing in works on any device; a per-device cache keeps pages
   rendering instantly and working offline. */
const Auth = (function () {
  const CACHE = 'sillage_profiles';  // { uid: profile } cached on this device
  const SESSION = 'sillage_session'; // uid of the account last used here
  const SAMPLE = 'sample';

  let uid = null;     // current account id (Firebase uid, or 'sample')
  let profile = null; // current account data

  function cacheGet(id) { return (Store.get(CACHE, {}) || {})[id] || null; }
  function cacheSet(id, p) { const all = Store.get(CACHE, {}) || {}; all[id] = p; Store.set(CACHE, all); }
  function cacheRemove(id) { const all = Store.get(CACHE, {}) || {}; delete all[id]; Store.set(CACHE, all); }

  function hasCloud() { return typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0; }
  function userDoc(id) { return firebase.firestore().collection('users').doc(id); }

  // Tell the page fresh account data is available so it can re-render.
  function emit() { document.dispatchEvent(new CustomEvent('sillage:auth')); }

  // Restore this device's last session instantly, from cache.
  (function restore() {
    const id = Store.get(SESSION, null);
    if (id) { uid = id; profile = cacheGet(id); }
  })();

  function splitName(name) {
    const parts = name.trim().split(/\s+/);
    return { first: parts[0] || '', last: parts.slice(1).join(' ') };
  }

  function friendlyError(code) {
    return {
      'auth/email-already-in-use': 'An account with that email already exists. Sign in instead.',
      'auth/invalid-email': 'Enter a valid email address, like name@example.com.',
      'auth/weak-password': 'Use a password with at least 8 characters.',
      'auth/invalid-credential': "That email and password don't match an account.",
      'auth/wrong-password': "That email and password don't match an account.",
      'auth/user-not-found': "That email and password don't match an account.",
      'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
      'auth/network-request-failed': "Can't reach the server. Check your connection and try again."
    }[code] || 'Something went wrong. Please try again.';
  }

  // Keep the session in step with Firebase: paint from cache instantly, then
  // refresh from the cloud so changes made on other devices show up here.
  if (hasCloud()) {
    firebase.auth().onAuthStateChanged(u => {
      if (u) {
        uid = u.uid;
        Store.set(SESSION, uid);
        profile = cacheGet(uid) || {
          name: u.displayName || '',
          email: u.email || '',
          createdAt: new Date().toISOString(),
          address: null,
          subscription: null
        };
        cacheSet(uid, profile);
        emit();
        userDoc(uid).get().then(snap => {
          if (snap.exists) {
            const cloud = snap.data();
            if (JSON.stringify(cloud) !== JSON.stringify(profile)) {
              profile = cloud;
              cacheSet(uid, cloud);
            }
          } else {
            userDoc(uid).set(profile).catch(() => {});
          }
          emit();
        }).catch(() => {});
      } else {
        const id = Store.get(SESSION, null);
        if (id === SAMPLE) { uid = SAMPLE; profile = cacheGet(SAMPLE); }
        else { uid = null; profile = null; }
        emit();
      }
    });
  }

  function current() { return profile; }

  function save(user) {
    if (!uid) return;
    profile = user;
    cacheSet(uid, user);
    if (uid !== SAMPLE && hasCloud()) userDoc(uid).set(user).catch(() => {});
  }

  async function signUp(name, email, password) {
    name = String(name || '').trim();
    email = String(email || '').trim().toLowerCase();
    if (!name) return { error: 'Enter your name.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address, like name@example.com.' };
    if (String(password || '').length < 8) return { error: 'Use a password with at least 8 characters.' };
    if (!hasCloud()) return { error: "Can't reach the server. Check your connection and try again." };
    try {
      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const n = splitName(name);
      const user = {
        name, email,
        createdAt: new Date().toISOString(),
        address: { first: n.first, last: n.last, street: '', city: '', zip: '' },
        subscription: null
      };
      uid = cred.user.uid;
      profile = user;
      Store.set(SESSION, uid);
      cacheSet(uid, user);
      cred.user.updateProfile({ displayName: name }).catch(() => {});
      await userDoc(uid).set(user).catch(() => {});
      return { user };
    } catch (e) {
      return { error: friendlyError(e && e.code) };
    }
  }

  async function signIn(email, password) {
    email = String(email || '').trim().toLowerCase();
    if (!hasCloud()) return { error: "Can't reach the server. Check your connection and try again." };
    try {
      const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
      uid = cred.user.uid;
      Store.set(SESSION, uid);
      try {
        const snap = await userDoc(uid).get();
        if (snap.exists) { profile = snap.data(); cacheSet(uid, profile); }
      } catch (e2) {
        profile = cacheGet(uid);
      }
      if (!profile) {
        profile = { name: cred.user.displayName || '', email, createdAt: new Date().toISOString(), address: null, subscription: null };
        cacheSet(uid, profile);
      }
      return { user: profile };
    } catch (e) {
      return { error: friendlyError(e && e.code) };
    }
  }

  function signOut() {
    if (uid !== SAMPLE && hasCloud()) firebase.auth().signOut().catch(() => {});
    Store.remove(SESSION);
    uid = null;
    profile = null;
  }

  async function deleteAccount() {
    const id = uid;
    if (!id) return;
    if (id !== SAMPLE) {
      try { await userDoc(id).delete(); } catch (e) {}
      const u = hasCloud() ? firebase.auth().currentUser : null;
      if (u) { try { await u.delete(); } catch (e) {} }
    }
    cacheRemove(id);
    Store.remove(SESSION);
    uid = null;
    profile = null;
  }

  // A ready-made account with a few months of history, for quick walkthroughs.
  // Lives only on this device (no real sign-in needed).
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
    uid = SAMPLE;
    profile = user;
    Store.set(SESSION, SAMPLE);
    cacheSet(SAMPLE, user);
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
