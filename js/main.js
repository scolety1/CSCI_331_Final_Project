import "./helpers.js";
import "./postPeople.js";
import "./tree.js";
import "./search.js";
import "./home.js";
import { getCurrentFamilyId } from "./helpers.js";

document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav a');
    const familyId = getCurrentFamilyId();
    
    navLinks.forEach(link => {
        const linkPath = new URL(link.href, window.location.origin).pathname;
        
        if (familyId && (linkPath === '/tree' || linkPath === '/search')) {
            const url = new URL(link.href, window.location.origin);
            url.searchParams.set('familyId', familyId);
            link.href = url.pathname + url.search;
        }
        
        if (linkPath === currentPath || 
            (currentPath === '/' && linkPath === '/') ||
            (currentPath.includes('/tree') && linkPath === '/tree') ||
            (currentPath.includes('/search') && linkPath === '/search') ||
            (currentPath.includes('/profile') && linkPath === '/')) {
            link.setAttribute('aria-current', 'page');
            link.classList.add('active');
        }
    });
    
    const backToTreeBtn = document.querySelector('a[href="/tree"]');
    if (backToTreeBtn && familyId && backToTreeBtn.textContent.includes('Back to Family Tree')) {
        backToTreeBtn.href = `/tree?familyId=${familyId}`;
    }
    
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
});