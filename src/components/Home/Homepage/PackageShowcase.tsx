import React, { useState } from 'react';
import { PACKAGES, type PackageTier } from '../../../data/ecosystem';

export const PackageShowcase: React.FC = () => {
  const [selectedPkg, setSelectedPkg] = useState<PackageTier>(PACKAGES[1]); // Default to $100 Builder

  return (
    <section id="packages" className="section-spacing" style={{
      backgroundColor: 'var(--bg-base)',
    }}>
      <div className="container">
        <div className="section-header">
          <h2>Subscription Packages</h2>
        </div>

        {/* Mobile Tier Segmented Switcher (<768px) */}
        <div className="mobile-only" style={{ marginBottom: '1.25rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.4rem',
            backgroundColor: 'var(--bg-card)',
            padding: '0.35rem',
            borderRadius: '8px',
            border: '1px solid var(--border-default)',
          }}>
            {PACKAGES.map((pkg) => {
              const isSelected = selectedPkg.id === pkg.id;
              return (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPkg(pkg)}
                  aria-pressed={isSelected}
                  style={{
                    padding: '0.5rem 0.2rem',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? 'var(--accent-emerald)' : 'transparent',
                    color: isSelected ? '#042f1a' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    minHeight: '44px',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span className="tabular-nums">${pkg.price}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile Active Package Card (<768px) */}
        <div className="mobile-only" style={{ marginBottom: '2rem' }}>
          <div
            style={{
              backgroundColor: 'var(--bg-card-hover)',
              border: '2px solid var(--accent-emerald)',
              borderRadius: '12px',
              padding: '1.5rem',
              position: 'relative',
              boxShadow: '0 10px 25px -4px rgba(16, 185, 129, 0.2)',
            }}
          >
            {selectedPkg.recommended && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                right: '1.25rem',
                backgroundColor: 'var(--accent-emerald)',
                color: '#042f1a',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.2rem 0.65rem',
                borderRadius: '9999px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                Most Popular
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            </div>

            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem' }} className="tabular-nums">
              ${selectedPkg.price}
            </div>

            <div style={{
              padding: '0.85rem',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Daily ROI Rate:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-emerald)' }} className="tabular-nums">
                  {selectedPkg.dailyRewardRate}% / day
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Daily Return:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }} className="tabular-nums">
                  ${selectedPkg.dailyRewardUsdt.toFixed(4)} USDT
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total ROI Limit:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-cyan)' }} className="tabular-nums">
                  {selectedPkg.totalRoiLimit} (${selectedPkg.totalRoiUsdt})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Working Limit:</span>
                <span style={{ fontWeight: 700, color: 'var(--color-warning)' }} className="tabular-nums">
                  {selectedPkg.workingLimit} (${selectedPkg.workingLimitUsdt})
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Desktop 4 Packages Grid (>768px) */}
        <div className="desktop-grid pkg-desktop-grid">
          {PACKAGES.map((pkg) => {
            const isSelected = selectedPkg.id === pkg.id;

            return (
              <div
                key={pkg.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${pkg.name} Tier - $${pkg.price}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedPkg(pkg);
                  }
                }}
                onClick={() => setSelectedPkg(pkg)}
                className={`package-card ${isSelected ? 'package-card-active' : ''}`}
              >
                {pkg.recommended && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    right: '1.5rem',
                    backgroundColor: 'var(--accent-emerald)',
                    color: '#042f1a',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.65rem',
                    borderRadius: '9999px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    Most Popular
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                </div>

                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem' }} className="tabular-nums">
                  ${pkg.price}
                </div>

                <div style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  fontSize: '0.85rem',
                  marginBottom: '1.5rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Daily ROI Rate:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-emerald)' }} className="tabular-nums">
                      {pkg.dailyRewardRate}% / day
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Daily Return:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }} className="tabular-nums">
                      ${pkg.dailyRewardUsdt.toFixed(4)} USDT
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total ROI Limit:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-cyan)' }} className="tabular-nums">
                      {pkg.totalRoiLimit} (${pkg.totalRoiUsdt})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Working Limit:</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-warning)' }} className="tabular-nums">
                      {pkg.workingLimit} (${pkg.workingLimitUsdt})
                    </span>
                  </div>
                </div>

                <div
                  className={isSelected ? 'btn-primary' : 'btn-secondary'}
                  style={{ width: '100%', padding: '0.65rem', fontSize: '0.9rem', pointerEvents: 'none' }}
                >
                  {isSelected ? 'Selected Package' : 'Select Tier'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic ROI Calculation Box */}
        <div className="roi-calc-box">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Earnings Projection for ${selectedPkg.price} Tier
          </h3>

          <div className="roi-metrics-grid">
            <div className="roi-metric-item">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Daily Passive Return
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-emerald)' }} className="tabular-nums roi-metric-number">
                ${selectedPkg.dailyRewardUsdt.toFixed(4)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Paid in USDT (BEP20) daily
              </div>
            </div>

            <div className="roi-metric-item">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                30-Day Projected Return
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-cyan)' }} className="tabular-nums roi-metric-number">
                ${(selectedPkg.dailyRewardUsdt * 30).toFixed(4)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                15% total monthly yield
              </div>
            </div>

            <div className="roi-metric-item">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Maximum 3X Cap
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }} className="tabular-nums roi-metric-number">
                ${selectedPkg.totalRoiUsdt}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Max ROI return before renewal
              </div>
            </div>

            <div className="roi-metric-item">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Team Working Limit
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-warning)' }} className="tabular-nums roi-metric-number">
                ${selectedPkg.workingLimitUsdt}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                {selectedPkg.workingLimit} multiplier for referral team
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
