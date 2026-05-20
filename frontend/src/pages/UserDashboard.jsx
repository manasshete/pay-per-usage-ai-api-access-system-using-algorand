import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function UserDashboard() {
  const { user } = useAuth();
  const [keys, setKeys] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [k, u] = await Promise.all([
        api.get("/api/user/proxy-keys"),
        api.get("/api/user/usage?limit=50"),
      ]);
      setKeys(k.data ?? []);
      setUsage(u.data ?? []);
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  return (
    <div className="max-w-7xl">
      <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Marketplace Home</h1>
      <p className="text-sm text-on-surface-variant mb-6">
        API economy and infrastructure overview for developer workflows.
      </p>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <div className="bg-white border border-surface-variant rounded-md p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Identity</p>
          <p className="text-sm mt-1 font-semibold text-primary">{user?.displayName || "User"}</p>
        </div>
        <div className="bg-white border border-surface-variant rounded-md p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">ALGO Balance</p>
          <p className="text-sm mt-1 font-mono text-primary">{user?.walletAddress ? "Live in header" : "No wallet"}</p>
        </div>
        <div className="bg-white border border-surface-variant rounded-md p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Active Endpoints</p>
          <p className="text-2xl font-headline font-semibold text-primary mt-1">{keys.length}</p>
        </div>
        <div className="bg-white border border-surface-variant rounded-md p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">API Usage (recent)</p>
          <p className="text-2xl font-headline font-semibold text-primary mt-1">{usage.length}</p>
        </div>
        <div className="bg-white border border-surface-variant rounded-md p-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">Payment Activity</p>
          <p className="text-2xl font-headline font-semibold text-primary mt-1">{usage.slice(0, 5).length}</p>
        </div>
      </section>

      {loading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="bg-white border border-surface-variant rounded-md p-5">
            <h2 className="font-semibold text-primary mb-4">Quick Actions</h2>
            <div className="grid gap-2 text-sm">
              <Link to="/dashboard/browse" className="border border-outline-variant rounded-md px-3 py-2 hover:bg-slate-50 transition-colors">
                Browse APIs
              </Link>
              <Link to="/dashboard/featured" className="border border-outline-variant rounded-md px-3 py-2 hover:bg-slate-50 transition-colors">
                View Featured APIs
              </Link>
              <Link to="/dashboard/categories" className="border border-outline-variant rounded-md px-3 py-2 hover:bg-slate-50 transition-colors">
                Explore Categories
              </Link>
              <Link to="/dashboard/usage" className="border border-outline-variant rounded-md px-3 py-2 hover:bg-slate-50 transition-colors">
                Open Usage Analytics
              </Link>
              <Link to="/creator/new" className="border border-outline-variant rounded-md px-3 py-2 hover:bg-slate-50 transition-colors">
                Create Endpoint
              </Link>
            </div>
          </section>

          <section id="usage" className="bg-white border border-surface-variant rounded-md p-5">
            <h2 className="font-semibold text-primary mb-4">API Activity</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>Active endpoints</span>
                <span className="font-mono">{keys.length}</span>
              </li>
              <li className="flex justify-between">
                <span>Recent API calls</span>
                <span className="font-mono">{usage.length}</span>
              </li>
              <li className="flex justify-between">
                <span>Estimated latency tier</span>
                <span className="font-mono">P95 420ms</span>
              </li>
              <li className="flex justify-between">
                <span>ALGO spent (recent)</span>
                <span className="font-mono">
                  {usage.slice(0, 10).reduce((acc, row) => acc + Number(row.amountAlgo || 0), 0).toFixed(4)}
                </span>
              </li>
            </ul>
          </section>

          <section className="bg-white border border-surface-variant rounded-md p-5">
            <h2 className="font-semibold text-primary mb-4">Infrastructure Activity</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>Recent payments</span>
                <span className="font-mono">{usage.slice(0, 5).length}</span>
              </li>
              <li className="flex justify-between">
                <span>x402 settlement</span>
                <span className="text-on-surface-variant">Operational</span>
              </li>
              <li className="flex justify-between">
                <span>Worker status</span>
                <span className="text-on-surface-variant">Online</span>
              </li>
              <li className="flex justify-between">
                <span>API call activity</span>
                <span className="font-mono">{usage.length}</span>
              </li>
            </ul>
          </section>

          <section id="keys" className="lg:col-span-2 bg-white border border-surface-variant rounded-md p-5">
            <h2 className="font-semibold text-primary mb-4">My API Keys</h2>
            {keys.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                No keys yet. Open a service in the marketplace and generate one.
              </p>
            ) : (
              <div className="space-y-3">
                {keys.map((row) => (
                  <div key={row.id} className="bg-white border border-surface-variant rounded-md p-4 text-sm flex flex-col gap-1">
                    <p className="font-semibold">{row.service?.title ?? "Service"}</p>
                    <p className="text-on-surface-variant text-xs">
                      {row.service?.aiProvider} · {row.service?.modelName} ·{" "}
                      {Number(row.service?.pricePerThousandTokens ?? 0).toFixed(6)} ALGO/1k tok · min{" "}
                      {Number(row.service?.minimumChargeAlgo ?? 0).toFixed(6)} ALGO
                    </p>
                    <p className="font-mono text-xs break-all mt-2">{row.key}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white border border-surface-variant rounded-md p-5">
            <h2 className="font-semibold text-primary mb-4">Recent API usage</h2>
            {usage.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No proxy calls recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {usage.map((row) => (
                  <li
                    key={row.id}
                    className="bg-white border border-surface-variant rounded-md px-4 py-3 flex flex-wrap justify-between gap-2 items-center"
                  >
                    <span className="text-on-surface-variant">
                      {row.serviceTitle ?? "—"} · {row.aiProvider} / {row.modelName}
                    </span>
                    <span
                      className={
                        row.success === false
                          ? "text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-900"
                          : "text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                      }
                    >
                      {row.success === false ? "Paid · AI error" : "Completed"}
                    </span>
                    <span className="font-mono shrink-0 text-xs">
                      {Number(row.amountAlgo).toFixed(6)} ALGO
                      {row.totalTokens != null ? ` · ${row.totalTokens} tok` : ""}
                    </span>
                    {row.paymentTxId && (
                      <a
                        href={`https://testnet.algoexplorer.io/tx/${row.paymentTxId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-secondary underline font-mono"
                      >
                        Tx
                      </a>
                    )}
                    <span className="text-xs text-on-surface-variant shrink-0">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
