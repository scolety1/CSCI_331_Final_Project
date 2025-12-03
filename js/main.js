import "./helpers.js";
import "./postPeople.js";
import "./editPeople.js";
import "./tree.js";
import "./search.js";

// Highlight active navigation link based on current page
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav a');
    
    navLinks.forEach(link => {
        const linkPath = new URL(link.href).pathname;
        if (linkPath === currentPath || 
            (currentPath === '/' && linkPath === '/') ||
            (currentPath.includes('/tree') && linkPath === '/tree') ||
            (currentPath.includes('/search') && linkPath === '/search') ||
            (currentPath.includes('/profile') && linkPath === '/')) {
            link.setAttribute('aria-current', 'page');
            link.classList.add('active');
        }
    });
    
    // Update copyright year
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
});