import "./helpers.js";
import "./postPeople.js";
import "./tree.js";
import "./search.js";
import "./home.js";
import { getCurrentFamilyId } from "./helpers.js";

// Highlight active navigation link based on current page
// Also update navigation links to include familyId for persistence
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav a');
    const familyId = getCurrentFamilyId();
    
    // Update navigation links to include familyId if present
    navLinks.forEach(link => {
        const linkPath = new URL(link.href, window.location.origin).pathname;
        
        // Add familyId to tree and search links if we have one
        if (familyId && (linkPath === '/tree' || linkPath === '/search')) {
            const url = new URL(link.href, window.location.origin);
            url.searchParams.set('familyId', familyId);
            link.href = url.pathname + url.search;
        }
        
        // Highlight active link
        if (linkPath === currentPath || 
            (currentPath === '/' && linkPath === '/') ||
            (currentPath.includes('/tree') && linkPath === '/tree') ||
            (currentPath.includes('/search') && linkPath === '/search') ||
            (currentPath.includes('/profile') && linkPath === '/')) {
            link.setAttribute('aria-current', 'page');
            link.classList.add('active');
        }
    });
    
    // Update "Back to Family Tree" button in profile page
    const backToTreeBtn = document.querySelector('a[href="/tree"]');
    if (backToTreeBtn && familyId && backToTreeBtn.textContent.includes('Back to Family Tree')) {
        backToTreeBtn.href = `/tree?familyId=${familyId}`;
    }
    
    // Update copyright year
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
});