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
  const capQty       = item.capQty       ?? 1;
  const serumQty     = item.serumQty     ?? (item.bundle === 2 && item.serum !== false ? 1 : 0);
  const massagerQty  = item.massagerQty  ?? (item.massager !== false ? 1 : 0);
  const guaranteeQty = item.guaranteeQty ?? (item.guarantee ? 1 : 0);
  const capPrice     = LED_PRICES[item.led].price;
  return (capPrice * capQty) + (SERUM_PRICE * serumQty) + (GUARANTEE_PRICE * guaranteeQty);
  // massager is free so not added to price
}

function cartTotal() {
  return cartItems.reduce((sum, item) => sum + getCartItemPrice(item), 0);
}

/* ── CART RENDER HELPERS ── */
const TRASH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
const TAG_ICON   = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;

function bundleTagHtml(bundleKey) {
  if (bundleKey === 2) {
    return `<div class="cart-bundle-tag">${TAG_ICON} Cap + 45-Day Serum + Free Gift</div>`;
  }
  return '';
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

  let totalDiscount = 0;
  let html = '';

  cartItems.forEach((item, idx) => {
    const capPrice    = LED_PRICES[item.led].price;
    const capWas      = LED_PRICES[item.led].was;
    const capQty      = item.capQty      ?? 1;
    const serumQty    = item.serumQty    ?? (item.bundle === 2 && item.serum !== false ? 1 : 0);
    const massagerQty = item.massagerQty ?? (item.massager !== false ? 1 : 0);
    const guarQty     = item.guaranteeQty ?? (item.guarantee ? 1 : 0);

    // ── Cap row ──
    html += `
      <div class="cart-item">
        <div class="cart-item-top">
          <img class="cart-item-img" src="${THUMB}" alt="LumiScalp Hair Therapy Cap">
          <div class="cart-item-info">
            <div class="cart-item-name">LumiScalp Hair Therapy Cap</div>
            <div class="cart-item-detail">${item.led}-LED Red Light Therapy</div>
            <div class="cart-item-price-row">
              <span class="cart-item-price">$${capPrice.toFixed(2)}</span>
              <span class="cart-item-was">$${capWas.toFixed(2)}</span>
            </div>
          </div>
          <button class="cart-item-trash" onclick="removeItem(${idx})" aria-label="Remove">${TRASH_ICON}</button>
        </div>
        <div class="cart-item-bottom">
          <div class="qty-stepper">
            <button class="qty-btn" onclick="adjustQty(${idx},'capQty',-1)">−</button>
            <span class="qty-num">${capQty}</span>
            <button class="qty-btn" onclick="adjustQty(${idx},'capQty',1)">+</button>
          </div>
          <span class="cart-item-price-sm">$${(capPrice * capQty).toFixed(2)}</span>
        </div>
      </div>`;

    totalDiscount += (capWas - capPrice) * capQty;

    // ── Free scalp massager row ──
    if (massagerQty > 0) {
      html += `
        <div class="cart-item cart-addon-row">
          <div class="cart-item-top">
            <div class="cart-item-img cart-item-emoji-img">💆</div>
            <div class="cart-item-info">
              <div class="cart-item-name" style="font-size:12px">Scalp Massager</div>
              ${bundleTagHtml(item.bundle)}
              <div class="cart-item-price-row">
                <span class="cart-item-price cart-price-free">FREE</span>
                <span class="cart-item-was">$9.99</span>
              </div>
            </div>
            <button class="cart-item-trash" onclick="adjustQty(${idx},'massagerQty',-(cartItems[${idx}].massagerQty??1))" aria-label="Remove">${TRASH_ICON}</button>
          </div>
          <div class="cart-item-bottom">
            <div class="qty-stepper">
              <button class="qty-btn" onclick="adjustQty(${idx},'massagerQty',-1)">−</button>
              <span class="qty-num">${massagerQty}</span>
              <button class="qty-btn" onclick="adjustQty(${idx},'massagerQty',1)">+</button>
            </div>
            <span class="cart-item-price-sm cart-price-free">$0.00</span>
          </div>
        </div>`;
      totalDiscount += 9.99 * massagerQty;
    }

    // ── Serum row (bundle 2) ──
    if (item.bundle === 2 && serumQty > 0) {
      const serumWas = 16.65;
      const saving   = serumWas - SERUM_PRICE;
      html += `
        <div class="cart-item cart-addon-row">
          <div class="cart-item-top">
            <div class="cart-item-img cart-item-emoji-img">✨</div>
            <div class="cart-item-info">
              <div class="cart-item-name" style="font-size:12px">45-Day Copper Hair Growth Serum</div>
              ${bundleTagHtml(item.bundle)}
              <div class="cart-item-price-row">
                <span class="cart-item-price">$${SERUM_PRICE.toFixed(2)}</span>
                <span class="cart-item-was">$${serumWas.toFixed(2)}</span>
              </div>
              <div class="cart-savings-pill">$${saving.toFixed(2)} Savings</div>
            </div>
            <button class="cart-item-trash" onclick="adjustQty(${idx},'serumQty',-(cartItems[${idx}].serumQty??1))" aria-label="Remove">${TRASH_ICON}</button>
          </div>
          <div class="cart-item-bottom">
            <div class="qty-stepper">
              <button class="qty-btn" onclick="adjustQty(${idx},'serumQty',-1)">−</button>
              <span class="qty-num">${serumQty}</span>
              <button class="qty-btn" onclick="adjustQty(${idx},'serumQty',1)">+</button>
            </div>
            <span class="cart-item-price-sm">$${(SERUM_PRICE * serumQty).toFixed(2)}</span>
          </div>
        </div>`;
      totalDiscount += saving * serumQty;
    }

    // ── Guarantee row ──
    if (guarQty > 0) {
      html += `
        <div class="cart-item cart-addon-row">
          <div class="cart-item-top">
            <div class="cart-item-img cart-item-emoji-img">🛡️</div>
            <div class="cart-item-info">
              <div class="cart-item-name" style="font-size:12px">90-Day Money-Back Guarantee</div>
              <div class="cart-item-price-row">
                <span class="cart-item-price">$${GUARANTEE_PRICE.toFixed(2)}</span>
              </div>
            </div>
            <button class="cart-item-trash" onclick="adjustQty(${idx},'guaranteeQty',-(cartItems[${idx}].guaranteeQty??1))" aria-label="Remove">${TRASH_ICON}</button>
          </div>
          <div class="cart-item-bottom">
            <div class="qty-stepper">
              <button class="qty-btn" onclick="adjustQty(${idx},'guaranteeQty',-1)">−</button>
              <span class="qty-num">${guarQty}</span>
              <button class="qty-btn" onclick="adjustQty(${idx},'guaranteeQty',1)">+</button>
            </div>
            <span class="cart-item-price-sm">$${(GUARANTEE_PRICE * guarQty).toFixed(2)}</span>
          </div>
        </div>`;
    }
  });

  if (itemsEl) itemsEl.innerHTML = html;

  // Update header count
  const countEl = document.getElementById('drawer-item-count');
  if (countEl) {
    const totalUnits = cartItems.reduce((s, item) => {
      return s + (item.capQty ?? 1) + (item.massagerQty ?? 1) + (item.serumQty ?? 0) + (item.guaranteeQty ?? 0);
    }, 0);
    countEl.textContent = totalUnits;
  }

  const drawerTotal    = document.getElementById('drawer-total-price');
  const discountRow    = document.getElementById('drawer-discount-row');
  const discountAmount = document.getElementById('drawer-discount-amount');

  if (drawerTotal) drawerTotal.textContent = '$' + cartTotal().toFixed(2) + ' USD';

  if (totalDiscount > 0) {
    if (discountRow)    discountRow.style.display = 'flex';
    if (discountAmount) discountAmount.textContent = '$' + totalDiscount.toFixed(2);
  } else {
    if (discountRow) discountRow.style.display = 'none';
  }
}

