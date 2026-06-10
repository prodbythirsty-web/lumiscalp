'use strict';

/* ── PRICING (must mirror order.js server-side prices exactly) ── */
// LED pricing per cap
const LED_PRICES = {
  56:  { price: 69.00,  was: 139.99 },
  100: { price: 79.00,  was: 159.99 },
};

// Bundle multipliers & structure
// bundle key = number of caps
const BUNDLES_META = {
  1: { qty: 1, label: 'LumiScalp Cap',          sub: 'Cap only' },
  2: { qty: 1, label: 'Cap + 45-Day Serum',      sub: 'Cap & serum supply' },
};

// Serum add-on price for bundle 2
const SERUM_PRICE = 9.99;

const GUARANTEE_PRICE = 9.99;

let selLED      = 56;
let selBundle   = 2;
let cartItems   = [];
let guarantees  = { 1: false, 2: true }; // bundle -> guarantee on/off

/* ── LED TOGGLE ── */
function setLED(count) {
  selLED = count;
  document.querySelectorAll('.led-btn').forEach(btn => btn.classList.remove('active'));
  const target = document.getElementById('led-' + count);
  if (target) target.classList.add('active');
  updateAllPrices();
}

/* ── PRICE COMPUTATION ── */
function bundlePrice(bundleKey) {
  const base = LED_PRICES[selLED].price * BUNDLES_META[bundleKey].qty;
  return bundleKey === 2 ? base + SERUM_PRICE : base;
}
function bundleWas(bundleKey) {
  const base = LED_PRICES[selLED].was * BUNDLES_META[bundleKey].qty;
  return bundleKey === 2 ? base + SERUM_PRICE : base;
}
function bundleTotal(bundleKey) {
  const base = bundlePrice(bundleKey);
  const g    = guarantees[bundleKey] ? GUARANTEE_PRICE : 0;
  return base + g;
}

function updateAllPrices() {
  // Hero price (reflects selected bundle)
  const heroPrice = document.getElementById('hero-price');
  const heroWas   = document.getElementById('hero-was');
  if (heroPrice) heroPrice.textContent = '$' + bundleTotal(selBundle).toFixed(2);
  if (heroWas)   heroWas.textContent   = '$' + bundleWas(selBundle).toFixed(2);

  // Bundle 1 prices
  const b1p = document.getElementById('b1-price');
  const b1w = document.getElementById('b1-was');
  if (b1p) b1p.textContent = '$' + bundleTotal(1).toFixed(2);
  if (b1w) b1w.textContent = '$' + bundleWas(1).toFixed(2);

  // Bundle 2 prices
  const b2p = document.getElementById('b2-price');
  const b2w = document.getElementById('b2-was');
  if (b2p) b2p.textContent = '$' + bundleTotal(2).toFixed(2);
  if (b2w) b2w.textContent = '$' + bundleWas(2).toFixed(2);

  // Bundle 2 cap sub-item price (cap only, no serum markup)
  const b2cp = document.getElementById('b2-cap-price');
  const b2cw = document.getElementById('b2-cap-was');
  const capPrice = LED_PRICES[selLED].price;
  const capWas   = LED_PRICES[selLED].was;
  if (b2cp) b2cp.textContent = '$' + capPrice.toFixed(2);
  if (b2cw) b2cw.textContent = '$' + capWas.toFixed(2);

  // Total row + ATC
  const totalEl  = document.getElementById('total-price');
  const atcPrice = document.getElementById('atc-price');
  const t = bundleTotal(selBundle).toFixed(2);
  if (totalEl)  totalEl.textContent  = '$' + t;
  if (atcPrice) atcPrice.textContent = '$' + t;
}

/* ── GUARANTEE TOGGLE ── */
function toggleGuarantee(bundleKey) {
  guarantees[bundleKey] = !guarantees[bundleKey];
  const el = document.getElementById('guarantee-check-' + bundleKey);
  if (el) {
    el.classList.toggle('checked', guarantees[bundleKey]);
    el.textContent = guarantees[bundleKey] ? '✓' : '';
  }
  updateAllPrices();
}

