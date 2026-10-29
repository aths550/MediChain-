import React from "react";

/**
 * ResultBadge — large coloured status badge with icon and animated glow.
 *
 * result: "VERIFIED" | "SUSPICIOUS" | "EXPIRED" | "RECALLED" | "UNKNOWN" | "IN_TRANSIT"
 */

const CONFIG = {
  VERIFIED: {
    label:    "✓ VERIFIED",
    class:    "badge-verified",
    bg:       "from-green-500/20 to-emerald-500/10",
    icon:     "✓",
    iconBg:   "bg-green-500",
    desc:     "This medicine is genuine.",
  },
  SUSPICIOUS: {
    label:    "⚠ SUSPICIOUS",
    class:    "badge-suspicious",
    bg:       "from-amber-500/20 to-orange-500/10",
    icon:     "⚠",
    iconBg:   "bg-amber-500",
    desc:     "Possible counterfeit detected.",
  },
  EXPIRED: {
    label:    "✕ EXPIRED",
    class:    "badge-expired",
    bg:       "from-red-500/20 to-rose-500/10",
    icon:     "✕",
    iconBg:   "bg-red-500",
    desc:     "This batch has expired.",
  },
  RECALLED: {
    label:    "⛔ RECALLED",
    class:    "badge-recalled",
    bg:       "from-red-700/20 to-red-900/10",
    icon:     "⛔",
    iconBg:   "bg-red-700",
    desc:     "This batch has been recalled.",
  },
  UNKNOWN: {
    label:    "? UNKNOWN",
    class:    "badge-unknown",
    bg:       "from-gray-500/20 to-slate-500/10",
    icon:     "?",
    iconBg:   "bg-gray-500",
    desc:     "Cannot verify this medicine.",
  },
  IN_TRANSIT: {
    label:    "↗ IN TRANSIT",
    class:    "badge-in-transit",
    bg:       "from-blue-500/20 to-cyan-500/10",
    icon:     "↗",
    iconBg:   "bg-blue-500",
    desc:     "Not yet at a pharmacy.",
  },
};

export default function ResultBadge({ result, reasons = [] }) {
  const cfg = CONFIG[result] || CONFIG.UNKNOWN;

  return (
    <div className={`relative overflow-hidden rounded-3xl border-2 p-8 text-center animate-slide-up
                     bg-gradient-to-br ${cfg.bg} ${cfg.class}`}>
      {/* Large icon */}
      <div className={`mx-auto mb-4 w-20 h-20 ${cfg.iconBg} rounded-full
                       flex items-center justify-center text-4xl text-white font-bold
                       shadow-lg`}>
        <span role="img" aria-label={result}>{cfg.icon}</span>
      </div>

      {/* Status label */}
      <h2 className="text-3xl sm:text-4xl font-black tracking-wider mb-3">
        {cfg.label}
      </h2>

      <p className="text-lg opacity-80 mb-4">{cfg.desc}</p>

      {/* Reasons */}
      {reasons.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm text-left max-w-sm mx-auto">
          {reasons.map((r, i) => (
            <li key={i} className="flex gap-2 items-start opacity-90">
              <span className="mt-0.5 shrink-0">›</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