// Single unified qty adjuster for all item fields
function adjustQty(idx, field, delta) {
  const item = cartItems[idx];
  const current = item[field] ?? 0;
  const next = current + delta;
  if (next <= 0) {
    // If it's the cap hitting 0, remove the whole cart item
    if (field === 'capQty') { removeItem(idx); return; }
    item[field] = 0;
  } else {
    item[field] = next;
  }
  // Keep legacy boolean flags in sync
  if (field === 'serumQty')     item.serum     = item.serumQty > 0;
  if (field === 'massagerQty')  item.massager  = item.massagerQty > 0;
  if (field === 'guaranteeQty') item.guarantee = item.guaranteeQty > 0;
  updateBadge(); renderCart();
}

function toggleSerum(idx) { adjustQty(idx, 'serumQty', -(cartItems[idx].serumQty ?? 1)); }
function removeMassager(idx) { adjustQty(idx, 'massagerQty', -(cartItems[idx].massagerQty ?? 1)); }
function removeGuarantee(idx) { adjustQty(idx, 'guaranteeQty', -(cartItems[idx].guaranteeQty ?? 1)); }

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
    bundle:       selBundle,
    led:          selLED,
    guarantee:    guarantees[selBundle],
    serum:        selBundle === 2,
    massager:     true,
    capQty:       1,
    serumQty:     selBundle === 2 ? 1 : 0,
    massagerQty:  1,
    guaranteeQty: guarantees[selBundle] ? 1 : 0,
  });
  updateBadge();
  renderCart();
  toast('\u{1F6D2} Added to cart!');
  setTimeout(openCart, 350);
}

function buyNow() {
  cartItems = [{
    bundle:       selBundle,
    led:          selLED,
    guarantee:    guarantees[selBundle],
    serum:        selBundle === 2,
    massager:     true,
    capQty:       1,
    serumQty:     selBundle === 2 ? 1 : 0,
    massagerQty:  1,
    guaranteeQty: guarantees[selBundle] ? 1 : 0,
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
selectBundle(1);
setLED(56);
renderCart();
updateAllPrices();

/* ── STICKY NAV: hide on scroll down, show on scroll up ── */
(function() {
  var nav = document.querySelector('nav');
  if (!nav) return;
  var lastY = 0;
  var ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(function() {
        var y = window.scrollY;
        if (y > lastY && y > 80) {
          // scrolling down — hide nav
          nav.classList.add('nav-hidden');
        } else {
          // scrolling up — show nav
          nav.classList.remove('nav-hidden');
        }
        nav.classList.toggle('nav-scrolled', y > 10);
        lastY = y;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();
