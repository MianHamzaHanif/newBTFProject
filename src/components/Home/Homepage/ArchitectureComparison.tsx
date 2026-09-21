import React, { useState } from 'react';

export const ArchitectureComparison: React.FC = () => {
  const [mobileTab, setMobileTab] = useState<'btf' | 'legacy'>('btf');

  const legacyCard = (
    <div className="arch-card arch-card-legacy" style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid rgba(239, 68, 68, 0.25)',
      borderRadius: '12px',
      position: 'relative',
    }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.25rem 0.65rem',
        borderRadius: '9999px',
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid var(--color-danger-border)',
        color: 'var(--color-danger-border)',
        fontSize: '0.75rem',
        fontWeight: 600,
        marginBottom: '1rem',
      }}>
        Centralized Risk
      </div>
      <h3 style={{ fontSize: '1.35rem', color: 'var(--text-danger)', marginBottom: '1.25rem' }}>
        Traditional Corporate Model
      </h3>

      {/* Traditional Flow Graphic */}
      <div className="arch-flow-graphic" style={{
        padding: '0.9rem',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        marginBottom: '1.5rem',
        fontSize: '0.85rem',
        fontWeight: 500,
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>Member</span>
        <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>→</span>
        <span>Company</span>
        <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>→</span>
        <span>Admin</span>
        <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>→</span>
        <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Payment?</span>
      </div>

      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>✕</span>
          <span><strong>Arbitrary Rule Changes:</strong> Owners can alter payout percentages, freeze accounts, or adjust compensation unilaterally.</span>
        </li>
        <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <span style={{ color: '#ef4444', fontWeight: 700 }}>✕</span>
          <span><strong>Custodial Treasury Risk:</strong> Funds sit in private corporate wallets; the company can shut down or abscond anytime.</span>
        </li>
        <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <span style={{ color: '#ef4444', fontWeight: 700 }}>✕</span>
          <span><strong>Manual Payment Approvals:</strong> Withdrawals require staff verification, causing long delays or abrupt payout halts.</span>
        </li>
        <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <span style={{ color: '#ef4444', fontWeight: 700 }}>✕</span>
          <span><strong>Hidden Operations:</strong> Zero public visibility into where treasury reserves are stored or allocated.</span>
        </li>
      </ul>
    </div>
  );

  const btfCard = (
    <div className="arch-card arch-card-btf" style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid rgba(16, 185, 129, 0.35)',
      borderRadius: '12px',
      position: 'relative',
      boxShadow: '0 8px 30px -6px rgba(16, 185, 129, 0.1)',
    }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.25rem 0.65rem',
        borderRadius: '9999px',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        color: 'var(--text-emerald)',
        fontSize: '0.75rem',
        fontWeight: 600,
        marginBottom: '1rem',
      }}>
        Autonomous Protocol
      </div>
      <h3 style={{ fontSize: '1.35rem', color: 'var(--text-emerald)', marginBottom: '1.25rem' }}>
        The BTF Smart Contract Solution
      </h3>

      {/* BTF Flow Graphic */}
      <div className="arch-flow-graphic" style={{
        padding: '0.9rem',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '8px',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        marginBottom: '1.5rem',
        fontSize: '0.85rem',
        fontWeight: 500,
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>Member</span>
        <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>→</span>
        <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Smart Contract</span>
        <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>→</span>
        <span style={{ color: 'var(--text-emerald)', fontWeight: 600 }}>Instant Distribution</span>
      </div>

      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>✓</span>
          <span><strong>Ownership Renounced:</strong> The contract runs autonomously. No single entity has admin privileges to manipulate rules.</span>
        </li>
        <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>✓</span>
          <span><strong>Automated Smart Contract Distribution:</strong> Packages, daily ROI, and 15-level commissions distribute directly on BNB Smart Chain.</span>
        </li>
        <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>✓</span>
          <span><strong>Instant On-Chain Withdrawals:</strong> 10 USDT minimum threshold with automated 7% processing fee executed in real-time.</span>
        </li>
        <li style={{ display: 'flex', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>✓</span>
          <span><strong>Public Verification on BscScan:</strong> Every transaction, distribution logic, and fee event can be independently inspected by anyone.</span>
        </li>
      </ul>
    </div>
  );

  return (
    <section id="ecosystem" className="section-spacing" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="container">
        <div className="section-header">
          <h2>Decentralized Architecture</h2>
        </div>

        {/* Mobile Segmented Switcher (<768px) */}
        <div className="mobile-only-flex" style={{ justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setMobileTab('btf')}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              minHeight: '44px',
              backgroundColor: mobileTab === 'btf' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)',
              border: `1px solid ${mobileTab === 'btf' ? 'var(--accent-emerald)' : 'var(--border-default)'}`,
              color: mobileTab === 'btf' ? 'var(--text-emerald)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
              flex: 1,
              maxWidth: '200px',
            }}
          >
            BTF Solution
          </button>
          <button
            onClick={() => setMobileTab('legacy')}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              minHeight: '44px',
              backgroundColor: mobileTab === 'legacy' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface)',
              border: `1px solid ${mobileTab === 'legacy' ? 'var(--color-danger)' : 'var(--border-default)'}`,
              color: mobileTab === 'legacy' ? 'var(--text-danger)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
              flex: 1,
              maxWidth: '200px',
            }}
          >
            Centralized Risk
          </button>
        </div>

        {/* Mobile Single Card View */}
        <div className="mobile-only">
          {mobileTab === 'btf' ? btfCard : legacyCard}
        </div>

        {/* Desktop Side-by-Side Grid (>768px) */}
        <div className="desktop-grid arch-desktop-grid">
          {legacyCard}
          {btfCard}
        </div>
      </div>
    </section>
  );
};
