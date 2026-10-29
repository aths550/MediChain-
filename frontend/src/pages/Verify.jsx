import React, { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import ResultBadge from "../components/ResultBadge.jsx";
import JourneyTimeline from "../components/JourneyTimeline.jsx";

const API_URL = import.meta.env.VITE_API_URL || "";
const EXPLORER_BASE = import.meta.env.VITE_EXPLORER_URL || "https://testnet.mstscan.com";

/**
 * /verify/:batchId?s=<serial>&sig=<hmac>&session=<sessionId>
 * Shows the result badge and journey timeline for a scanned medicine.
 */
export default function Verify() {
  const { batchId } = useParams();
  const [searchParams] = useSearchParams();

  const serial    = searchParams.get("s");
  const sig       = searchParams.get("sig");
  const sessionId = searchParams.get("session") ?? generateSessionId();

  const [state, setState] = useState({ loading: true, data: null, error: null });

  const verify = useCallback(async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const params = new URLSearchParams();
      if (serial)    params.set("s",       serial);
      if (sig)       params.set("sig",     sig);
      if (sessionId) params.set("session", sessionId);

      const url = `${API_URL}/api/verify/${encodeURIComponent(batchId)}?${params}`;
      const res = await fetch(url, {
        headers: { "x-session-id": sessionId },
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setState({ loading: false, data, error: null });
    } catch (err) {
      setState({
        loading: false,
        data: null,
        error: err.message || "Failed to verify medicine. Please check your connection.",
      });
    }
  }, [batchId, serial, sig, sessionId]);

  useEffect(() => { verify(); }, [verify]);

  if (state.loading) {
    return (
      <main className="min-h-screen pt-24 px-4 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent
                          rounded-full animate-spin mx-auto mb-6" />
          <p className="text-white/60 text-lg">Verifying on blockchain…</p>
          <p className="text-white/30 text-sm mt-2">This usually takes under 2 seconds.</p>
        </div>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="min-h-screen pt-24 px-4">
        <div className="max-w-lg mx-auto">
          <div className="glass-card p-8 text-center animate-slide-up">
            <div className="text-5xl mb-4">⚠</div>
            <h2 className="text-xl font-bold mb-2 text-red-400">Verification Failed</h2>
            <p className="text-white/60 mb-6">{state.error}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={verify} className="btn-primary">Retry</button>
              <Link to="/scan" className="btn-secondary">Back to Scan</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const { result, reasons, batch } = state.data;

  return (
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Result Badge */}
        <ResultBadge result={result} reasons={reasons} />

        {/* Drug details */}
        {batch && (
          <div className="glass-card p-6 animate-slide-up space-y-4">
            <h3 className="text-lg font-semibold text-teal-400">Medicine Details</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-white/40 mb-0.5">Drug Name</dt>
                <dd className="font-semibold">{batch.drugName}</dd>
              </div>
              <div>
                <dt className="text-white/40 mb-0.5">Manufacturer</dt>
                <dd className="font-semibold">{batch.manufacturerName}</dd>
              </div>
              <div>
                <dt className="text-white/40 mb-0.5">Quantity</dt>
                <dd className="font-semibold">{Number(batch.quantity).toLocaleString()} units</dd>
              </div>
              <div>
                <dt className="text-white/40 mb-0.5">Expires</dt>
                <dd className={`font-semibold ${
                  batch.expiryDate * 1000 < Date.now() ? "text-red-400" : ""
                }`}>
                  {new Date(batch.expiryDate * 1000).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric"
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-white/40 mb-0.5">Status</dt>
                <dd className={`font-semibold ${batch.status === "Recalled" ? "text-red-400" : "text-green-400"}`}>
                  {batch.status}
                </dd>
              </div>
              <div>
                <dt className="text-white/40 mb-0.5">Current Stage</dt>
                <dd className="font-semibold">{batch.currentStage}</dd>
              </div>
              {batch.recallReason && (
                <div className="col-span-2">
                  <dt className="text-red-400/70 mb-0.5">Recall Reason</dt>
                  <dd className="text-red-300">{batch.recallReason}</dd>
                </div>
              )}
            </dl>

            {/* Batch ID */}
            <div className="pt-3 border-t border-white/10">
              <p className="text-xs text-white/30 mb-1">Batch ID (on-chain)</p>
              <a
                href={`${EXPLORER_BASE}/address/${batch.currentHolder}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-teal-400 hover:text-teal-300 break-all"
              >
                {batchId}
              </a>
            </div>
          </div>
        )}

        {/* Journey timeline */}
        {batch && (
          <JourneyTimeline batch={batch} history={batch.history || []} />
        )}

        {/* Serial info */}
        {serial && (
          <div className="glass-card p-4 text-sm text-white/40 animate-fade-in">
            Unit Serial: <span className="font-mono text-white/70">{serial}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 animate-fade-in">
          <Link to="/scan" className="btn-secondary flex-1 text-center">
            ← Scan Another
          </Link>
          <button onClick={verify} className="btn-secondary flex-1">
            🔄 Refresh
          </button>
        </div>
      </div>
    </main>
  );
}

// Generate a per-tab session ID stored in sessionStorage
function generateSessionId() {
  const key = "medichain-session";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}
