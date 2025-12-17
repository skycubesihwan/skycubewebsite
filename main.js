// ========================================
// Configuration and Data Loading
// ========================================
// Data is now loaded from config.js and news.js
let config = siteConfig;  // siteConfig is defined in config.js

// Initialize the site
function init() {
    try {
        // Apply theme
        applyTheme();

        // Render all sections
        renderNavigation();
        renderHero();
        renderNews();
        renderFooter();

        // Initialize event listeners
        initEventListeners();

    } catch (error) {
        console.error('Error initializing site:', error);
    }
}

// ========================================
// Theme Application
// ========================================
function applyTheme() {
    const root = document.documentElement;
    const theme = config.theme;

    // Apply CSS variables from config
    if (theme) {
        root.style.setProperty('--primary-color', theme.primaryColor);
        root.style.setProperty('--secondary-color', theme.secondaryColor);
        root.style.setProperty('--accent-color', theme.accentColor);
        root.style.setProperty('--text-color', theme.textColor);
        root.style.setProperty('--light-text-color', theme.lightTextColor);
        root.style.setProperty('--bg-color', theme.backgroundColor);
        root.style.setProperty('--dark-bg-color', theme.darkBackgroundColor);
    }

    // Apply hero background
    const hero = document.querySelector('.hero');
    const heroConfig = config.hero;
    if (hero && heroConfig) {
        if (heroConfig.backgroundImage) {
            hero.style.backgroundImage = `url('${heroConfig.backgroundImage}')`;
        }
        const overlay = document.querySelector('.hero-overlay');
        if (overlay && heroConfig.backgroundOverlay) {
            overlay.style.background = heroConfig.backgroundOverlay;
        }
    }

    // Update site title
    if (config.site && config.site.title) {
        document.title = config.site.title;
    }
}

// ========================================
// Navigation Rendering
// ========================================
function renderNavigation() {
    const navMenu = document.getElementById('nav-menu');
    const nav = config.navigation;

    if (!nav) return;

    // Detect if we're in a subdirectory
    const pathPrefix = window.location.pathname.includes('/news/') ? '../' : '';

    // Render menu items
    if (navMenu && nav.menuItems) {
        navMenu.innerHTML = nav.menuItems.map(item => `
            <li><a href="${pathPrefix}${item.link}">${item.label}</a></li>
        `).join('');
    }
}

// ========================================
// Hero Section Rendering
// ========================================
function renderHero() {
    const hero = config.hero;
    if (!hero) return;

    const title = document.getElementById('hero-title');
    const subtitle = document.getElementById('hero-subtitle');
    const cta = document.getElementById('hero-cta');

    if (title) title.textContent = hero.title || '';
    if (subtitle) subtitle.textContent = hero.subtitle || '';
    if (cta) {
        cta.textContent = hero.ctaText || 'Contact Us';
        cta.href = hero.ctaLink || '#contact';
    }
}

// ========================================
// News Section Rendering
// ========================================
function renderNews() {
    if (!newsData.news) return;

    const newsGrid = document.getElementById('news-grid');

    // Render all news items
    if (newsGrid) {
        newsGrid.innerHTML = newsData.news.map(item => `
            <a href="${item.link}" class="news-item" data-id="${item.id}">
                <div class="news-item-header">
                    <h3 class="news-item-title">${item.title}</h3>
                    <span class="news-item-date">${formatDate(item.date)}</span>
                </div>
                <p class="news-item-summary">${item.summary}</p>
            </a>
        `).join('');
    }
}

// Helper function to format date
function formatDate(dateString) {
    // Parse date string directly to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ========================================
// Footer Rendering
// ========================================
function renderFooter() {
    const footer = config.footer;
    if (!footer) return;

    const logoText = document.getElementById('footer-logo-text');
    const copyright = document.getElementById('footer-copyright');
    const socialLinks = document.getElementById('footer-social');

    if (logoText && config.navigation?.logoText) {
        logoText.textContent = config.navigation.logoText;
    }

    if (copyright) copyright.textContent = footer.copyrightText || '';

    if (socialLinks && footer.socialLinks) {
        socialLinks.innerHTML = footer.socialLinks.map(link => {
            const icon = getSocialIcon(link.icon);
            return `
                <a href="${link.url}"
                   class="social-link"
                   target="_blank"
                   rel="noopener noreferrer"
                   aria-label="${link.platform}">
                    ${icon}
                </a>
            `;
        }).join('');
    }

    // Update contact email if present
    const email = document.getElementById('contact-email');
    if (email && config.site?.email) {
        email.textContent = config.site.email;
    }
}

// Helper function to get social media icons
function getSocialIcon(iconName) {
    const icons = {
        'linkedin': 'in',
        'twitter': '𝕏',
        'github': 'GH',
        'facebook': 'f',
        'instagram': 'IG'
    };
    return icons[iconName] || '🔗';
}

// ========================================
// Event Listeners
// ========================================
function initEventListeners() {
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }

    // Close mobile menu when clicking a link
    navMenu?.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
        });
    });

    // Handle scroll events
    window.addEventListener('scroll', () => {
        handleScroll();
        updateActiveNav();
    });

    // Back to top button
    const backToTop = document.getElementById('back-to-top');
    if (backToTop) {
        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

}

// Handle scroll effects
function handleScroll() {
    const navbar = document.getElementById('navbar');
    const backToTop = document.getElementById('back-to-top');

    // Add shadow to navbar on scroll
    if (navbar) {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    // Show/hide back to top button
    if (backToTop) {
        if (window.scrollY > 300) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    }
}

// Update active navigation item based on scroll position
function updateActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-menu a');

    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.scrollY >= sectionTop - 100) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}

// ========================================
// Initialize on page load
// ========================================
document.addEventListener('DOMContentLoaded', init);
