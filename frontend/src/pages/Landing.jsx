import React from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center
                          px-4 pt-32 pb-20 text-center relative overflow-hidden">

        {/* Background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96
                          bg-teal-600/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80
                          bg-cyan-600/15 rounded-full blur-3xl animate-pulse-slow"
               style={{ animationDelay: "1.5s" }} />
        </div>

        {/* Badge */}
        <div className="relative mb-6 inline-flex items-center gap-2 text-xs
                        bg-teal-600/20 border border-teal-500/30 text-teal-400
                        rounded-full px-4 py-1.5 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          Live on MST Blockchain Testnet
        </div>

        {/* Headline */}
        <h1 className="relative text-5xl sm:text-7xl font-black tracking-tight
                       leading-none mb-6 animate-slide-up">
          <span className="text-gradient">Scan it.</span>
          <br />
          <span className="text-white">Trust it.</span>
        </h1>

        <p className="relative text-lg sm:text-xl text-white/60 max-w-xl mb-10 animate-slide-up"
           style={{ animationDelay: "0.1s" }}>
          Instant medicine authenticity verification on the blockchain.
          Every batch, every handoff — transparent and tamper-proof.
        </p>

        {/* CTA buttons */}
        <div className="relative flex flex-col sm:flex-row gap-4 animate-slide-up"
             style={{ animationDelay: "0.2s" }}>
          <Link to="/scan" id="cta-scan"
                className="btn-primary flex items-center gap-2 text-lg py-4 px-8">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3m2 8H3m18-8h-2M5 8h14M5 16h14" />
            </svg>
            Scan a Medicine
          </Link>
          <Link to="/dashboard" id="cta-dashboard" className="btn-secondary text-lg py-4 px-8">
            Open Dashboard
          </Link>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-black/20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">How it works</h2>
          <p className="text-white/50 text-center mb-12">
            Every medicine batch is registered and tracked on-chain.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                icon: "🏭",
                title: "Manufacturer Registers",
                desc:  "Batch details and lab-certificate hash are written to the blockchain.",
              },
              {
                step: "02",
                icon: "🚚",
                title: "Chain of Custody",
                desc:  "Each handoff — to distributor, then pharmacy — is logged on-chain in order.",
              },
              {
                step: "03",
                icon: "📱",
                title: "Patient Scans",
                desc:  "One scan shows VERIFIED, SUSPICIOUS, EXPIRED, RECALLED, or IN TRANSIT instantly.",
              },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="glass-card p-6 relative overflow-hidden group
                                        hover:border-teal-500/30 transition-all duration-300">
                <div className="absolute top-4 right-4 text-5xl font-black text-white/5
                                group-hover:text-white/10 transition-colors duration-300 select-none">
                  {step}
                </div>
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-white/60 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Status legend ─────────────────────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Scan Results</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { result: "VERIFIED",    color: "text-green-400 bg-green-500/10 border-green-500/30", emoji: "✓" },
              { result: "SUSPICIOUS",  color: "text-amber-400 bg-amber-500/10 border-amber-500/30", emoji: "⚠" },
              { result: "EXPIRED",     color: "text-red-400 bg-red-500/10 border-red-500/30",       emoji: "✕" },
              { result: "RECALLED",    color: "text-red-300 bg-red-700/10 border-red-700/30",       emoji: "⛔" },
              { result: "IN TRANSIT",  color: "text-blue-400 bg-blue-500/10 border-blue-500/30",   emoji: "↗" },
              { result: "UNKNOWN",     color: "text-gray-400 bg-gray-500/10 border-gray-500/30",   emoji: "?" },
            ].map(({ result, color, emoji }) => (
              <div key={result}
                   className={`rounded-xl border p-4 text-center font-semibold ${color}`}>
                <span className="text-2xl mr-2">{emoji}</span>{result}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="text-center py-8 text-white/30 text-sm border-t border-white/10">
        MediChain · MST Blockchain Hackathon · Built for real-world impact
      </footer>
    </main>
  );
}
