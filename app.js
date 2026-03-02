import { auth, db, signInAnonymously, collection, onSnapshot } from './firebase.js';
import { renderPage, renderCard, showModal } from './render.js';

const pages = ['home', 'apps', 'store', 'profiles'];
let currentPage = 'home';
let dataCache = { apps: [], products: [], profiles: [] };
let listeners = {};
let searchTimeout;
const ADMIN_USERNAME = 'izindatzon';
const ADMIN_PASSWORD = 'qwert67';
const ADMIN_EXPIRY_KEY = 'datzon_admin_expiry';

// UI Elements
const mainContent = document.getElementById('main-content');
const hamburger = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar');
const sidebarClose = document.getElementById('sidebar-close');
const title = document.getElementById('title');
const searchBtn = document.getElementById('search-btn');
const searchContainer = document.getElementById('search-container');
const searchInput = document.getElementById('search-input');
const searchClose = document.getElementById('search-close');
const themeBtn = document.getElementById('theme-btn');
const bottomNav = document.getElementById('bottom-nav');
const navIndicator = document.getElementById('nav-indicator');
const globalOverlay = document.getElementById('global-overlay');
const globalLoader = document.getElementById('global-loader');
const loaderText = document.getElementById('loader-text');
const adminPopup = document.getElementById('admin-popup');
const adminUsername = document.getElementById('admin-username');
const adminPassword = document.getElementById('admin-password');
const adminSubmit = document.getElementById('admin-submit');
const modalClose = document.getElementById('modal-close');
const productModal = document.getElementById('product-modal');

// Init Auth and Load
async function init() {
    try {
        await signInAnonymously(auth);
    } catch (err) {
        console.warn('Auth failed:', err);
    }
    showLoader(true);
    setTimeout(() => {
        showLoader(false);
        switchPage('home');
    }, 3000); // Enforce 3s min loader
    setupListeners();
    setupVirtualization();
    animateLoaderText();
}

function animateLoaderText() {
    let dots = 0;
    setInterval(() => {
        if (globalLoader.classList.contains('hidden')) return;
        dots = (dots + 1) % 4;
        loaderText.textContent = 'Loading' + '.'.repeat(dots);
    }, 500);
}

function showLoader(show) {
    globalOverlay.classList.toggle('hidden', !show);
    globalLoader.classList.toggle('hidden', !show);
}

// Page Switching and Lazy Loading
function switchPage(page) {
    if (page === currentPage) return;
    currentPage = page;
    loadDataForPage(page);
    renderPage(page, dataCache[getDataKey(page)]);
    updateNavIndicator();
    updateActiveNavBtn();
    filterAndRender(); // Initial render with virtualization
}

function getDataKey(page) {
    return page === 'apps' || page === 'home' ? 'apps' : page;
}

function loadDataForPage(page) {
    const key = getDataKey(page);
    if (listeners[key]) return; // Already listening
    listeners[key] = onSnapshot(collection(db, key), snapshot => {
        const newData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        updateCache(key, newData);
        if (currentPage === page || (page === 'home' && currentPage === 'apps')) {
            filterAndRender();
        }
    });
}

function updateCache(key, newData) {
    // Diff and update only changes
    const oldData = dataCache[key];
    const added = newData.filter(n => !oldData.find(o => o.id === n.id));
    const removed = oldData.filter(o => !newData.find(n => n.id === o.id));
    const updated = newData.filter(n => {
        const old = oldData.find(o => o.id === n.id);
        return old && JSON.stringify(old) !== JSON.stringify(n);
    });
    dataCache[key] = newData;
    // Trigger partial renders if needed, but for virtualization, full filterAndRender is fine as it's efficient
}

// Virtualization Setup
let observer;
function setupVirtualization() {
    observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Render if placeholder
                if (entry.target.classList.contains('placeholder')) {
                    const index = parseInt(entry.target.dataset.index);
                    const data = getFilteredData();
                    entry.target.replaceWith(renderCard(data[index], currentPage));
                }
            }
        });
    }, { rootMargin: '200px' }); // Buffer
}

