import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { ReferralNetworkAddress, V2DaoAddress } from "../../blockchain/address";
import { createBscReadProvider, getReadWalletAddress } from "../../blockchain/readProvider";
import "./DaoVotingPrompt.css";

const DAO_ABI = [
  "function proposalCount() view returns(uint256)",
  "function getProposal(uint256) view returns(address proposer,address target,bytes data,uint256 snapshotTime,uint256 endTime,uint256 eta,uint256 forVotes,uint256 againstVotes,uint256 abstainVotes,bool canceled,bool executed)",
  "function hasVoted(uint256,address) view returns(bool)",
];
const REGISTRY_ABI = ["function getVotingPowerAt(address user,uint256 snapshotTime) view returns(uint256)"];
// The live upgrade vote uses these four proposal IDs. Checking this concise
// set keeps the Dashboard popup immediate after login/account switching.
const LIVE_PROPOSAL_IDS = [18n, 19n, 20n, 21n];

export default function DaoVotingPrompt() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let disposed = false;

    const checkVotingEligibility = async () => {
      try {
        if (!disposed) setVisible(false);
        const user = await getReadWalletAddress();
        if (!user || !ethers.isAddress(user) || !ethers.isAddress(V2DaoAddress)) return;

        const provider = createBscReadProvider();
        const dao = new ethers.Contract(V2DaoAddress, DAO_ABI, provider);
        const registry = new ethers.Contract(ReferralNetworkAddress, REGISTRY_ABI, provider);
        const block = await provider.getBlock("latest");
        const now = BigInt(block?.timestamp ?? 0);
        const eligibility = await Promise.all(LIVE_PROPOSAL_IDS.map(async (proposalId) => {
          const proposal = await dao.getProposal(proposalId);
          const isOpen = !Boolean(proposal[9]) && !Boolean(proposal[10])
            && BigInt(proposal[5]) === 0n && now <= BigInt(proposal[4]);
          if (!isOpen) return false;
          const [weight, voted] = await Promise.all([
            registry.getVotingPowerAt(user, proposal[3]),
            dao.hasVoted(proposalId, user),
          ]);
          return BigInt(weight) > 0n && !Boolean(voted);
        }));
        if (!disposed && eligibility.some(Boolean)) setVisible(true);
      } catch {
        // The dashboard remains usable when a public RPC temporarily fails.
      }
    };

    checkVotingEligibility();
    const handleAccountsChanged = () => { checkVotingEligibility(); };
    window.ethereum?.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      disposed = true;
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  if (!visible) return null;

  return <div className="dao-vote-prompt-backdrop" role="presentation">
    <section className="dao-vote-prompt" role="dialog" aria-modal="true" aria-labelledby="dao-vote-title">
      <button type="button" className="dao-vote-close" onClick={() => setVisible(false)} aria-label="Close">×</button>
      <div className="dao-vote-earth">🌍</div>
      <h2 id="dao-vote-title">EARTH CALLING 📡</h2>
      <p>BTF DAO Governance Proposal is LIVE!</p>
      <p>🗳️ Your Vote • Your Voice • Your Future</p>
      <p>⏱️ Voting Time: 24 Hours</p>
      <p>👥 Minimum Quorum: 24%</p>
      <p>✅ Approval: 51% YES</p>
      <p className="dao-vote-question">Earth is Calling… Will You Vote? 🌍🚀</p>
      <button type="button" className="custom-button dao-vote-action" onClick={() => navigate("/dao-voting")}>Vote Now</button>
    </section>
  </div>;
}
