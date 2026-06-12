import React from "react";
import { Link } from "react-router-dom";
import { algoToInr, algoToUsd } from "../../constants/studioPlans.js";

export default function StudioCreditWallet({ usage, compact = false }) {
  const tier = usage?.tier || "pay-per-call";
  const isPayPerCall = tier === "pay-per-call" || !usage?.studioCreditPool;

  if (isPayPerCall) {
    if (compact) {
      return (
        <div className="text-xs text-slate-600">
          <span className="font-semibold text-[#031634]">Pay per call</span>
        </div>
      );
    }
    return (
      <div className="rounded-md border border-surface-variant bg-white p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Billing</p>
        <p className="text-sm font-semibold text-[#031634]">Pay-per-call active</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Each Studio run prompts for an on-chain ALGO payment via your connected wallet.
        </p>
        <Link
          to="/studio/plan"
          className="inline-block text-[11px] font-semibold text-[#031634] hover:underline"
        >
          View rates →
        </Link>
      </div>
    );
  }

  const remaining = usage?.studioCredits ?? 0;
  const pool = usage?.studioCreditPool ?? 15;
  const used = Math.max(0, pool - remaining);
  const pct = pool > 0 ? Math.min(100, (used / pool) * 100) : 0;
  const resetAt = usage?.usageResetAt ? new Date(usage.usageResetAt) : null;

  if (compact) {
    return (
      <div className="text-xs text-slate-600">
        <span className="font-semibold text-[#031634]">{remaining}</span>
        <span className="text-slate-400"> / {pool} credits</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-surface-variant bg-white p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Studio Credits</p>
          <p className="text-2xl font-bold text-[#031634] tabular-nums">{remaining}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-slate-500">{tier} plan</p>
          <p className="text-xs text-slate-600">of {pool} / month</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${remaining <= 0 ? "bg-amber-500" : "bg-[#031634]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {resetAt && (
        <p className="text-[10px] text-slate-500">
          Resets {resetAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
      )}
      {remaining <= 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          Credits exhausted — runs bill per-use in ALGO via x402.
        </div>
      )}
      <Link
        to="/studio/plan"
        className="inline-block text-[11px] font-semibold text-[#031634] hover:underline"
      >
        Get more credits →
      </Link>
    </div>
  );
}

export function OveragePriceHint({ microAlgos }) {
  if (!microAlgos) return null;
  return (
    <p className="text-[10px] text-slate-500">
      ≈ ₹{algoToInr(microAlgos)} · ≈ ${algoToUsd(microAlgos)}
    </p>
  );
}
