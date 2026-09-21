import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CONTRACT_CONFIG } from '../../../data/ecosystem';

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

          {/* Verified Contract Callout Pill */}
          <div className="hero-contract-pill">
            <div className="hero-contract-meta">
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-emerald)',
                boxShadow: '0 1px 4px rgba(16, 185, 129, 0.4)',
                flexShrink: 0,
                marginTop: '3px',
              }} />
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', lineHeight: 1.2 }}>
                  Verified Smart Contract on BscScan
                </span>
                <span className="hero-contract-addr" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {CONTRACT_CONFIG.address}
                </span>
              </div>
            </div>
            <a
              href={CONTRACT_CONFIG.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Verify contract on BscScan (opens in new tab)"
              className="hero-verify-btn"
            >
              Verify on BscScan
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
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
