import React from "react";
import { Link } from "react-router-dom";

/**
 * /demo — Demo scenarios guide for the hackathon presentation.
 * Shows QR images and step-by-step instructions for all 4 demo batches.
 */
export default function Demo() {
  const scenarios = [
    {
      id: 1,
      icon: "✅",
      label: "VERIFIED",
      color: "text-green-400 border-green-500/30 bg-green-500/5",
      title: "Scenario 1 — Genuine Medicine",
      drug: "Amoxicillin 500mg",
      desc: "Scan the QR code on the Amoxicillin strip. The batch has completed the full journey: " +
            "manufacturer → distributor → pharmacy. Result: VERIFIED with full journey timeline.",
      steps: [
        "Open the Scan page or point camera at the Amoxicillin QR code.",
        "Watch the loading spinner (< 2s).",
        "See the green VERIFIED badge with the 3-step journey timeline.",
        "Tap 'View on Explorer' links to see on-chain transactions.",
      ],
    },
    {
      id: 2,
      icon: "⏰",
      label: "EXPIRED",
      color: "text-red-400 border-red-500/30 bg-red-500/5",
      title: "Scenario 2 — Expired Medicine (Live Flip)",
      drug: "Azithromycin 250mg",
      desc: "This batch was seeded with expiry set 5 minutes after seeding. " +
            "Scan it during the demo — it will flip to EXPIRED in real time (no redeploy needed).",
      steps: [
        "Scan the Azithromycin QR code.",
        "If scanned within 5 min of seeding: shows as VERIFIED (or IN_TRANSIT if not yet at pharmacy).",
        "Wait until expiry passes (seed script prints exact time).",
        "Scan again — result flips to EXPIRED with the exact expiry date.",
      ],
    },
    {
      id: 3,
      icon: "⛔",
      label: "RECALLED",
      color: "text-red-300 border-red-700/30 bg-red-700/5",
      title: "Scenario 3 — Recalled Medicine",
      drug: "Paracetamol 650mg",
      desc: "The Paracetamol batch is at a pharmacy. During the demo, a regulator recalls it " +
            "live via the Dashboard. Subsequent scans immediately show RECALLED.",
      steps: [
        "First, scan the Paracetamol QR → shows VERIFIED (at pharmacy).",
        "Open Dashboard, connect as Regulator wallet.",
        "Enter lot number 'PARA-DEMO-001' and reason 'Contamination found'.",
        "Click Issue Recall Order → confirm MetaMask transaction.",
        "Scan the same QR again → result instantly flips to RECALLED with reason.",
      ],
    },
    {
      id: 4,
      icon: "↗",
      label: "IN TRANSIT",
      color: "text-blue-400 border-blue-500/30 bg-blue-500/5",
      title: "Scenario 4 — In Transit",
      drug: "Metformin 500mg",
      desc: "This batch is stuck at the distributor — never reached a pharmacy. " +
            "Demonstrates the in-transit soft warning state.",
      steps: [
        "Scan the Metformin QR code.",
        "Result shows blue IN TRANSIT badge.",
        "Reason: 'In transit — this batch is at a Distributor and has not reached a pharmacy yet.'",
        "Journey shows: Manufacturer ✓ → Distributor ✓ → Pharmacy ⏳",
      ],
    },
    {
      id: 5,
      icon: "⚠",
      label: "SUSPICIOUS",
      color: "text-amber-400 border-amber-500/30 bg-amber-500/5",
      title: "Scenario 5 — Cloned QR (Bonus)",
      drug: "Any batch at pharmacy",
      desc: "Scan the same verified QR from 3+ different browser sessions/devices within 24h. " +
            "The result flips to SUSPICIOUS — simulating a counterfeit QR clone attack.",
      steps: [
        "Open an incognito window and scan a VERIFIED QR → session 1.",
        "Open another incognito window and scan the same QR → session 2.",
        "Open a 3rd window (or different device) and scan again → session 3.",
        "On 3rd scan: result flips to SUSPICIOUS with 'scanned from 3 different sessions' reason.",
      ],
    },
  ];

  return (
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10 animate-slide-up">
          <h1 className="text-3xl font-bold mb-2">Demo Scenarios</h1>
          <p className="text-white/60">
            Follow these scripts for the hackathon presentation.
            All scenarios can be demonstrated live without redeployment.
          </p>
        </div>

        <div className="space-y-6">
          {scenarios.map((s) => (
            <div key={s.id} className={`glass-card border p-6 animate-slide-up ${s.color}`}>
              <div className="flex items-start gap-4">
                <div className="text-4xl shrink-0">{s.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h2 className="text-xl font-bold">{s.title}</h2>
                    <span className={`text-xs font-bold rounded-full px-2 py-0.5 border ${s.color}`}>
                      {s.label}
                    </span>
                  </div>
                  <p className="text-sm text-white/50 mb-1">Drug: <span className="text-white/80">{s.drug}</span></p>
                  <p className="text-sm text-white/70 mb-4">{s.desc}</p>
                  <ol className="space-y-2">
                    {s.steps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center
                                         justify-center text-xs font-bold text-white/60">
                          {i + 1}
                        </span>
                        <span className="text-white/80">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 glass-card p-6 text-sm text-white/60 animate-fade-in">
          <p className="font-semibold text-white/80 mb-3">📖 Persona: Priya</p>
          <p>
            Priya is a pharmacist at a busy clinic in Pune. She scans every incoming medicine strip
            to verify authenticity before dispensing. Today she encounters all 5 scenarios — and
            MediChain gives her the answer in under 2 seconds every time.
          </p>
          <p className="mt-3">
            See <span className="text-teal-400">DEMO_SCRIPT.md</span> for the full 2.5-minute video script.
          </p>
        </div>

        <div className="flex gap-3 mt-6 animate-fade-in">
          <Link to="/scan" className="btn-primary flex-1 text-center">Start Scanning →</Link>
          <Link to="/dashboard" className="btn-secondary flex-1 text-center">Open Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
