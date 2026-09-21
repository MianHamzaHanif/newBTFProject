import React from 'react';

const STEPS = [
  {
    step: '01',
    title: 'Create Web3 Wallet',
    description: 'Set up MetaMask, Trust Wallet, or Binance Web3 Wallet. Secure your seed phrase offline.',
  },
  {
    step: '02',
    title: 'Fund USDT (BEP20) & BNB',
    description: 'Deposit Tether USDT on the BNB Smart Chain (BEP20) for your package, plus ~$1-$2 in BNB for network gas fees.',
  },
  {
    step: '03',
    title: 'Connect & Choose Tier',
    description: 'Launch the BTF dApp, connect your wallet, and select your subscription package ($25, $100, $500, or $1000).',
  },
  {
    step: '04',
    title: 'Activate & Earn Daily',
    description: 'Approve the smart contract execution. Begin earning 0.5% daily ROI immediately and share your referral link.',
  },
];

export const OnboardingSteps: React.FC = () => {
  return (
    <section id="onboarding" className="section-spacing" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="container">
        <div className="section-header">
          <h2>Get Started</h2>
        </div>

        <div className="onboarding-grid">
          {STEPS.map((s, index) => (
            <div key={index} className="onboarding-card">
              <div className="onboarding-badge">
                {s.step}
              </div>

              <div>
                <h3 className="onboarding-title">
                  {s.title}
                </h3>
                <p className="onboarding-desc">
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
