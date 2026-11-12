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
const REGISTRY_ABI = [
  "function getVotingPowerAt(address user,uint256 snapshotTime) view returns(uint256)",
  "function getAchievedPowerLevel(address user) view returns(uint256)",
  "function getAchievedRewardCount(address user) view returns(uint256)",
];

export default function DaoVotingPrompt() {
  const navigate = useNavigate();
  const [proposalIds, setProposalIds] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let disposed = false;

    const checkVotingEligibility = async () => {
      try {
        if (!disposed) {
          setVisible(false);
          setProposalIds([]);
        }
        const user = await getReadWalletAddress();
        if (!user || !ethers.isAddress(user) || !ethers.isAddress(V2DaoAddress)) return;

        const provider = createBscReadProvider();
        const dao = new ethers.Contract(V2DaoAddress, DAO_ABI, provider);
        const registry = new ethers.Contract(ReferralNetworkAddress, REGISTRY_ABI, provider);
        const [powerLevel, rewardCount, proposalCount, block] = await Promise.all([
          registry.getAchievedPowerLevel(user),
          registry.getAchievedRewardCount(user),
          dao.proposalCount(),
          provider.getBlock("latest"),
        ]);

        // Only an active V3 Power/Reward rank can trigger the popup.
        if (BigInt(powerLevel) === 0n && BigInt(rewardCount) === 0n) return;

        const now = BigInt(block?.timestamp ?? 0);
        const count = BigInt(proposalCount);
        const toRead = Number(count > 50n ? 50n : count);
        const ids = Array.from({ length: toRead }, (_, index) => count - BigInt(index));
        const eligible = await Promise.all(ids.map(async (proposalId) => {
          const proposal = await dao.getProposal(proposalId);
          const isOpen = !Boolean(proposal[9]) && !Boolean(proposal[10])
            && BigInt(proposal[5]) === 0n && now <= BigInt(proposal[4]);
          if (!isOpen) return null;
          const [weight, voted] = await Promise.all([
            registry.getVotingPowerAt(user, proposal[3]),
            dao.hasVoted(proposalId, user),
          ]);
          return BigInt(weight) > 0n && !Boolean(voted) ? proposalId : null;
        }));

        const openIds = eligible.filter((proposalId) => proposalId !== null);
        if (!disposed && openIds.length > 0) {
          setProposalIds(openIds);
          setVisible(true);
        }
      } catch {
        // A temporary public-RPC error must never block the dashboard.
      }
    };

    checkVotingEligibility();
    window.ethereum?.on?.("accountsChanged", checkVotingEligibility);
    window.addEventListener("btf:v2-data-changed", checkVotingEligibility);
    return () => {
      disposed = true;
      window.ethereum?.removeListener?.("accountsChanged", checkVotingEligibility);
      window.removeEventListener("btf:v2-data-changed", checkVotingEligibility);
    };
  }, []);

  if (!visible) return null;

  const openProposalId = proposalIds[0];
  return <div className="dao-vote-prompt-backdrop" role="presentation">
    <section className="dao-vote-prompt" role="dialog" aria-modal="true" aria-labelledby="dao-vote-title">
      <button type="button" className="dao-vote-close" onClick={() => setVisible(false)} aria-label="Close">×</button>
      <div className="dao-vote-earth">🌍</div>
      <h2 id="dao-vote-title">DAO Voting Open</h2>
      <p>Your V3 Power/Reward rank has voting access.</p>
      <p>Proposal ID: <strong>{openProposalId.toString()}</strong></p>
      {proposalIds.length > 1 && <p>{proposalIds.length} proposals are available to vote.</p>}
      <p className="dao-vote-question">Cast your vote before the proposal closes.</p>
      <button type="button" className="custom-button dao-vote-action" onClick={() => navigate(`/dao-voting?proposalId=${openProposalId.toString()}`)}>Vote Now</button>
    </section>
  </div>;
}
