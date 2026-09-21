import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import ReferralNetworkABI from "../../../blockchain/referralNetworkABI.json";
import { ReferralNetworkAddress } from "../../../blockchain/address";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

const LEVEL_COUNT = 15;
const CHILDREN_BATCH_SIZE = 8;

const formatAddressShort = (address) => {
  if (!address) {
    return "-";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const updateNodeByAddress = (node, targetAddress, updater) => {
  if (!node) {
    return node;
  }

  if (node.address.toLowerCase() === targetAddress.toLowerCase()) {
    return updater(node);
  }

  if (!node.children.length) {
    return node;
  }

  return {
    ...node,
    children: node.children.map((child) =>
      updateNodeByAddress(child, targetAddress, updater),
    ),
  };
};

const appendChildrenByAddress = (node, targetAddress, nextChildren) => {
  if (!node) {
    return node;
  }

  if (node.address.toLowerCase() === targetAddress.toLowerCase()) {
    const seen = new Set(node.children.map((child) => child.address.toLowerCase()));
    const mergedChildren = [...node.children];

    nextChildren.forEach((child) => {
      const childKey = child.address.toLowerCase();
      if (!seen.has(childKey)) {
        seen.add(childKey);
        mergedChildren.push(child);
      }
    });

    return {
      ...node,
      children: mergedChildren,
    };
  }

  if (!node.children.length) {
    return node;
  }

  return {
    ...node,
    children: node.children.map((child) =>
      appendChildrenByAddress(child, targetAddress, nextChildren),
    ),
  };
};

const TreeNode = ({ node, onToggleNode, loadingAddresses }) => {
  const isLoadingChildren = loadingAddresses.has(node.address.toLowerCase());
  const canExpand = node.depth < LEVEL_COUNT - 1 && node.childCount > 0;
  const isExpanded = node.depth === 0 || node.isExpanded;

  return (
    <li className="ref-tree-node">
      <div className="ref-tree-node-wrap">
        <button
          type="button"
          className={`ref-tree-card ${isExpanded ? "expanded" : ""}`}
          title={`${node.address} | ID: ${node.userId || "--"} | Direct: ${node.childCount}`}
          onClick={() => onToggleNode(node)}
          disabled={!canExpand || isLoadingChildren}
        >
          <span className="ref-tree-avatar">
            <i className={`bi ${isLoadingChildren ? "bi-arrow-repeat" : "bi-person-fill"}`}></i>
          </span>
        </button>
        <div className="ref-tree-label-wrap">
          <span className="ref-tree-id-text">{node.userId || "--"}</span>
          <span className="ref-tree-title">{formatAddressShort(node.address)}</span>
          <span className="ref-tree-meta">
            {node.childCount} direct{node.childCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {canExpand && isExpanded && node.children.length > 0 && (
        <ul className="ref-tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.address}
              node={child}
              onToggleNode={onToggleNode}
              loadingAddresses={loadingAddresses}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export const Tree = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [walletId, setWalletId] = useState("");
  const [treeData, setTreeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [loadingAddresses, setLoadingAddresses] = useState(() => new Set());

  const provider = useMemo(() => {
    if (!window.ethereum) {
      return null;
    }

    return createBscReadProvider();
  }, []);

  const referralContract = useMemo(() => {
    if (!provider) {
      return null;
    }

    return new ethers.Contract(ReferralNetworkAddress, ReferralNetworkABI, provider);
  }, [provider]);

  const fetchNodeSummary = async (address, depth = 0) => {
    const [userIdRaw, childCountRaw] = await Promise.all([
      referralContract.addressToId(address),
      depth < LEVEL_COUNT - 1
        ? referralContract.getLevelUsersLength(address, 0)
        : Promise.resolve(0n),
    ]);

    return {
      address,
      userId: String(userIdRaw ?? ""),
      depth,
      childCount: Number(childCountRaw ?? 0n),
      children: [],
      isExpanded: depth === 0,
      childrenLoaded: false,
    };
  };

  const fetchNodeChildren = async (node) => {
    if (!referralContract || node.depth >= LEVEL_COUNT - 1 || node.childCount === 0) {
      return [];
    }

    const directAddresses = await Promise.all(
      Array.from({ length: node.childCount }, (_, index) =>
        referralContract.getLevelUserAt(node.address, 0, index),
      ),
    );

    const validChildren = directAddresses.filter(
      (childAddress) => childAddress && ethers.isAddress(childAddress),
    );

    return Promise.all(
      validChildren.map((childAddress) => fetchNodeSummary(childAddress, node.depth + 1)),
    );
  };

  const fetchNodeChildrenProgressive = async (node, onChunk) => {
    if (!referralContract || node.depth >= LEVEL_COUNT - 1 || node.childCount === 0) {
      return [];
    }

    const directAddresses = await Promise.all(
      Array.from({ length: node.childCount }, (_, index) =>
        referralContract.getLevelUserAt(node.address, 0, index),
      ),
    );

    const validChildren = directAddresses.filter(
      (childAddress) => childAddress && ethers.isAddress(childAddress),
    );

    const allChildren = [];

    for (let i = 0; i < validChildren.length; i += CHILDREN_BATCH_SIZE) {
      const chunk = validChildren.slice(i, i + CHILDREN_BATCH_SIZE);
      const results = await Promise.allSettled(
        chunk.map((childAddress) => fetchNodeSummary(childAddress, node.depth + 1)),
      );

      const resolvedChildren = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);

      if (resolvedChildren.length > 0) {
        allChildren.push(...resolvedChildren);
        onChunk?.(resolvedChildren);
      }

      await Promise.resolve();
    }

    return allChildren;
  };

  const loadChildrenForNode = async (node) => {
    const nodeKey = node.address.toLowerCase();

    setLoadingAddresses((prev) => new Set(prev).add(nodeKey));

    setTreeData((prev) =>
      updateNodeByAddress(prev, node.address, (currentNode) => ({
        ...currentNode,
        children: [],
        isExpanded: true,
      })),
    );

    try {
      await fetchNodeChildrenProgressive(node, (resolvedChildren) => {
        setTreeData((prev) =>
          appendChildrenByAddress(prev, node.address, resolvedChildren),
        );
      });

      setTreeData((prev) =>
        updateNodeByAddress(prev, node.address, (currentNode) => ({
          ...currentNode,
          childrenLoaded: true,
          isExpanded: true,
        })),
      );
    } catch {
      setErrorText("Tree branch load failed.");
    } finally {
      setLoadingAddresses((prev) => {
        const next = new Set(prev);
        next.delete(nodeKey);
        return next;
      });
    }
  };

  const handleToggleNode = async (node) => {
    if (node.childCount === 0 || node.depth >= LEVEL_COUNT - 1) {
      return;
    }

    if (!node.childrenLoaded) {
      await loadChildrenForNode(node);
      return;
    }

    setTreeData((prev) =>
      updateNodeByAddress(prev, node.address, (currentNode) => ({
        ...currentNode,
        isExpanded: !currentNode.isExpanded,
      })),
    );
  };

  useEffect(() => {
    const loadInitialTree = async () => {
      if (!window.ethereum || !referralContract) {
        setErrorText("Wallet provider not found.");
        setTreeData(null);
        return;
      }

      try {
        setIsLoading(true);
        setErrorText("");

        const connectedAddress = await getReadWalletAddress();
        setWalletAddress(connectedAddress);

        if (!connectedAddress || !ethers.isAddress(connectedAddress)) {
          setWalletId("");
          setTreeData(null);
          setErrorText("Connected wallet not available.");
          return;
        }

        const rootNode = await fetchNodeSummary(connectedAddress, 0);
        setWalletId(rootNode.userId);
        const initialTree = {
          ...rootNode,
          children: [],
          childrenLoaded: false,
          isExpanded: true,
        };

        setTreeData(initialTree);

        await fetchNodeChildrenProgressive(rootNode, (resolvedChildren) => {
          setTreeData((prev) =>
            appendChildrenByAddress(prev, rootNode.address, resolvedChildren),
          );
        });

        setTreeData((prev) =>
          updateNodeByAddress(prev, rootNode.address, (currentNode) => ({
            ...currentNode,
            childrenLoaded: true,
            isExpanded: true,
          })),
        );
      } catch {
        setWalletId("");
        setTreeData(null);
        setErrorText("Tree load failed.");
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialTree();
  }, [referralContract]);

  return (
    <div className="page-container">
      <h1>Referral Tree</h1>

      <div className="tree-summary-card">
        <p className="tree-summary-label">Connected Wallet</p>
        <p className="tree-summary-value">{walletAddress || "--"}</p>
        <p className="tree-summary-note">
          Root aur first level foran load hotay hain. Kisi bhi card par click karke us branch ke directs khol sakte hain.
        </p>
        <p className="tree-summary-note">Wallet ID: {walletId || "--"}</p>
      </div>

      <div className="table-wrapper">
        <div className="table-card tree-card">
          {isLoading && <p className="team-loading">Loading referral tree...</p>}
          {!isLoading && errorText && <p className="team-loading">{errorText}</p>}

          {!isLoading && !errorText && treeData && (
            <div className="ref-tree-viewport">
              <div className="ref-tree-canvas">
                <ul className="ref-tree-root">
                  <TreeNode
                    node={treeData}
                    onToggleNode={handleToggleNode}
                    loadingAddresses={loadingAddresses}
                  />
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Tree;
