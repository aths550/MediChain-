import React from "react";

const EXPLORER_BASE = import.meta.env.VITE_EXPLORER_URL || "https://testnet.mstscan.com";

/**
 * JourneyTimeline — vertical timeline of the batch's supply chain journey.
 *
 * history: [{ from, to, timestamp, note }]
 * currentHolder: string (address)
 * currentStage: "Manufacturer" | "Distributor" | "Pharmacy"
 */

const STAGE_ICONS = {
  Manufacturer: "🏭",
  Distributor:  "🚚",
  Pharmacy:     "🏥",
};

const STAGE_COLORS = {
  Manufacturer: "bg-purple-500",
  Distributor:  "bg-blue-500",
  Pharmacy:     "bg-teal-500",
};

function shortAddr(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function stageFromHistory(index, history) {
  // index 0 = first transfer (mfg→dist), index 1 = second (dist→pharmacy)
  if (index === 0) return "Distributor";
  if (index === 1) return "Pharmacy";
  return "Unknown";
}

export default function JourneyTimeline({ batch, history = [] }) {
  if (!batch) return null;

  // Build timeline steps
  // Step 0 is always the registration (manufacturer holding)
  const steps = [
    {
      stage:     "Manufacturer",
      actor:     batch.originalManufacturer,
      label:     "Batch Registered",
      note:      `${batch.drugName} · Qty: ${batch.quantity}`,
      timestamp: batch.manufactureDate,
      txHash:    null,
    },
    ...history.map((h, i) => ({
      stage:     stageFromHistory(i, history),
      actor:     h.to,
      label:     `Transferred to ${stageFromHistory(i, history)}`,
      note:      h.note,
      timestamp: h.timestamp,
      txHash:    null, // tx hash not stored on-chain in struct
    })),
  ];

  return (
    <div className="glass-card p-6 animate-slide-up">
      <h3 className="text-lg font-semibold mb-6 text-teal-400">Supply Chain Journey</h3>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-white/10" />

        <div className="space-y-6">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const isCurrent = isLast;
            const date = step.timestamp
              ? new Date(step.timestamp * 1000).toLocaleString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })
              : null;

            return (
              <div key={idx} className="relative flex gap-4 pl-2">
                {/* Circle indicator */}
                <div className={`relative z-10 shrink-0 w-10 h-10 rounded-full
                                 ${isCurrent ? STAGE_COLORS[step.stage] || "bg-teal-500" : "bg-white/20"}
                                 flex items-center justify-center text-lg shadow-lg
                                 ${isCurrent ? "ring-2 ring-offset-2 ring-offset-slate-900 ring-teal-500" : ""}`}>
                  {STAGE_ICONS[step.stage] || "📦"}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-6">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-white">{step.label}</p>
                      <p className="text-sm text-white/50 font-mono mt-0.5">
                        {shortAddr(step.actor)}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="shrink-0 text-xs bg-teal-600/30 text-teal-400
                                       border border-teal-500/30 rounded-full px-2 py-0.5">
                        Current
                      </span>
                    )}
                  </div>

                  {step.note && (
                    <p className="text-sm text-white/60 mt-1 italic">{step.note}</p>
                  )}

                  {date && (
                    <p className="text-xs text-white/40 mt-1">{date}</p>
                  )}

                  {step.txHash && (
                    <a
                      href={`${EXPLORER_BASE}/tx/${step.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-teal-400 hover:text-teal-300 mt-1 inline-block"
                    >
                      View on Explorer ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expiry notice */}
      {batch.expiryDate && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-sm text-white/50">
            Expires:{" "}
            <span className="text-white/80">
              {new Date(batch.expiryDate * 1000).toLocaleDateString("en-IN", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </span>
          </p>
          <p className="text-sm text-white/50 mt-1">
            Doc Hash:{" "}
            <span className="font-mono text-white/40 text-xs break-all">
              {batch.docHash?.slice(0, 20)}…
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
