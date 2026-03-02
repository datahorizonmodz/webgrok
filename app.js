import { setPageFilter } from "./data.js";

// --- DOM ELEMENTS ---
const html = document.documentElement;
const overlay = document.getElementById('global-overlay');
const sidebar = document.getElementById('sidebar');
const headerTitle = document.getElementById('header-title');
const searchToggle = document.getElementById('search-toggle');
const searchWrapper = document.getElementById('search-wrapper');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const themeBtn = document.getElementById('theme-btn');
const bottomNav = document.getElementById('bottom-nav');
const navIndicator = document.getElementById('nav-indicator');
const navBtns = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page');
const sideLinks = document.querySelectorAll('.side-link:not(.ext)');

// --- TIMING / LOADER LOGIC ---
const START_TIME = Date.now();
let loaderInterval;

export function initLoaderAnimation() {
    const txt = document.getElementById('loader-text');
    let dots = 0;
    loaderInterval = setInterval(() => {
        dots = (dots + 1) % 4;
        txt.textContent = 'Loading' + '.'.repeat(dots);
    }, 400);
}

export function enforceMinLoaderTime(callback) {
    const elapsed = Date.now() - START_TIME;
    if (elapsed >= 3000) {
        finishLoader();
        if(callback) callback();
    } else {
        setTimeout(() => {
            finishLoader();
            if(callback) callback();
        }, 3000 - elapsed);
    }
}

function finishLoader() {
    clearInterval(loaderInterval);
    document.getElementById('loader').classList.remove('active');
    checkActiveOverlays();
}

// --- OVERLAY / MODAL MANAGER ---
export function openModal(id) {
    overlay.classList.add('active');
    const m = document.getElementById(id);
    if(m) m.classList.add('active');
}

export function closeModal(id) {
    const m = document.getElementById(id);
    if(m) m.classList.remove('active');
    checkActiveOverlays();
}

function checkActiveOverlays() {
    const activeLayers = document.querySelectorAll('.modal-layer.active, .sidebar.active');
    if (activeLayers.length === 0) overlay.classList.remove('active');
}

// Bind close buttons
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
overlay.addEventListener('click', () => {
    document.querySelectorAll('.modal-layer').forEach(m => m.classList.remove('active'));
    sidebar.classList.remove('active');
    checkActiveOverlays();
});

// --- SIDEBAR ---
document.getElementById('hamburger').addEventListener('click', () => {
    overlay.classList.add('active');
    sidebar.classList.add('active');
});
document.getElementById('close-sidebar').addEventListener('click', () => {
    sidebar.classList.remove('active');
    checkActiveOverlays();
});

// --- THEME ---
themeBtn.addEventListener('click', () => {
    const isLight = html.getAttribute('data-theme') === 'light';
    html.setAttribute('data-theme', isLight ? 'dark' : 'light');
});

// --- SEARCH ---
searchToggle.addEventListener('click', () => {
    searchWrapper.classList.add('active');
    headerTitle.classList.add('hide');
    searchInput.focus();
});

searchClear.addEventListener('click', () => {
    searchWrapper.classList.remove('active');
    headerTitle.classList.remove('hide');
    searchInput.value = '';
    setPageFilter('');
});

let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        setPageFilter(e.target.value);
    }, 120); // Debounce
});

// --- ADMIN ROUTE ---
headerTitle.addEventListener('click', () => {
    const expiry = localStorage.getItem('datzon_admin_auth_expiry');
    if (expiry && Date.now() < parseInt(expiry)) {
        window.location.href = 'admin.html'; // Assume exists
    } else {
        openModal('admin-modal');
    }
});

document.getElementById('admin-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('admin-user').value;
    const p = document.getElementById('admin-pass').value;
    if (u === 'izindatzon' && p === 'qwert67') {
        localStorage.setItem('datzon_admin_auth_expiry', Date.now() + (60 * 60 * 1000));
        window.location.href = 'admin.html';
    } else {
        const box = document.querySelector('#admin-modal .modal-box');
        box.style.transform = 'translateY(0) translateX(-5px)';
        setTimeout(() => box.style.transform = 'translateY(0) translateX(5px)', 100);
        setTimeout(() => box.style.transform = 'scale(1) translateY(0)', 200);
    }
});

// --- NAVIGATION (Pages & Capsule) ---
export let activePageId = 'apps';

