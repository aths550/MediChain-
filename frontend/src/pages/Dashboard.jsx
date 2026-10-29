import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import {
  connectWallet,
  ensureNetwork,
  getContract,
  detectRoles,
  strToBatchId,
  waitForTx,
  ROLES,
} from "../lib/chain.js";

const API_URL = import.meta.env.VITE_API_URL || "";
const EXPLORER_BASE = import.meta.env.VITE_EXPLORER_URL || "https://testnet.mstscan.com";

/**
 * /dashboard — MetaMask-connected role-based panel.
 * Supports: Manufacturer, Distributor, Pharmacy, Regulator, Admin.
 */
export default function Dashboard() {
  const [wallet, setWallet] = useState(null);  // { address, signer, contract, roles }
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [recalls, setRecalls] = useState([]);

  // ─── Connect ────────────────────────────────────────────────────────────────

  async function handleConnect() {
    setLoading(true);
    try {
      await ensureNetwork();
      const { signer, address } = await connectWallet();
      const contract = await getContract(signer);
      const roles    = await detectRoles(contract, address);
      setWallet({ address, signer, contract, roles });
      toast.success(`Connected: ${address.slice(0, 6)}…${address.slice(-4)}`);
    } catch (err) {
      toast.error(err.message || "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  }

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = () => setWallet(null);
    window.ethereum.on("accountsChanged", handler);
    window.ethereum.on("chainChanged", handler);
    return () => {
      window.ethereum.removeListener("accountsChanged", handler);
      window.ethereum.removeListener("chainChanged", handler);
    };
  }, []);

  // Load regulator stats
  useEffect(() => {
    if (!wallet) return;
    if (wallet.roles.includes("REGULATOR_ROLE") || wallet.roles.includes("DEFAULT_ADMIN_ROLE")) {
      loadStats();
    }
  }, [wallet]);

  async function loadStats() {
    try {
      const [sRes, rRes] = await Promise.all([
        fetch(`${API_URL}/api/regulator/stats`),
        fetch(`${API_URL}/api/recalls`),
      ]);
      const sData = await sRes.json();
      const rData = await rRes.json();
      setStats(sData);
      setRecalls(rData.recalls || []);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }

  if (!wallet) {
    return (
      <main className="min-h-screen pt-24 px-4 flex items-center justify-center">
        <div className="max-w-md w-full text-center animate-slide-up">
          <div className="glass-card p-10">
            <div className="w-20 h-20 bg-teal-600/20 rounded-full flex items-center justify-center
                            mx-auto mb-6 text-4xl">
              🦊
            </div>
            <h1 className="text-2xl font-bold mb-3">Connect Your Wallet</h1>
            <p className="text-white/60 mb-6">
              Connect MetaMask to access role-specific actions.
              The dashboard will auto-switch to MST Testnet.
            </p>
            <button
              id="btn-connect-wallet"
              onClick={handleConnect}
              disabled={loading}
              className="btn-primary w-full text-lg py-4"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connecting…
                </span>
              ) : "Connect MetaMask"}
            </button>
            {!window.ethereum && (
              <p className="mt-4 text-amber-400 text-sm">
                MetaMask is not installed.{" "}
                <a href="https://metamask.io" target="_blank" rel="noopener noreferrer"
                   className="underline">Install it here.</a>
              </p>
            )}
          </div>
        </div>
      </main>
    );
  }

  const hasRole = (role) => wallet.roles.includes(role);
  const isAdmin = hasRole("DEFAULT_ADMIN_ROLE");
  const isMfg   = hasRole("MANUFACTURER_ROLE");
  const isDist  = hasRole("DISTRIBUTOR_ROLE");
  const isPharma = hasRole("PHARMACY_ROLE");
  const isReg   = hasRole("REGULATOR_ROLE");

  return (
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Wallet header */}
        <div className="glass-card p-6 flex flex-wrap gap-4 items-center justify-between animate-slide-up">
          <div>
            <p className="text-sm text-white/50 mb-1">Connected Wallet</p>
            <p className="font-mono text-teal-400 text-sm">{wallet.address}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {wallet.roles.length === 0 ? (
              <span className="text-xs bg-gray-500/20 text-gray-400 border border-gray-500/30
                               rounded-full px-3 py-1">No roles assigned</span>
            ) : wallet.roles.map((r) => (
              <span key={r} className="text-xs bg-teal-600/20 text-teal-400 border border-teal-500/30
                                       rounded-full px-3 py-1">
                {r.replace("_ROLE", "").replace("DEFAULT_ADMIN", "ADMIN")}
              </span>
            ))}
          </div>
        </div>

        {/* Manufacturer Panel */}
        {(isMfg || isAdmin) && (
          <ManufacturerPanel contract={wallet.contract} address={wallet.address} />
        )}

        {/* Distributor Panel */}
        {(isDist || isAdmin) && (
          <TransferPanel
            contract={wallet.contract}
            address={wallet.address}
            role="Distributor"
            nextRole="PHARMACY_ROLE"
            nextLabel="Pharmacy"
          />
        )}

        {/* Pharmacy Panel */}
        {(isPharma || isAdmin) && (
          <TransferPanel
            contract={wallet.contract}
            address={wallet.address}
            role="Pharmacy"
            nextRole={null}
            nextLabel={null}
          />
        )}

        {/* Regulator Panel */}
        {(isReg || isAdmin) && (
          <RegulatorPanel
            contract={wallet.contract}
            stats={stats}
            recalls={recalls}
            onRefresh={loadStats}
          />
        )}

        {/* No role warning */}
        {wallet.roles.length === 0 && (
          <div className="glass-card p-8 text-center text-white/60 animate-fade-in">
            <p className="text-3xl mb-3">🔒</p>
            <p className="font-semibold mb-2">No roles assigned to this address.</p>
            <p className="text-sm">
              Ask the MediChain admin to grant your wallet a role
              (Manufacturer, Distributor, Pharmacy, or Regulator).
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Manufacturer Panel ─────────────────────────────────────────────────────

function ManufacturerPanel({ contract, address }) {
  const [form, setForm] = useState({
    lotNumber:    "",
    drugName:     "",
    mfgName:      "",
    quantity:     "",
    expiryDate:   "",
    docHashInput: "",
  });
  const [txState, setTxState] = useState(null); // null | "pending" | "confirmed" | "failed"
  const [lastTx, setLastTx] = useState(null);

  // QR generation
  const [qrBatchId, setQrBatchId] = useState("");
  const [qrCount, setQrCount] = useState(10);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setTxState("pending");
    const toastId = toast.loading("Sending transaction…");
    try {
      const batchId      = strToBatchId(form.lotNumber);
      const expiryTs     = Math.floor(new Date(form.expiryDate).getTime() / 1000);
      const docHash      = form.docHashInput
        ? ethers.keccak256(ethers.toUtf8Bytes(form.docHashInput))
        : ethers.ZeroHash;
      const manufactureTs = Math.floor(Date.now() / 1000);

      const tx = await contract.registerBatch(
        batchId,
        form.drugName,
        form.mfgName,
        manufactureTs,
        expiryTs,
        BigInt(form.quantity),
        docHash
      );

      toast.loading("Waiting for confirmation…", { id: toastId });
      const receipt = await waitForTx(tx);
      setTxState("confirmed");
      setLastTx({ hash: tx.hash, batchId });
      toast.success(
        <span>
          Batch registered!{" "}
          <a href={`${EXPLORER_BASE}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
             className="underline">View TX</a>
        </span>,
        { id: toastId, duration: 8000 }
      );
    } catch (err) {
      setTxState("failed");
      toast.error(err.reason || err.message || "Transaction failed", { id: toastId });
    }
  }

  async function generateQrs() {
    if (!qrBatchId) return toast.error("Enter a batch ID first");
    setQrLoading(true);
    try {
      const batchIdHex = strToBatchId(qrBatchId);
      const res = await fetch(`${API_URL}/api/batches/${batchIdHex}/qrs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: qrCount }),
      });
      const data = await res.json();
      setQrData(data);
      toast.success(`Generated ${data.count} QR codes`);
    } catch (err) {
      toast.error("QR generation failed: " + err.message);
    } finally {
      setQrLoading(false);
    }
  }

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <section className="glass-card p-6 animate-slide-up space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        🏭 <span>Manufacturer Panel</span>
      </h2>

      {/* Register batch form */}
      <form onSubmit={handleRegister} className="space-y-4">
        <h3 className="font-semibold text-white/80">Register New Batch</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-1">Lot Number *</label>
            <input id="mfg-lot" type="text" required value={form.lotNumber} onChange={f("lotNumber")}
                   placeholder="LOT-2024-AMOX-001" className="input-field" />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Drug Name *</label>
            <input id="mfg-drug" type="text" required value={form.drugName} onChange={f("drugName")}
                   placeholder="Amoxicillin 500mg" className="input-field" />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Manufacturer Name *</label>
            <input id="mfg-name" type="text" required value={form.mfgName} onChange={f("mfgName")}
                   placeholder="PharmaCo Ltd" className="input-field" />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Quantity (units) *</label>
            <input id="mfg-qty" type="number" min="1" required value={form.quantity} onChange={f("quantity")}
                   placeholder="1000" className="input-field" />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Expiry Date *</label>
            <input id="mfg-expiry" type="date" required value={form.expiryDate} onChange={f("expiryDate")}
                   min={new Date().toISOString().split("T")[0]} className="input-field" />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">Lab Certificate (for doc hash)</label>
            <input id="mfg-doc" type="text" value={form.docHashInput} onChange={f("docHashInput")}
                   placeholder="Certificate ID or text" className="input-field" />
          </div>
        </div>
        <button id="btn-register-batch" type="submit" disabled={txState === "pending"}
                className="btn-primary">
          {txState === "pending" ? "Sending…" : "Register Batch on Chain"}
        </button>
        {lastTx && (
          <p className="text-sm text-green-400">
            ✓ Batch ID: <span className="font-mono">{lastTx.batchId.slice(0, 12)}…</span>{" "}
            <a href={`${EXPLORER_BASE}/tx/${lastTx.hash}`} target="_blank" rel="noopener noreferrer"
               className="underline">View TX ↗</a>
          </p>
        )}
      </form>

      <hr className="border-white/10" />

      {/* QR generation */}
      <div className="space-y-3">
        <h3 className="font-semibold text-white/80">Generate QR Codes</h3>
        <div className="flex gap-3">
          <input id="qr-lot-input" type="text" value={qrBatchId}
                 onChange={(e) => setQrBatchId(e.target.value)}
                 placeholder="Lot number (same as above)" className="input-field flex-1" />
          <input id="qr-count-input" type="number" min="1" max="1000" value={qrCount}
                 onChange={(e) => setQrCount(Number(e.target.value))}
                 className="input-field w-24" />
          <button id="btn-gen-qr" onClick={generateQrs} disabled={qrLoading}
                  className="btn-secondary shrink-0">
            {qrLoading ? "…" : "Generate"}
          </button>
        </div>
        {qrData && (
          <div className="space-y-2">
            <p className="text-sm text-white/60">
              {qrData.count} QR codes generated. {qrData.note}
            </p>
            {/* Show first 3 as preview */}
            <div className="flex gap-3 overflow-x-auto pb-2">
              {qrData.qrs.slice(0, 3).map((q) => (
                <div key={q.serial} className="shrink-0 text-center">
                  <img src={q.dataUrl} alt={q.serial}
                       className="w-24 h-24 rounded-lg border border-white/20" />
                  <p className="text-xs font-mono text-white/40 mt-1">{q.serial}</p>
                </div>
              ))}
              {qrData.count > 3 && (
                <div className="shrink-0 w-24 h-24 rounded-lg border border-white/20
                                flex items-center justify-center text-white/40 text-sm">
                  +{qrData.count - 3} more
                </div>
              )}
            </div>
            <a href={`${API_URL}/api/batches/${strToBatchId(qrBatchId)}/qrs/zip?count=${qrCount}`}
               download className="btn-secondary inline-block text-sm py-2 px-4">
              ⬇ Download ZIP
            </a>
          </div>
        )}
      </div>

      <hr className="border-white/10" />

      {/* Recall */}
      <RecallForm contract={contract} />
    </section>
  );
}

