import React, { useState } from 'react';

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    q: 'What is Back To Future (BTF)?',
    a: 'BTF is a decentralized earning ecosystem deployed on BNB Smart Chain powered by USDT (BEP20). It combines an automated 0.5% daily ROI distribution with a comprehensive 15-level referral network, power salaries, and milestone rewards—executed entirely via autonomous smart contracts.',
  },
  {
    q: 'What does "Ownership Renounced" mean for participants?',
    a: 'Ownership renunciation means the creator or deployer has relinquished administrative control over the smart contract. There are no admin keys, no owner privileges, and no backend switches that allow anyone to modify payout rates, freeze accounts, or withdraw contract funds.',
  },
  {
    q: 'Which blockchain network and currency does BTF use?',
    a: 'BTF operates exclusively on BNB Smart Chain (BEP20) using Tether USD (USDT). Participants also require a nominal amount of BNB in their wallet to cover minimal network transaction gas fees.',
  },
  {
    q: 'What are the subscription packages and daily returns?',
    a: 'There are 4 packages: $25 Starter (3X working limit), $100 Builder (5X working limit), $500 Leader (7X working limit), and $1,000 Enterprise (10X working limit). All packages receive 0.5% daily ROI up to a maximum 3X return on the subscription value.',
  },
  {
    q: 'How does the 15-Level Referral Income work?',
    a: 'Level income is credited continuously on the daily ROI distributed to your referral team. Levels 1–5 yield 10% commission (unlocked with 1–5 direct referrals), while Levels 6–15 yield 5% commission (unlocked with direct referral count and direct volume milestones).',
  },
  {
    q: 'What is the 40% Single-Leg Rule?',
    a: 'To qualify for Power (Salary) Ranks (P1–P9) and Milestone Reward Ranks (R1–R12), a maximum of 40% of the qualifying business volume can originate from any single direct referral leg. This prevents lopsided qualification and promotes balanced team building.',
  },
  {
    q: 'What is the minimum withdrawal amount and fee?',
    a: 'The minimum withdrawal is 10 USDT. A 7% automated smart contract processing fee applies to all withdrawal requests across Direct, ROI Level, Salary, and Reward income streams.',
  },
  {
    q: 'Where can I inspect the smart contract source code?',
    a: 'The contract is publicly deployed on BNB Smart Chain at address 0xa3ef4af3f6a43ef46ea3867f9acc9fd0539b5483 and can be audited anytime on BscScan.',
  },
];

export const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="section-spacing" style={{
      backgroundColor: 'var(--bg-base)',
    }}>
      <div className="container" style={{ maxWidth: '820px' }}>
        <div className="section-header">
          <h2>Frequently Asked Questions</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {FAQS.map((item, idx) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={idx}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: `1px solid ${isOpen ? 'var(--border-active)' : 'var(--border-default)'}`,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s ease',
                }}
              >
                <h3 style={{ margin: 0, padding: 0, fontSize: 'inherit', fontWeight: 'inherit' }}>
                  <button
                    id={`faq-question-${idx}`}
                    onClick={() => toggle(idx)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${idx}`}
                    className="faq-trigger"
                    style={{
                      color: isOpen ? 'var(--text-cyan)' : 'var(--text-primary)',
                    }}
                  >
                    <span>{item.q}</span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                      style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0,
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </h3>

                {isOpen && (
                  <div
                    id={`faq-answer-${idx}`}
                    role="region"
                    aria-labelledby={`faq-question-${idx}`}
                    className="faq-body"
                  >
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
