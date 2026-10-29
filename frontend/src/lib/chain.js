/**
 * frontend/src/lib/chain.js
 * MetaMask + ethers.js utilities for the frontend.
 *
 * MST Testnet chain config for auto-add / auto-switch.
 */

import { ethers } from "ethers";

export const MST_CHAIN = {
  chainId:         `0x${(91562037).toString(16)}`, // 0x5752035
  chainName:       "MST Testnet",
  nativeCurrency: { name: "MSTC", symbol: "MSTC", decimals: 18 },
  rpcUrls:         ["https://testnetrpc.mstblockchain.com"],
  blockExplorerUrls: ["https://testnet.mstscan.com"],
};

export const ROLES = {
  MANUFACTURER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("MANUFACTURER_ROLE")),
  DISTRIBUTOR_ROLE:  ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR_ROLE")),
  PHARMACY_ROLE:     ethers.keccak256(ethers.toUtf8Bytes("PHARMACY_ROLE")),
  REGULATOR_ROLE:    ethers.keccak256(ethers.toUtf8Bytes("REGULATOR_ROLE")),
  DEFAULT_ADMIN_ROLE: ethers.ZeroHash,
};

/**
 * Request MetaMask connection and return {provider, signer, address}.
 * Throws with user-friendly message on failure.
 */
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. Please install MetaMask to use the dashboard.");
  }

  await window.ethereum.request({ method: "eth_requestAccounts" });
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address };
}

/**
 * Ensure MetaMask is on the MST Testnet. If not, prompt to add/switch.
 */
export async function ensureNetwork() {
  if (!window.ethereum) throw new Error("MetaMask not found");

  const chainId = await window.ethereum.request({ method: "eth_chainId" });

  if (chainId !== MST_CHAIN.chainId) {
    try {
      // Try switching to MST first (works if user added it before)
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: MST_CHAIN.chainId }],
      });
    } catch (switchErr) {
      // Chain not added yet — add it
      if (switchErr.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [MST_CHAIN],
        });
      } else {
        throw switchErr;
      }
    }
  }
}

/**
 * Get the MediChain contract instance connected to the signer.
 */
export async function getContract(signer) {
  // Dynamic import of the deployed contract info
  // (written by deploy.js; falls back to a stub if not deployed)
  let info;
  try {
    info = await import("../contract/index.js");
  } catch {
    throw new Error("Contract not deployed yet. Run deploy.js first.");
  }

  return new ethers.Contract(info.CONTRACT_ADDRESS, info.ABI, signer);
}

/**
 * Detect which role(s) the connected address holds.
 * Returns an array of role names (e.g., ["MANUFACTURER_ROLE"]).
 */
export async function detectRoles(contract, address) {
  const found = [];
  for (const [name, hash] of Object.entries(ROLES)) {
    try {
      if (await contract.hasRole(hash, address)) {
        found.push(name);
      }
    } catch {
      // Ignore — contract might not be deployed
    }
  }
  return found;
}

/**
 * Format a bytes32 batchId from a plain string (for UI forms).
 * Users can type a human-readable lot number; we hash it.
 */
export function strToBatchId(str) {
  return ethers.keccak256(ethers.toUtf8Bytes(str.trim()));
}

/**
 * Wait for a transaction and return the receipt.
 * Throws with a clean message on failure.
 */
export async function waitForTx(tx) {
  const receipt = await tx.wait();
  if (receipt.status === 0) {
    throw new Error("Transaction reverted on-chain");
  }
  return receipt;
}
