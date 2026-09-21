import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoImg from '../../../../public/websiteimg/logo.webp';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setMobileMenuOpen(false);
        } else if (e.key === 'Tab') {
          const navEl = document.getElementById('mobile-navigation');
          if (navEl) {
            const focusables = navEl.querySelectorAll<HTMLAnchorElement>('a');
            if (focusables.length > 0) {
              const first = focusables[0];
              const last = focusables[focusables.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [mobileMenuOpen]);

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backgroundColor: 'rgba(7, 9, 14, 0.88)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      transition: 'all 0.2s ease',
    }}>
      <div className="container navbar-container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Brand Logo */}
        <a href="#" aria-label="Back To Future Home" style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src={LogoImg}
            alt="BTF Marketing Logo"
            width="86"
            height="46"
            className="navbar-logo"
            style={{
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </a>

        {/* Desktop Navigation Links */}
        <nav aria-label="Main Navigation" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.75rem',
        }} className="desktop-nav">
          <a href="#ecosystem" className="nav-link">Ecosystem</a>
          <a href="#packages" className="nav-link">Packages</a>
          <a href="#compensation" className="nav-link">Compensation Plan</a>
          <a href="#contract" className="nav-link">Verification</a>
          <a href="#onboarding" className="nav-link">How to Start</a>
          <a href="#faq" className="nav-link">FAQ</a>
        </nav>

        {/* Action Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Login CTA Button */}
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '0.55rem 1.25rem', fontSize: '0.9rem' }}
            onClick={() => navigate('/login')}
          >
            Launch DApp
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>

          {/* Mobile Hamburger Button (Touch Target ≥44px) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            className="mobile-toggle"
            style={{
              display: 'none',
              minWidth: '44px',
              minHeight: '44px',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.5rem',
              color: 'var(--text-primary)',
              borderRadius: '6px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {mobileMenuOpen ? (
                <line x1="18" y1="6" x2="6" y2="18" />
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay Backdrop & Drawer (Floating on top, does NOT push website content down) */}
      {mobileMenuOpen && (
        <div
          className="mobile-menu-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
          onClick={() => setMobileMenuOpen(false)}
        >
          <nav
            id="mobile-navigation"
            aria-label="Mobile Navigation"
            className="mobile-menu-dropdown"
            onClick={(e) => e.stopPropagation()}
          >
            <a href="#ecosystem" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-link">Ecosystem</a>
            <a href="#packages" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-link">Packages</a>
            <a href="#compensation" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-link">Compensation Plan</a>
            <a href="#contract" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-link">Verification</a>
            <a href="#onboarding" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-link">How to Start</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-link">FAQ</a>
          </nav>
        </div>
      )}
    </header>
  );
};
