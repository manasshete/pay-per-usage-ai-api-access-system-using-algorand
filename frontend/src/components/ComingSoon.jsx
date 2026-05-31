import React from "react";
import { Link } from "react-router-dom";

export default function ComingSoon({
  title,
  description,
  icon = "construction",
  backTo = "/studio",
  backLabel = "Back to Studio",
}) {
  return (
    <div className="pt-6 max-w-5xl">
      <div className="bg-white border border-surface-variant rounded-md p-10 text-center editorial-shadow">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-slate-400">{icon}</span>
        </div>
        <span className="inline-block mt-6 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          Coming Soon
        </span>
        <h1 className="font-headline text-2xl font-semibold text-primary mt-4">{title}</h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto leading-relaxed">
          {description}
        </p>
        <Link
          to={backTo}
          className="inline-block mt-8 text-sm text-secondary hover:underline font-medium"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