/* ── BUNDLE SELECT ── */
function selectBundle(n) {
  selBundle = n;
  [1, 2].forEach(i => {
    const c   = document.getElementById('card-' + i);
    const sel = (i === n);
    c.classList.toggle('selected', sel);
    c.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  updateAllPrices();
}

/* ── MEDIA SWITCHER ── */
function switchMedia(btn, type, src, label) {
  const img = document.getElementById('main-img');
  const vid = document.getElementById('main-video');
  if (type === 'video') {
    img.style.display = 'none';
    vid.style.display = 'block';
    if (vid.src !== src) { vid.src = src; }
    vid.play();
  } else {
    vid.style.display = 'none';
    img.style.display = 'block';
    img.src = src;
    img.alt = 'LumiScalp Hair Therapy Cap \u2014 ' + label;
  }
  document.querySelectorAll('.thumb').forEach(t => {
    t.setAttribute('aria-selected', t === btn ? 'true' : 'false');
    t.classList.toggle('active', t === btn);
  });
}
function switchImg(btn, src, label) { switchMedia(btn, 'image', src, label); }

/* ── CART ── */
function getCartItemPrice(item) {
  const base = LED_PRICES[item.led].price * BUNDLES_META[item.bundle].qty;
  const serumCost = (item.bundle === 2 && item.serum !== false) ? SERUM_PRICE : 0;
  return base + serumCost + (item.guarantee ? GUARANTEE_PRICE : 0);
}

function cartTotal() {
  return cartItems.reduce((sum, item) => sum + getCartItemPrice(item), 0);
}

function renderCart() {
  const itemsEl  = document.getElementById('drawer-items');
  const footerEl = document.getElementById('drawer-footer');
  const emptyEl  = document.getElementById('empty-cart');
  const THUMB    = 'hat1.jpg';

  if (!cartItems.length) {
    if (emptyEl)  emptyEl.style.display  = 'block';
    if (footerEl) footerEl.style.display = 'none';
    if (itemsEl)  itemsEl.innerHTML = '';
    return;
  }

  if (emptyEl)  emptyEl.style.display  = 'none';
  if (footerEl) footerEl.style.display = 'block';

  let html = '';
  cartItems.forEach((item, idx) => {
    const capPrice = LED_PRICES[item.led].price;
    const hasSerum = item.bundle === 2 && item.serum !== false;
    const hasMassager = item.massager !== false; // included by default
    const hasGuar  = !!item.guarantee;

    // ── Cap row (always present) ──
    html += `
      <div class="cart-item">
        <div class="cart-item-top">
          <img class="cart-item-img" src="${THUMB}" alt="LumiScalp Hair Therapy Cap">
          <div class="cart-item-info">
            <div class="cart-item-name">LumiScalp Hair Therapy Cap (${item.led} LEDs)</div>
            <div class="cart-item-detail">Red Light Therapy</div>
            <div class="cart-item-price">$${capPrice.toFixed(2)}</div>
          </div>
        </div>
        <div class="cart-item-bottom">
          <span style="font-size:11px;color:var(--text-secondary,#a09a94)">Qty: 1</span>
          <button class="cart-item-remove" onclick="removeItem(${idx})" aria-label="Remove cap">Remove cap</button>
        </div>
      </div>`;

    // ── Free scalp massager row ──
    if (hasMassager) {
      html += `
        <div class="cart-item cart-addon-row">
          <div class="cart-item-top">
            <div class="cart-item-img" style="display:flex;align-items:center;justify-content:center;font-size:22px;background:#1a1a1e;border-radius:6px;width:52px;height:52px;flex-shrink:0">💆</div>
            <div class="cart-item-info">
              <div class="cart-item-name" style="font-size:12px">Scalp Massager</div>
              <div class="cart-item-detail" style="color:#4ade80;font-weight:600">Included free</div>
              <div class="cart-item-price" style="color:#4ade80">FREE</div>
            </div>
          </div>
          <div class="cart-item-bottom">
            <span></span>
            <button class="cart-item-remove" onclick="removeMassager(${idx})">Remove</button>
          </div>
        </div>`;
    }

    // ── Copper Hair Serum row (bundle 2 only) ──
    if (item.bundle === 2 && hasSerum) {
      html += `
        <div class="cart-item cart-addon-row">
          <div class="cart-item-top">
            <div class="cart-item-img" style="display:flex;align-items:center;justify-content:center;font-size:22px;background:#1a1a1e;border-radius:6px;width:52px;height:52px;flex-shrink:0">✨</div>
            <div class="cart-item-info">
              <div class="cart-item-name" style="font-size:12px">45-Day Copper Hair Growth Serum</div>
              <div class="cart-item-detail">+$${SERUM_PRICE.toFixed(2)}</div>
              <div class="cart-item-price">$${SERUM_PRICE.toFixed(2)}</div>
            </div>
          </div>
          <div class="cart-item-bottom">
            <span></span>
            <button class="cart-item-remove" onclick="toggleSerum(${idx})">Remove</button>
          </div>
        </div>`;
    }

    // ── 90-Day Guarantee row ──
    if (hasGuar) {
      html += `
        <div class="cart-item cart-addon-row">
          <div class="cart-item-top">
            <div class="cart-item-img" style="display:flex;align-items:center;justify-content:center;font-size:22px;background:#1a1a1e;border-radius:6px;width:52px;height:52px;flex-shrink:0">🛡️</div>
            <div class="cart-item-info">
              <div class="cart-item-name" style="font-size:12px">90-Day Money-Back Guarantee</div>
              <div class="cart-item-detail">+$${GUARANTEE_PRICE.toFixed(2)}</div>
              <div class="cart-item-price">$${GUARANTEE_PRICE.toFixed(2)}</div>
            </div>
          </div>
          <div class="cart-item-bottom">
            <span></span>
            <button class="cart-item-remove" onclick="removeGuarantee(${idx})">Remove</button>
          </div>
        </div>`;
    }
  });

  if (itemsEl) itemsEl.innerHTML = html;

  const drawerTotal = document.getElementById('drawer-total-price');
  if (drawerTotal) drawerTotal.textContent = '$' + cartTotal().toFixed(2);
}

function toggleSerum(idx) {
  cartItems[idx].serum = false;
  updateBadge(); renderCart();
}

function removeMassager(idx) {
  cartItems[idx].massager = false;
  updateBadge(); renderCart();
}

function removeGuarantee(idx) {
  cartItems[idx].guarantee = false;
  updateBadge(); renderCart();
}

function changeBundleQty(idx, delta) {
  const newBundle = cartItems[idx].bundle + delta;
  if (newBundle < 1) { removeItem(idx); return; }
  if (newBundle > 2) return;
  cartItems[idx].bundle = newBundle;
  updateBadge(); renderCart();
}

function removeItem(i) { cartItems.splice(i, 1); updateBadge(); renderCart(); }

function updateBadge() {
  const badge = document.getElementById('cart-badge');
  const n = cartItems.reduce((s, item) => s + BUNDLES_META[item.bundle].qty, 0);
  if (badge) {
    badge.textContent = n;
    badge.classList.toggle('show', n > 0);
  }
}

function addToCart() {
  cartItems.push({
    bundle:    selBundle,
    led:       selLED,
    guarantee: guarantees[selBundle],
    serum:     selBundle === 2,
    massager:  true,
  });
  updateBadge();
  renderCart();
  toast('\u{1F6D2} Added to cart!');
  setTimeout(openCart, 350);
}

function buyNow() {
  cartItems = [{
    bundle:    selBundle,
    led:       selLED,
    guarantee: guarantees[selBundle],
    serum:     selBundle === 2,
    massager:  true,
  }];
  updateBadge();
  renderCart();
  openCheckout();
}

/* ── CART DRAWER ── */
function openCart() {
  renderCart();
  document.getElementById('cart-drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.body.style.overflow = '';
}

/* ── CHECKOUT ── */
function openCheckout() {
  closeCart();
  try { sessionStorage.setItem('ls_cart', JSON.stringify(cartItems)); } catch(e) {}
  window.location.href = '/checkout.html';
}
function closeAll() { closeCart(); }

function resetCart() {
  cartItems = [];
  updateBadge();
  renderCart();
}

/* ── TOAST ── */
let toastTimer = null;
function toast(msg) {
  let t = document.getElementById('ls-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ls-toast';
    t.style.cssText = [
      'position:fixed','bottom:32px','left:50%','transform:translateX(-50%) translateY(20px)',
      'background:#222','color:#f0f0f0',
      'border:1px solid #444',
      'padding:12px 24px','border-radius:40px',
      'font-size:14px','font-weight:600',
      'z-index:9999','opacity:0',
      'transition:opacity .25s,transform .25s',
      'pointer-events:none','white-space:nowrap',
    ].join(';');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2600);
}

/* ── SCROLL REVEAL ── */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* ── ESC KEY ── */
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

/* ── INIT ── */
selectBundle(2);
setLED(56);
renderCart();
updateAllPrices();