function filterAndRender() {
    const container = document.getElementById(`${currentPage}-list`);
    if (!container) return;
    container.innerHTML = '';
    const filtered = getFilteredData();
    const itemHeight = 72; // Estimated
    const viewportHeight = window.innerHeight;
    const buffer = 4;
    const start = Math.max(0, Math.floor(container.scrollTop / itemHeight) - buffer);
    const end = Math.min(filtered.length, start + Math.ceil(viewportHeight / itemHeight) + buffer * 2);

    for (let i = 0; i < filtered.length; i++) {
        if (i >= start && i < end) {
            const card = renderCard(filtered[i], currentPage);
            container.appendChild(card);
            observer.observe(card);
        } else {
            const placeholder = document.createElement('div');
            placeholder.style.height = `${itemHeight}px`;
            placeholder.classList.add('placeholder');
            placeholder.dataset.index = i;
            container.appendChild(placeholder);
            observer.observe(placeholder);
        }
    }
}

function getFilteredData() {
    const query = searchInput.value.toLowerCase();
    const data = dataCache[getDataKey(currentPage)];
    const filter = document.querySelector('.filter-btn.active')?.dataset.cat || 'all';
    return data.filter(item => {
        const catMatch = filter === 'all' || (Array.isArray(item.category) ? item.category.includes(filter.toUpperCase()) : item.category === filter.toUpperCase());
        const nameMatch = item.name.toLowerCase().includes(query);
        return catMatch && nameMatch;
    });
}

// Search
searchBtn.addEventListener('click', () => searchContainer.classList.remove('hidden'));
searchClose.addEventListener('click', () => searchContainer.classList.add('hidden'));
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterAndRender, 120);
});

// Theme Toggle
themeBtn.addEventListener('click', () => {
    const isLight = document.documentElement.dataset.theme === 'light';
    document.documentElement.dataset.theme = isLight ? 'dark' : 'light';
    document.getElementById('sun-icon').classList.toggle('active', !isLight);
    document.getElementById('moon-icon').classList.toggle('active', isLight);
});

// Sidebar
hamburger.addEventListener('click', () => sidebar.classList.remove('hidden'));
sidebarClose.addEventListener('click', () => sidebar.classList.add('hidden'));
sidebar.addEventListener('click', e => {
    if (e.target.tagName === 'LI') {
        const page = e.target.dataset.page;
        if (page) switchPage(page);
        if (e.target.id === 'feedback-link') location.href = 'feedback.html';
        if (e.target.id === 'about-link') location.href = 'about.html';
        sidebar.classList.add('hidden');
    }
});

// Bottom Nav Drag
let isDragging = false;
bottomNav.addEventListener('touchstart', e => {
    isDragging = true;
    // Drag logic similar to old, snap to nearest
}, { passive: true });
bottomNav.addEventListener('touchmove', e => {
    if (!isDragging) return;
    // Update indicator position
}, { passive: true });
bottomNav.addEventListener('touchend', () => {
    isDragging = false;
    // Snap to closest btn
});
bottomNav.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
});

function updateNavIndicator() {
    const activeBtn = bottomNav.querySelector(`.nav-btn[data-page="${currentPage}"]`);
    if (activeBtn) {
        navIndicator.style.left = `${activeBtn.offsetLeft}px`;
        navIndicator.style.width = `${activeBtn.offsetWidth}px`;
    }
}

function updateActiveNavBtn() {
    bottomNav.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.page === currentPage));
}

// Admin
title.addEventListener('click', checkAdmin);
function checkAdmin() {
    const expiry = localStorage.getItem(ADMIN_EXPIRY_KEY);
    if (expiry && Date.now() < parseInt(expiry)) {
        location.href = 'admin.html';
    } else {
        showAdminPopup();
    }
}

function showAdminPopup() {
    globalOverlay.classList.remove('hidden');
    adminPopup.classList.remove('hidden');
}

adminSubmit.addEventListener('click', () => {
    if (adminUsername.value === ADMIN_USERNAME && adminPassword.value === ADMIN_PASSWORD) {
        localStorage.setItem(ADMIN_EXPIRY_KEY, Date.now() + 3600000); // 1 hour
        location.href = 'admin.html';
    } else {
        alert('Invalid credentials');
    }
});

// Modal Close
modalClose.addEventListener('click', () => {
    productModal.classList.add('hidden');
    globalOverlay.classList.add('hidden');
});

// Product Click Handler (global delegate)
mainContent.addEventListener('click', e => {
    if (e.target.closest('.card[data-type="product"]')) {
        const id = e.target.closest('.card').dataset.id;
        const product = dataCache.products.find(p => p.id === id);
        showModal(product);
    }
});

// Scroll Listener for Virtualization
mainContent.addEventListener('scroll', filterAndRender, { passive: true });

init();
