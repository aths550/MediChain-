import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5QrcodeScanner } from "html5-qrcode";

/**
 * /scan — Camera QR scanner + manual batch ID entry.
 * On successful QR scan, navigates to /verify/:batchId with search params.
 */
export default function Scan() {
  const navigate = useNavigate();
  const [manualId, setManualId] = useState("");
  const [mode, setMode] = useState("camera"); // "camera" | "manual"
  const [error, setError] = useState("");
  const scannerRef = useRef(null);
  const scannerDivRef = useRef(null);

  useEffect(() => {
    if (mode !== "camera") return;

    // Cleanup any previous scanner instance
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
    }

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        aspectRatio: 1.0,
      },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        // Parse the scanned URL
        try {
          const url = new URL(decodedText);
          // Expected: https://<host>/verify/<batchId>?s=...&sig=...
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts[0] === "verify" && pathParts[1]) {
            const batchId = pathParts[1];
            const params = url.search; // includes ?s=...&sig=...
            scanner.clear().catch(() => {});
            navigate(`/verify/${batchId}${params}`);
          } else {
            setError("QR code does not appear to be a MediChain code. Please scan a valid medicine QR.");
          }
        } catch {
          // Not a URL — try treating it as a raw batchId
          if (decodedText.startsWith("0x") && decodedText.length === 66) {
            scanner.clear().catch(() => {});
            navigate(`/verify/${decodedText}`);
          } else {
            setError("Unrecognised QR code format.");
          }
        }
      },
      (errorMsg) => {
        // Scan errors are normal (no QR in frame) — don't surface them
        // Only log non-trivial errors for debugging
        if (!errorMsg.includes("NotFoundException")) {
          console.debug("[QR]", errorMsg);
        }
      }
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [mode, navigate]);

  function handleManualSubmit(e) {
    e.preventDefault();
    const id = manualId.trim();
    if (!id) return setError("Please enter a batch ID or lot number.");
    setError("");
    navigate(`/verify/${encodeURIComponent(id)}`);
  }

  return (
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold mb-2">Verify Medicine</h1>
          <p className="text-white/60">
            Scan the QR code on the medicine strip or enter the batch ID manually.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-xl overflow-hidden border border-white/20 mb-6 animate-slide-up">
          <button
            id="btn-mode-camera"
            onClick={() => { setMode("camera"); setError(""); }}
            className={`flex-1 py-3 font-semibold transition-all duration-200 ${
              mode === "camera"
                ? "bg-teal-600 text-white"
                : "bg-transparent text-white/60 hover:text-white"
            }`}
          >
            📷 Camera Scan
          </button>
          <button
            id="btn-mode-manual"
            onClick={() => { setMode("manual"); setError(""); }}
            className={`flex-1 py-3 font-semibold transition-all duration-200 ${
              mode === "manual"
                ? "bg-teal-600 text-white"
                : "bg-transparent text-white/60 hover:text-white"
            }`}
          >
            ⌨ Manual Entry
          </button>
        </div>

        {/* Camera scanner */}
        {mode === "camera" && (
          <div className="glass-card p-4 animate-fade-in">
            <div id="qr-reader" ref={scannerDivRef} className="w-full rounded-xl overflow-hidden" />
            <p className="text-center text-white/40 text-sm mt-4">
              Point your camera at the QR code on the medicine strip.
            </p>
          </div>
        )}

        {/* Manual entry */}
        {mode === "manual" && (
          <div className="glass-card p-6 animate-fade-in">
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label htmlFor="batch-id-input" className="block text-sm font-medium text-white/70 mb-2">
                  Batch ID / Lot Number
                </label>
                <input
                  id="batch-id-input"
                  type="text"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="e.g. 0xabc123... or LOT-2024-001"
                  className="input-field font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-xs text-white/40 mt-2">
                  Find the batch ID printed on the medicine box or packaging.
                </p>
              </div>
              <button id="btn-verify-manual" type="submit" className="btn-primary w-full">
                Verify →
              </button>
            </form>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-500/20 border border-red-500/30 rounded-xl p-4
                          text-red-400 text-sm animate-slide-up">
            {error}
          </div>
        )}

        {/* Tips */}
        <div className="mt-8 glass-card p-5 text-sm text-white/50 space-y-2 animate-fade-in">
          <p className="font-medium text-white/70 mb-3">💡 Tips</p>
          <p>• Hold the camera steady, 10–20 cm from the QR code.</p>
          <p>• Ensure good lighting — avoid glare on the packaging.</p>
          <p>• The QR code is usually on the back of the medicine strip.</p>
          <p>• If camera doesn't work, use Manual Entry with the lot number.</p>
        </div>
      </div>
    </main>
  );
}