export function updateNavIndicator() {
    const activeBtn = Array.from(navBtns).find(b => b.classList.contains('active'));
    if (!activeBtn) return;
    const btnIdx = Array.from(navBtns).indexOf(activeBtn);
    
    // Calculate boundaries securely so it never overflows
    const indicatorWidth = navIndicator.offsetWidth;
    // 12px represents padding (6px left, 6px right)
    maxTranslateX = bottomNav.offsetWidth - indicatorWidth - 12;
    
    let targetX = 0;
    if (btnIdx === 1) targetX = maxTranslateX / 2;
    if (btnIdx === 2) targetX = maxTranslateX;
    
    baseTranslateX = targetX;
    navIndicator.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s, background 0.2s';
    navIndicator.style.setProperty('--tx', `${targetX}px`);
}

function switchPage(targetId) {
    if(activePageId === targetId) return;
    activePageId = targetId;
    
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + targetId).classList.add('active');
    
    navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.target === targetId));
    sideLinks.forEach(link => link.classList.toggle('active', link.dataset.target === targetId));
    
    sidebar.classList.remove('active');
    if(searchWrapper.classList.contains('active')) searchClear.click(); // Close search neatly
    checkActiveOverlays();
    
    updateNavIndicator();
    window.dispatchEvent(new CustomEvent('pageChanged', { detail: targetId }));
}

navBtns.forEach(btn => btn.addEventListener('click', () => switchPage(btn.dataset.target)));
sideLinks.forEach(link => link.addEventListener('click', (e) => {
    e.preventDefault();
    switchPage(link.dataset.target);
}));

// Bottom Nav Drag Logic (Fully rewritten for perfect clamping like feedback.html)
let isDragging = false, startX = 0;
let baseTranslateX = 0;
let maxTranslateX = 0;

function startNavDrag(e) {
    isDragging = true;
    navIndicator.classList.add('dragging');
    startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    
    // Recalculate max to ensure safety during resize
    maxTranslateX = bottomNav.offsetWidth - navIndicator.offsetWidth - 12; 
    navIndicator.style.setProperty('--scale', '1.05');
}

function moveNavDrag(e) {
    if (!isDragging) return;
    e.preventDefault(); // Stop scrolling while sliding indicator
    const currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const deltaX = currentX - startX;
    
    let newTx = baseTranslateX + deltaX;
    
    // STRICT CLAMPING BOUNDARIES
    if (newTx < 0) newTx = 0;
    if (newTx > maxTranslateX) newTx = maxTranslateX;
    
    navIndicator.style.setProperty('--tx', `${newTx}px`);
}

function endNavDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    navIndicator.classList.remove('dragging');
    navIndicator.style.setProperty('--scale', '1');
    
    const currentTx = parseFloat(navIndicator.style.getPropertyValue('--tx') || 0);
    
    let closestIdx = 0;
    if (currentTx > maxTranslateX * 0.75) closestIdx = 2;
    else if (currentTx > maxTranslateX * 0.25) closestIdx = 1;
    else closestIdx = 0;
    
    switchPage(navBtns[closestIdx].dataset.target);
}

// Attach Touch Events
navIndicator.addEventListener('touchstart', startNavDrag, {passive: false});
window.addEventListener('touchmove', moveNavDrag, {passive: false});
window.addEventListener('touchend', endNavDrag);

// Attach Mouse Events (Desktop Dragging matching feedback.html)
navIndicator.addEventListener('mousedown', startNavDrag);
window.addEventListener('mousemove', moveNavDrag, {passive: false});
window.addEventListener('mouseup', endNavDrag);

// Adjust indicator on resize
window.addEventListener('resize', () => {
    if (!isDragging) updateNavIndicator();
});

// Modal Scroll Indicator Logic
const pmScroll = document.getElementById('pm-scroll-area');
const pmIndicator = document.getElementById('pm-indicator');
if(pmScroll && pmIndicator) {
    pmScroll.addEventListener('scroll', () => {
        const distanceToBottom = pmScroll.scrollHeight - (pmScroll.scrollTop + pmScroll.clientHeight);
        if (distanceToBottom < 10) pmIndicator.style.opacity = '0';
        else pmIndicator.style.opacity = '1';
    }, {passive:true});
}

export function resetProductModalScroll() {
    if(pmScroll) pmScroll.scrollTop = 0;
    setTimeout(() => {
        if(pmScroll.scrollHeight > pmScroll.clientHeight + 5) pmIndicator.style.opacity = '1';
        else pmIndicator.style.opacity = '0';
    }, 50);
}

// Init startup
setTimeout(updateNavIndicator, 100); // Wait for CSS load to position correctly
initLoaderAnimation();
