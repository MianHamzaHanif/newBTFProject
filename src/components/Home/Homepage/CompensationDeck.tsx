import React, { useState } from 'react';
import { LEVEL_INCOME_DATA, POWER_RANKS, REWARD_RANKS, PROTOCOL_RULES } from '../../../data/ecosystem';

type TabKey = 'levels' | 'power' | 'rewards' | 'rules';

const TABS: { key: TabKey; id: string; label: string }[] = [
  { key: 'levels', id: 'tab-levels', label: '15-Level Referral Income' },
  { key: 'power', id: 'tab-power', label: 'Power / Salary Income (P1–P9)' },
  { key: 'rewards', id: 'tab-rewards', label: 'Milestone Rewards (R1–R12)' },
  { key: 'rules', id: 'tab-rules', label: 'Protocol Terms & Fees' },
];

export const CompensationDeck: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('levels');
  const [showFullLevelTable, setShowFullLevelTable] = useState(false);

  const displayedLevels = showFullLevelTable ? LEVEL_INCOME_DATA : LEVEL_INCOME_DATA.slice(0, 7);

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (index + 1) % TABS.length;
      setActiveTab(TABS[nextIndex].key);
      document.getElementById(TABS[nextIndex].id)?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (index - 1 + TABS.length) % TABS.length;
      setActiveTab(TABS[prevIndex].key);
      document.getElementById(TABS[prevIndex].id)?.focus();
    }
  };

  return (
    <section id="compensation" className="section-spacing" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="container">
        <div className="section-header">
          <h2>Compensation Plan</h2>
        </div>

        {/* Tab Navigation Controls (Smooth horizontal swipe on mobile) */}
        <div
          role="tablist"
          aria-label="Compensation Sections"
          className="deck-tab-bar"
        >
          {TABS.map((tab, idx) => (
            <button
              key={tab.key}
              role="tab"
              id={tab.id}
              aria-selected={activeTab === tab.key}
              aria-controls={`panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              onClick={() => setActiveTab(tab.key)}
              className={`deck-tab-btn ${activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minHeight: '44px', padding: '0.75rem 1.4rem', fontSize: '0.85rem' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: 15-LEVEL REFERRAL INCOME */}
        {activeTab === 'levels' && (
          <div
            role="tabpanel"
            id="panel-levels"
            aria-labelledby="tab-levels"
            tabIndex={0}
            className="deck-panel"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
            }}
          >
            {/* Direct Income Banner */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '1.25rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              marginBottom: '2rem',
            }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-emerald)', marginBottom: '0.25rem' }}>
                  Direct Referral Income: 7%
                </h3>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                15-Level ROI Distribution Structure
              </h3>
            </div>

            {/* Mobile Swipe Hint */}
            <div className="mobile-only" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', marginBottom: '0.5rem' }}>
              ← Swipe table to inspect all columns →
            </div>

            {/* Level Income Table */}
            <div className="table-scroll-container" style={{ marginBottom: '1.5rem' }}>
              <table
                id="level-income-table"
                aria-label="15-Level Referral Income Breakdown"
                style={{
                  width: '100%',
                  minWidth: '600px',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.9rem',
                }}
              >
                <thead>
                  <tr style={{
                    borderBottom: '1px solid var(--border-default)',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    <th scope="col" className="table-sticky-col" style={{ padding: '0.85rem 1rem' }}>Level</th>
                    <th scope="col" style={{ padding: '0.85rem 1rem' }}>Commission</th>
                    <th scope="col" style={{ padding: '0.85rem 1rem' }}>Direct Requirement</th>
                    <th scope="col" style={{ padding: '0.85rem 1rem' }}>Example Team Size</th>
                    <th scope="col" style={{ padding: '0.85rem 1rem' }}>Per-User ROI Share</th>
                    <th scope="col" style={{ padding: '0.85rem 1rem' }}>Daily Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedLevels.map((row) => (
                    <tr
                      key={row.level}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: row.level % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                      }}
                    >
                      <th scope="row" className="table-sticky-col" style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'left' }}>
                        Level {row.level}
                      </th>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-emerald)', fontWeight: 600 }} className="tabular-nums">
                        {row.percentage}%
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                        {row.requirement}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }} className="tabular-nums">
                        {row.exampleUsers.toLocaleString()}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }} className="tabular-nums">
                        ${row.perUserIncome.toFixed(4)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-cyan)', fontWeight: 600 }} className="tabular-nums">
                        ${row.dailyIncome.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Toggle Full Table */}
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => setShowFullLevelTable(!showFullLevelTable)}
                aria-expanded={showFullLevelTable}
                aria-controls="level-income-table"
                className="btn-secondary"
                style={{ fontSize: '0.85rem', padding: '0.75rem 1.5rem', minHeight: '44px' }}
              >
                {showFullLevelTable ? 'Show Levels 1–7 Only' : 'Expand All 15 Referral Levels'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: POWER / SALARY INCOME */}
        {activeTab === 'power' && (
          <div
            role="tabpanel"
            id="panel-power"
            aria-labelledby="tab-power"
            tabIndex={0}
            className="deck-panel"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
            }}
          >

            {/* Mobile Swipe Hint */}
            <div className="mobile-only" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', marginBottom: '0.5rem' }}>
              ← Swipe table to inspect all columns →
            </div>

            <div className="table-scroll-container">
              <table
                aria-label="Power and Salary Income Ranks P1 through P9"
                style={{
                  width: '100%',
                  minWidth: '600px',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.9rem',
                }}>
                <thead>
                  <tr style={{
                    borderBottom: '1px solid var(--border-default)',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    <th scope="col" className="table-sticky-col" style={{ padding: '0.85rem 1rem' }}>Rank</th>
                    <th scope="col" style={{ padding: '0.85rem 1rem' }}>Qualifying Volume</th>
                    <th scope="col" style={{ padding: '0.85rem 1rem' }}>Salary (Every 10 Days)</th>
                    <th scope="col" style={{ padding: '0.85rem 1rem' }}>Disbursement Frequency</th>
                    <th scope="col" style={{ padding: '0.85rem 1rem' }}>Total Contract Allocation (20 Cycles)</th>
                  </tr>
                </thead>
                <tbody>
                  {POWER_RANKS.map((p) => (
                    <tr
                      key={p.rank}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: p.rank === 'P1' || p.rank === 'P5' || p.rank === 'P9' ? 'rgba(56, 189, 248, 0.03)' : 'transparent',
                      }}
                    >
                      <th scope="row" className="table-sticky-col" style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-emerald)', textAlign: 'left' }}>
                        {p.rank}
                      </th>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-primary)', fontWeight: 600 }} className="tabular-nums">
                        ${p.business.toLocaleString()}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-cyan)', fontWeight: 600 }} className="tabular-nums">
                        ${p.salary.toLocaleString()}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                        {p.frequency} ({p.times} Times)
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--color-warning)', fontWeight: 700 }} className="tabular-nums">
                        ${p.totalSalary.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: REWARD INCOME */}
        {activeTab === 'rewards' && (
          <div
            role="tabpanel"
            id="panel-rewards"
            aria-labelledby="tab-rewards"
            tabIndex={0}
            className="deck-panel"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
            }}
          >

            {/* Mobile Swipe Hint */}
            <div className="mobile-only" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', marginBottom: '0.5rem' }}>
              ← Swipe table to inspect all columns →
            </div>

            <div className="table-scroll-container">
              <table
                aria-label="Milestone Rewards R1 through R12"
                style={{
                  width: '100%',
                  minWidth: '550px',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.9rem',
                }}>
                <thead>
                  <tr style={{
                    borderBottom: '1px solid var(--border-default)',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    <th scope="col" className="table-sticky-col" style={{ padding: '0.85rem 1rem' }}>Rank</th>
                    <th scope="col" style={{ padding: '0.85rem 1rem' }}>Team Turnover</th>
                    <th scope="col" style={{ padding: '0.85rem 1rem' }}>Reward Payout</th>
                    <th scope="col" style={{ padding: '0.85rem 1rem' }}>Disbursement Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {REWARD_RANKS.map((r) => (
                    <tr key={r.rank} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <th scope="row" className="table-sticky-col" style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-cyan)', textAlign: 'left' }}>
                        {r.rank}
                      </th>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-primary)', fontWeight: 600 }} className="tabular-nums">
                        ${r.business.toLocaleString()}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-emerald)', fontWeight: 700 }} className="tabular-nums">
                        {r.reward}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                        {r.frequencyNote}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: PROTOCOL RULES & FEES */}
        {activeTab === 'rules' && (
          <div
            role="tabpanel"
            id="panel-rules"
            aria-labelledby="tab-rules"
            tabIndex={0}
            className="deck-panel"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
              Protocol Rules & Transparent Conditions
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {PROTOCOL_RULES.map((rule, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    padding: '1.25rem',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-cyan)' }} />
                    {rule.title}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {rule.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
