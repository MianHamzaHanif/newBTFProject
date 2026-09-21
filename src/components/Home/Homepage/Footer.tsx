import React from 'react';
import { CONTRACT_CONFIG } from '../../../data/ecosystem';
import LogoImg from '../../../../public/websiteimg/logo.webp';

export const Footer: React.FC = () => {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand Col */}
          <div style={{ maxWidth: '320px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <img
                src={LogoImg}
                alt="BTF Marketing Logo"
                width="78"
                height="42"
                loading="lazy"
                decoding="async"
                style={{ height: '42px', width: 'auto', objectFit: 'contain' }}
              />
            </div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              A decentralized earning ecosystem powered by USDT (BEP20).
              Built on smart contract automation, ownership renunciation, and on-chain verification.
            </p>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Official Portal: <span style={{ color: 'var(--text-cyan)' }}>{CONTRACT_CONFIG.domain}</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '1rem', fontWeight: 600 }}>
              Ecosystem
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <li><a href="#ecosystem" className="footer-link">Decentralized Architecture</a></li>
              <li><a href="#packages" className="footer-link">Subscription Packages</a></li>
              <li><a href="#compensation" className="footer-link">Compensation Plan</a></li>
              <li><a href="#onboarding" className="footer-link">How to Get Started</a></li>
              <li><a href="#faq" className="footer-link">Frequently Asked Questions</a></li>
            </ul>
          </div>

          {/* On-Chain Resources */}
          <div>
            <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '1rem', fontWeight: 600 }}>
              On-Chain Transparency
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <li>
                <a
                  href={CONTRACT_CONFIG.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="BscScan Verified Contract (opens in new tab)"
                  className="footer-link-cyan"
                >
                  BscScan Verified Contract
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </li>
              <li>
                <a
                  href={`${CONTRACT_CONFIG.explorerUrl}#code`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Source Code & Read Functions (opens in new tab)"
                  className="footer-link"
                >
                  Source Code & Read Functions
                </a>
              </li>
              <li>
                <a
                  href={`${CONTRACT_CONFIG.explorerUrl}#events`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Live Contract Events & Payouts (opens in new tab)"
                  className="footer-link"
                >
                  Live Contract Events & Payouts
                </a>
              </li>
            </ul>
          </div>

          {/* Standards */}
          <div>
            <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '1rem', fontWeight: 600 }}>
              Protocol Standards
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
              <li>• Network: BNB Smart Chain (BSC)</li>
              <li>• Standard: BEP-20 (Tether USD)</li>
              <li>• Structure: Ownership Renounced</li>
              <li>• Min Withdrawal: 10 USDT</li>
              <li>• Execution Fee: 7% on Withdrawals</li>
            </ul>
          </div>
        </div>

        {/* Disclaimer & Copyright */}
        <div className="footer-bottom">
          <div>
            © 2026 Back To Future (BTF). Autonomous Community Protocol.
          </div>
          <div className="footer-disclaimer">
            BTF operates entirely via decentralized smart contracts on BNB Smart Chain. Cryptocurrency participation involves risk; ensure you review verifiable contract terms independently.
          </div>
        </div>
      </div>
    </footer>
  );
};
