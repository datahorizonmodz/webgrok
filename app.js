import { setPageFilter } from "./data.js";

// --- DOM ELEMENTS ---
const html = document.documentElement;
const overlay = document.getElementById('global-overlay');
const sidebar = document.getElementById('sidebar');
const headerTitle = document.getElementById('header-title');
const searchToggle = document.getElementById('search-toggle');
const headerSearch = document.getElementById('header-search');
const searchInput = document.getElementById('search-input');
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
    const isActive = headerSearch.classList.contains('active');
    if (isActive) {
        headerSearch.classList.remove('active');
        searchInput.value = '';
        setPageFilter('');
    } else {
        headerSearch.classList.add('active');
        searchInput.focus();
        
        // Add dynamic close button to search bar header visually
        searchToggle.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" style="position:relative; z-index:2;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    }
});

// Reset search icon when closed manually
headerSearch.addEventListener('transitionend', (e) => {
    if(!headerSearch.classList.contains('active') && e.propertyName === 'opacity') {
        searchToggle.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    }
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

function switchPage(targetId) {
    if(activePageId === targetId) return;
    activePageId = targetId;
    
    // UI Update
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + targetId).classList.add('active');
    
    navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.target === targetId));
    sideLinks.forEach(link => link.classList.toggle('active', link.dataset.target === targetId));
    
    // Close Sidebar & Search if open
    sidebar.classList.remove('active');
    if(headerSearch.classList.contains('active')) searchToggle.click();
    checkActiveOverlays();
    
    // Update Indicator Position
    const btnIdx = Array.from(navBtns).findIndex(b => b.dataset.target === targetId);
    if(btnIdx !== -1) navIndicator.style.transform = `translateX(${btnIdx * 100}%)`;

    // Notify data module to render lazy
    window.dispatchEvent(new CustomEvent('pageChanged', { detail: targetId }));
}

navBtns.forEach(btn => btn.addEventListener('click', () => switchPage(btn.dataset.target)));
sideLinks.forEach(link => link.addEventListener('click', (e) => {
    e.preventDefault();
    switchPage(link.dataset.target);
}));

// Bottom Nav Drag Logic
let isDragging = false, startX = 0, currentIdx = 0;
navIndicator.addEventListener('touchstart', (e) => {
    isDragging = true;
    startX = e.touches[0].clientX;
    currentIdx = Array.from(navBtns).findIndex(b => b.classList.contains('active'));
    navIndicator.style.transition = 'none';
}, {passive:true});

document.addEventListener('touchmove', (e) => {
    if(!isDragging) return;
    const deltaX = e.touches[0].clientX - startX;
    const w = bottomNav.offsetWidth / 3;
    let newTx = (currentIdx * w) + deltaX;
    
    // Clamp
    if(newTx < 0) newTx = 0;
    if(newTx > w * 2) newTx = w * 2;
    
    navIndicator.style.transform = `translateX(${newTx}px)`;
}, {passive:false});

document.addEventListener('touchend', (e) => {
    if(!isDragging) return;
    isDragging = false;
    navIndicator.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    
    const w = bottomNav.offsetWidth / 3;
    // Extract matrix tx
    const style = window.getComputedStyle(navIndicator);
    const matrix = new WebKitCSSMatrix(style.transform);
    const finalTx = matrix.m41;
    
    const closestIdx = Math.round(finalTx / w);
    const target = navBtns[closestIdx].dataset.target;
    switchPage(target);
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
initLoaderAnimation();
