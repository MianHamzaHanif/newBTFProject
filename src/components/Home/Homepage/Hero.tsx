import React from 'react';
import { useNavigate } from 'react-router-dom';

export const Hero: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <section className="hero-section">
        <div className="container hero-content-container">
          {/* Main Headline with Dedicated Dark Focus Scrim */}
          <div className="hero-headline-wrap">
            <div className="hero-headline-scrim" aria-hidden="true" />
            <h1 className="hero-headline">
              A Decentralized Earning Ecosystem Powered by USDT
            </h1>
          </div>

          {/* Primary Action Buttons */}
          <div className="hero-actions">
            <button
              type="button"
              className="btn-primary hero-cta-btn"
              onClick={() => navigate('/login')}
            >
              Launch DApp
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            <a
              href="#compensation"
              className="btn-secondary hero-cta-btn"
            >
              Explore Compensation Plan
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* 4-Metric Grid (Responsive 2x2 on mobile, visible on scroll below the 100vh fold) */}
      <section className="hero-metrics-section">
        <div className="container">
          <div className="hero-stats-grid">
            <div className="hero-stat-card">
              <div className="hero-stat-number tabular-nums hero-stat-emerald">
                0.5%
              </div>
              <div className="hero-stat-title">
                Daily ROI Return
              </div>
            </div>

            <div className="hero-stat-card">
              <div className="hero-stat-number tabular-nums hero-stat-cyan">
                $25
              </div>
              <div className="hero-stat-title">
                Starting Package
              </div>
            </div>

            <div className="hero-stat-card">
              <div className="hero-stat-number tabular-nums hero-stat-white">
                <span className="hero-stat-prefix" aria-label="Up to">≤</span>$2,00,000
              </div>
              <div className="hero-stat-title">
                Power / Salary Income
              </div>
            </div>

            <div className="hero-stat-card">
              <div className="hero-stat-number tabular-nums hero-stat-amber">
                <span className="hero-stat-prefix" aria-label="Up to">≤</span>$1,279,500
              </div>
              <div className="hero-stat-title">
                Milestone Rewards
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
