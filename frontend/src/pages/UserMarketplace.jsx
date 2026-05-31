import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import MarketplaceCard from "../components/MarketplaceCard.jsx";

const PROVIDERS = [
  { value: "", label: "All providers" },
  { value: "groq", label: "Groq" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "together", label: "Together" },
];

export default function UserMarketplace() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [x402Only, setX402Only] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = {};
        if (debouncedSearch) params.search = debouncedSearch;
        if (provider) params.provider = provider;
        if (x402Only) params.x402 = "true";
        const { data } = await api.get("/api/services", { params });
        if (!cancelled) setServices(data);
      } catch {
        toast.error("Failed to load services");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, provider, x402Only]);

  const categories = useMemo(() => {
    const map = new Map();
    services.forEach((s) => {
      const key = s.aiProvider || "Other";
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries());
  }, [services]);

  const featured = useMemo(() => services.slice(0, 4), [services]);
  const trending = useMemo(
    () => [...services].sort((a, b) => (b.totalUses ?? 0) - (a.totalUses ?? 0)).slice(0, 4),
    [services]
  );

  const hasFilters = Boolean(debouncedSearch || provider || x402Only);

  return (
    <div className="max-w-5xl">
      <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Marketplace</h1>
      <p className="text-on-surface-variant text-sm mb-6">
        Browse AI APIs. Pricing is per thousand tokens consumed (with a per-call minimum).
      </p>

      <section className="mb-8 bg-white border border-surface-variant rounded-md p-4 space-y-4">
        <div>
          <label htmlFor="marketplace-search" className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
            Search
          </label>
          <input
            id="marketplace-search"
            type="search"
            placeholder="Search by title or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-1 w-full border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="flex-1">
            <label htmlFor="marketplace-provider" className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              AI provider
            </label>
            <select
              id="marketplace-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="mt-1 w-full border border-outline-variant rounded-md px-3 py-2 text-sm bg-white"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value || "all"} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={x402Only}
              onChange={(e) => setX402Only(e.target.checked)}
              className="rounded border-outline-variant text-secondary focus:ring-secondary"
            />
            x402 enabled only
          </label>
        </div>
      </section>

      {!hasFilters && (
        <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white border border-surface-variant rounded-md p-4">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">Categories</p>
            <p className="font-headline text-xl text-primary mt-1">{categories.length}</p>
          </div>
          <div className="bg-white border border-surface-variant rounded-md p-4">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">Listed APIs</p>
            <p className="font-headline text-xl text-primary mt-1">{services.length}</p>
          </div>
          <div className="bg-white border border-surface-variant rounded-md p-4">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">x402 Ready</p>
            <p className="font-headline text-xl text-primary mt-1">
              {services.filter((s) => s.x402Enabled).length}
            </p>
          </div>
          <div className="bg-white border border-surface-variant rounded-md p-4">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant">Trending</p>
            <p className="font-headline text-xl text-primary mt-1">{trending.length}</p>
          </div>
        </section>
      )}

      {loading ? (
        <p className="text-on-surface-variant">Loading services…</p>
      ) : services.length === 0 ? (
        <p className="text-on-surface-variant">No services match your filters.</p>
      ) : hasFilters ? (
        <section>
          <h2 className="font-semibold text-primary mb-4">
            Results ({services.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((s) => (
              <MarketplaceCard key={s._id} s={s} />
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="font-semibold text-primary mb-4">Featured APIs</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {featured.map((s) => (
                <MarketplaceCard key={s._id} s={s} />
              ))}
            </div>
          </section>
          <section className="mb-8">
            <h2 className="font-semibold text-primary mb-4">Trending APIs</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {trending.map((s) => (
                <MarketplaceCard key={s._id} s={s} />
              ))}
            </div>
          </section>
          <section>
            <h2 className="font-semibold text-primary mb-4">All services</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {services.map((s) => (
                <MarketplaceCard key={s._id} s={s} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
