import React, { useState } from 'react';
import { CONTRACT_CONFIG } from '../../../data/ecosystem';

export const ContractVerification: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(CONTRACT_CONFIG.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="contract" className="section-spacing" style={{
      backgroundColor: 'var(--bg-base)',
    }}>
      <div className="container">
        <div className="section-header">
          <h2>Smart Contract Transparency</h2>
        </div>

        <div className="contract-hub-card">
          {/* Status Header */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            paddingBottom: '1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-emerald)',
                boxShadow: '0 1px 4px rgba(16, 185, 129, 0.4)',
                flexShrink: 0,
              }} />
              <div>
                <span style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                  BNB Smart Chain (BEP20) Contract
                </span>
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-emerald)', fontWeight: 500 }}>
                  Ownership Renounced • Publicly Verified
                </span>
              </div>
            </div>

            <div className="badge-tag badge-cyan">
              Live Mainnet Deployed
            </div>
          </div>

          {/* Address Box */}
          <div style={{ marginBottom: '1.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              Official Contract Address
            </span>
            <div className="contract-addr-box" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              backgroundColor: 'var(--bg-base)',
              border: '1px solid var(--border-default)',
              padding: '1rem 1.25rem',
              borderRadius: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9rem',
              wordBreak: 'break-all',
              color: 'var(--text-primary)',
            }}>
              <span>{CONTRACT_CONFIG.address}</span>
              <button
                onClick={handleCopy}
                aria-label="Copy smart contract address"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1rem',
                  minHeight: '44px',
                  minWidth: '44px',
                  borderRadius: '6px',
                  backgroundColor: copied ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)',
                  border: `1px solid ${copied ? 'var(--accent-emerald)' : 'var(--border-default)'}`,
                  color: copied ? 'var(--text-emerald)' : 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  flexShrink: 0,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {copied ? 'Copied' : 'Copy'}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  {copied ? (
                    <polyline points="20 6 9 17 4 12" />
                  ) : (
                    <>
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            <div
              aria-live="polite"
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                padding: 0,
                margin: '-1px',
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              {copied ? 'Smart contract address copied to clipboard' : ''}
            </div>
          </div>

          {/* Action Links */}
          <div className="contract-actions-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
            <a
              href={CONTRACT_CONFIG.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Verify Code on BscScan (opens in new tab)"
              className="btn-primary contract-action-btn"
              style={{ fontSize: '0.9rem', minHeight: '44px' }}
            >
              Verify Code on BscScan
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>

            <a
              href={`${CONTRACT_CONFIG.explorerUrl}#code`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View Contract Source on BscScan (opens in new tab)"
              className="btn-secondary contract-action-btn"
              style={{ fontSize: '0.9rem', minHeight: '44px' }}
            >
              View Contract Source
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </a>
          </div>

          {/* 4 Pillars of Verification */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem',
            paddingTop: '1.75rem',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1rem' }}>
                Zero Backdoor Keys
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Ownership has been renounced. No developer or administrator can alter balances or withdraw contract funds.
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1rem' }}>
                Standard USDT (BEP20)
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Operates exclusively with Binance-pegged USDT. Low transaction gas fees and lightning-fast settlement.
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1rem' }}>
                Open-Source Logic
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Read and write contract methods are exposed directly for independent auditing on blockchain explorers.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
