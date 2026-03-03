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
const pages = document.querySelectorAll('.page');
const sideLinks = document.querySelectorAll('.side-link:not(.ext)');

// DOCK ELEMENTS
const dock = document.getElementById('mainDock');
const indicator = document.getElementById('dockIndicator');
const tabs = document.querySelectorAll('.dock-tab');

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
        window.location.href = 'admin.html';
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

// --- NAVIGATION & DOCK LOGIC ---
export let activePageId = 'apps';
let isDragging = false, startX = 0;
let baseTranslateX = 0;
let maxTranslateX = 0;

export function updateNavIndicator() {
    const activeTab = Array.from(tabs).find(t => t.dataset.target === activePageId);
    if (!activeTab) return;
    
    const index = parseInt(activeTab.dataset.index);
    const indicatorWidth = indicator.offsetWidth;
    
    // 12px represents padding (6px left, 6px right inside dock)
    maxTranslateX = dock.offsetWidth - indicatorWidth - 12; 
    
    let targetX = 0;
    if (index === 1) targetX = maxTranslateX / 2;
    if (index === 2) targetX = maxTranslateX;
    
    baseTranslateX = targetX;
    indicator.style.transform = `translateX(${targetX}px) scale(1)`;
    
    tabs.forEach((tab, i) => {
        if (i === index) tab.classList.add('active-tab');
        else tab.classList.remove('active-tab');
    });
}

function switchPage(targetId) {
    if(activePageId === targetId) return;
    activePageId = targetId;
    
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + targetId).classList.add('active');
    
    sideLinks.forEach(link => link.classList.toggle('active', link.dataset.target === targetId));
    
    sidebar.classList.remove('active');
    if(searchWrapper.classList.contains('active')) searchClear.click();
    checkActiveOverlays();
    
    updateNavIndicator();
    window.dispatchEvent(new CustomEvent('pageChanged', { detail: targetId }));
}

// Bind Dock Tabs Click
tabs.forEach(tab => tab.addEventListener('click', () => switchPage(tab.dataset.target)));

// Bind Sidebar Links
sideLinks.forEach(link => link.addEventListener('click', (e) => {
    e.preventDefault();
    switchPage(link.dataset.target);
}));

// --- DOCK DRAG & LIFT LOGIC ---
function startDockDrag(e) {
    isDragging = true;
    startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    
    maxTranslateX = dock.offsetWidth - indicator.offsetWidth - 12; 
    indicator.classList.add('lifted');
    indicator.style.transform = `translateX(${baseTranslateX}px) scale(1.05)`;
}

function moveDockDrag(e) {
    if (!isDragging) return;
    e.preventDefault(); // Stop scrolling while sliding indicator
    
    const currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const deltaX = currentX - startX;
    
    let newX = baseTranslateX + deltaX;
    
    // STRICT CLAMPING BOUNDARIES
    if (newX < 0) newX = 0;
    if (newX > maxTranslateX) newX = maxTranslateX;
    
    indicator.style.transform = `translateX(${newX}px) scale(1.05)`;
}

function endDockDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    indicator.classList.remove('lifted');
    
    // Get current transform reliably
    const currentTransform = indicator.style.transform;
    const match = currentTransform.match(/translateX\(([-\d.]+)px\)/);
    const currentX = match ? parseFloat(match[1]) : baseTranslateX;
    
    let targetIndex = 0;
    if (currentX > maxTranslateX * 0.66) {
        targetIndex = 2; // Right Tab
    } else if (currentX > maxTranslateX * 0.33) {
        targetIndex = 1; // Center Tab
    } else {
        targetIndex = 0; // Left Tab
    }
    
    switchPage(tabs[targetIndex].dataset.target);
}

// Attach Drag Events
dock.addEventListener('mousedown', startDockDrag);
window.addEventListener('mousemove', moveDockDrag, {passive: false});
window.addEventListener('mouseup', endDockDrag);

dock.addEventListener('touchstart', startDockDrag, {passive: false});
window.addEventListener('touchmove', moveDockDrag, {passive: false});
window.addEventListener('touchend', endDockDrag);

// Adjust indicator on resize
window.addEventListener('resize', () => {
    if (!isDragging) updateNavIndicator();
});

// --- MODAL SCROLL INDICATOR ---
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
setTimeout(updateNavIndicator, 100);
initLoaderAnimation();