// ─── Recall Form ────────────────────────────────────────────────────────────

function RecallForm({ contract }) {
  const [lotNumber, setLotNumber] = useState("");
  const [reason, setReason] = useState("");
  const [txState, setTxState] = useState(null);

  async function handleRecall(e) {
    e.preventDefault();
    setTxState("pending");
    const toastId = toast.loading("Recalling batch…");
    try {
      const batchId = strToBatchId(lotNumber);
      const tx = await contract.recallBatch(batchId, reason);
      await waitForTx(tx);
      setTxState("confirmed");
      toast.success(
        <span>Batch recalled! <a href={`${EXPLORER_BASE}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="underline">View TX</a></span>,
        { id: toastId, duration: 8000 }
      );
    } catch (err) {
      setTxState("failed");
      toast.error(err.reason || err.message || "Recall failed", { id: toastId });
    }
  }

  return (
    <form onSubmit={handleRecall} className="space-y-3">
      <h3 className="font-semibold text-red-400">⛔ Recall a Batch</h3>
      <input id="recall-lot" type="text" required value={lotNumber}
             onChange={(e) => setLotNumber(e.target.value)}
             placeholder="Lot number to recall" className="input-field" />
      <input id="recall-reason" type="text" required value={reason}
             onChange={(e) => setReason(e.target.value)}
             placeholder="Reason for recall" className="input-field" />
      <button id="btn-recall" type="submit" disabled={txState === "pending"}
              className="btn-danger">
        {txState === "pending" ? "Recalling…" : "Recall Batch"}
      </button>
    </form>
  );
}

// ─── Transfer Panel (Distributor + Pharmacy) ─────────────────────────────────

function TransferPanel({ contract, address, role }) {
  const [lotNumber, setLotNumber] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [note, setNote] = useState("");
  const [txState, setTxState] = useState(null);
  const [lastTx, setLastTx] = useState(null);

  async function handleTransfer(e) {
    e.preventDefault();
    setTxState("pending");
    const toastId = toast.loading("Transferring batch…");
    try {
      const batchId = strToBatchId(lotNumber);
      const tx = await contract.transferBatch(batchId, toAddress, note);
      await waitForTx(tx);
      setTxState("confirmed");
      setLastTx(tx.hash);
      toast.success(
        <span>Transfer complete! <a href={`${EXPLORER_BASE}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="underline">View TX</a></span>,
        { id: toastId, duration: 8000 }
      );
    } catch (err) {
      setTxState("failed");
      toast.error(err.reason || err.message || "Transfer failed", { id: toastId });
    }
  }

  return (
    <section className="glass-card p-6 animate-slide-up">
      <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
        {role === "Distributor" ? "🚚" : "🏥"}{" "}
        <span>{role} Panel</span>
      </h2>
      <form onSubmit={handleTransfer} className="space-y-4">
        <div>
          <label className="block text-sm text-white/60 mb-1">Lot Number to Transfer</label>
          <input id={`${role.toLowerCase()}-lot`} type="text" required
                 value={lotNumber} onChange={(e) => setLotNumber(e.target.value)}
                 placeholder="Lot number" className="input-field" />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1">
            Recipient Address ({role === "Distributor" ? "Pharmacy" : "Next party"})
          </label>
          <input id={`${role.toLowerCase()}-to`} type="text" required
                 value={toAddress} onChange={(e) => setToAddress(e.target.value)}
                 placeholder="0x..." className="input-field font-mono" />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1">Note (optional)</label>
          <input id={`${role.toLowerCase()}-note`} type="text"
                 value={note} onChange={(e) => setNote(e.target.value)}
                 placeholder="e.g. Delivered to Pune pharmacy" className="input-field" />
        </div>
        <button id={`btn-transfer-${role.toLowerCase()}`} type="submit"
                disabled={txState === "pending"} className="btn-primary">
          {txState === "pending" ? "Sending…" : `Transfer Batch →`}
        </button>
        {lastTx && (
          <p className="text-sm text-green-400">
            ✓ <a href={`${EXPLORER_BASE}/tx/${lastTx}`} target="_blank" rel="noopener noreferrer"
                 className="underline">View on Explorer ↗</a>
          </p>
        )}
      </form>
    </section>
  );
}

// ─── Regulator Panel ─────────────────────────────────────────────────────────

function RegulatorPanel({ contract, stats, recalls, onRefresh }) {
  const [recallLot, setRecallLot]     = useState("");
  const [recallReason, setRecallReason] = useState("");
  const [txState, setTxState]         = useState(null);

  async function handleRegulatorRecall(e) {
    e.preventDefault();
    setTxState("pending");
    const toastId = toast.loading("Issuing recall order…");
    try {
      const batchId = strToBatchId(recallLot);
      const tx = await contract.recallBatch(batchId, recallReason);
      await waitForTx(tx);
      setTxState("confirmed");
      toast.success(
        <span>Recall order issued! <a href={`${EXPLORER_BASE}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="underline">View TX</a></span>,
        { id: toastId, duration: 8000 }
      );
      onRefresh();
    } catch (err) {
      setTxState("failed");
      toast.error(err.reason || err.message || "Recall failed", { id: toastId });
    }
  }

  return (
    <section className="glass-card p-6 animate-slide-up space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          ⚖️ <span>Regulator Panel</span>
        </h2>
        <button onClick={onRefresh} className="btn-secondary text-sm py-2 px-4">
          🔄 Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Batches",   value: stats.batches?.total     ?? "—" },
            { label: "Recalled",        value: stats.batches?.recalled  ?? "—" },
            { label: "Total Scans",     value: stats.scans?.totalScans  ?? "—" },
            { label: "Suspicious Flags",value: stats.scans?.suspiciousScans ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} className="stat-card">
              <p className="text-3xl font-black text-teal-400">{value}</p>
              <p className="text-xs text-white/50 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recall form */}
      <form onSubmit={handleRegulatorRecall} className="space-y-3">
        <h3 className="font-semibold text-red-400">⛔ Issue Recall Order</h3>
        <input id="reg-recall-lot" type="text" required value={recallLot}
               onChange={(e) => setRecallLot(e.target.value)}
               placeholder="Lot number to recall" className="input-field" />
        <input id="reg-recall-reason" type="text" required value={recallReason}
               onChange={(e) => setRecallReason(e.target.value)}
               placeholder="Regulatory recall reason" className="input-field" />
        <button id="btn-reg-recall" type="submit" disabled={txState === "pending"}
                className="btn-danger">
          {txState === "pending" ? "Processing…" : "Issue Recall Order"}
        </button>
      </form>

      {/* Recent recalls table */}
      {recalls.length > 0 && (
        <div>
          <h3 className="font-semibold text-white/70 mb-3">Recent Recalls</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/40 border-b border-white/10">
                  <th className="pb-2 pr-4">Drug</th>
                  <th className="pb-2 pr-4">Reason</th>
                  <th className="pb-2">TX</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recalls.slice(0, 10).map((r) => (
                  <tr key={r.batchId} className="text-white/70">
                    <td className="py-2 pr-4">{r.batch?.drugName ?? r.batchId.slice(0, 10)+"…"}</td>
                    <td className="py-2 pr-4 text-red-400">{r.reason}</td>
                    <td className="py-2">
                      <a href={`${EXPLORER_BASE}/tx/${r.txHash}`} target="_blank"
                         rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300">
                        ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
