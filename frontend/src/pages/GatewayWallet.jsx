import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import UsageTrendChart from "../components/gateway/UsageTrendChart.jsx";

function StatCard({ label, value, warn }) {
  return (
    <div
      className={`rounded-xl border bg-white p-5 shadow-sm ${
        warn ? "border-amber-300 bg-amber-50/50" : "border-slate-200"
      }`}
    >
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${warn ? "text-amber-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

export default function GatewayWallet() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [marketplace, setMarketplace] = useState(null);
  const [deposit, setDeposit] = useState(null);
  const [txId, setTxId] = useState("");
  const [subscribeSlug, setSubscribeSlug] = useState("");
  const [masterKey, setMasterKey] = useState(null);
  const [alertType, setAlertType] = useState("low_balance");
  const [alertThreshold, setAlertThreshold] = useState("15");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, mktRes, depRes] = await Promise.all([
        api.get("/api/gateway/consumer/dashboard"),
        api.get("/api/gateway/marketplace"),
        api.get("/api/gateway/deposit/instructions"),
      ]);
      setDashboard(dashRes.data);
      setMarketplace(mktRes.data);
      setDeposit(depRes.data);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Could not load gateway wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function issueKey() {
    try {
      const { data } = await api.post("/api/gateway/keys/issue");
      setMasterKey(data.key);
      toast.success(data.created ? "Master API key created" : "Master key loaded");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed");
    }
  }

  async function confirmDeposit() {
    if (!txId.trim()) return toast.error("Enter transaction ID");
    try {
      const { data } = await api.post("/api/gateway/deposit/confirm", { txId: txId.trim() });
      const rate = dashboard?.rate || 35;
      toast.success(`Credited ${(data.amountCents / rate).toFixed(4)} ALGO`);
      setTxId("");
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Deposit failed");
    }
  }

  async function subscribe(slug) {
    const s = slug || subscribeSlug.trim();
    if (!s) return toast.error("Enter proxy slug");
    try {
      const { data } = await api.post("/api/gateway/subscribe", { proxySlug: s });
      toast.success("Subscribed — API key copied");
      navigator.clipboard?.writeText(data.apiKey);
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Subscribe failed");
    }
  }

  async function saveAlert() {
    try {
      await api.post("/api/gateway/alerts", {
        type: alertType,
        thresholdCents: Math.round(parseFloat(alertThreshold) * (dashboard?.rate || 35)) || 0,
        notifyEmail: true,
      });
      toast.success("Alert saved");
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Alert failed");
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-500">Loading gateway studio…</div>;
  }

  const p = dashboard?.period || {};
  const spend = p.spendAlgo || {};

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">API Gateway — Consumer Studio</h1>
        <p className="text-slate-600 text-sm mt-1">
          Prepaid balance, usage analytics, and proxied API access via{" "}
          <code className="bg-slate-100 px-1 rounded">POST /proxy/:slug</code>
        </p>
      </div>

      {dashboard?.lowBalance && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Low balance — add funds to avoid failed requests.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Balance" value={`${dashboard?.balanceAlgo?.toFixed(4) ?? "0.0000"} ALGO`} warn={dashboard?.lowBalance} />
        <StatCard
          label="Spend today / week / month"
          value={`${(spend.today ?? 0).toFixed(4)} / ${(spend.week ?? 0).toFixed(4)} / ${(spend.month ?? 0).toFixed(4)} ALGO`}
        />
        <StatCard
          label="Calls today / total"
          value={`${p.calls?.today ?? 0} / ${dashboard?.totals?.apiCalls ?? 0}`}
        />
        <StatCard label="Tokens (all time)" value={dashboard?.totals?.tokens ?? 0} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Usage trend (30 days)</h2>
        <UsageTrendChart data={dashboard?.trend} valueKey="totalCalls" label="Calls" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-slate-900">Deposit ALGO</h2>
          {deposit && (
            <div className="text-sm text-slate-600 space-y-2 font-mono bg-slate-50 p-4 rounded-lg">
              <p>
                <span className="text-slate-500">Vault:</span> {deposit.vaultAddress}
              </p>
              <p>
                <span className="text-slate-500">Note:</span> {deposit.note}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm"
              placeholder="Algorand txId after payment"
              value={txId}
              onChange={(e) => setTxId(e.target.value)}
            />
            <button
              type="button"
              onClick={confirmDeposit}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              Confirm deposit
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-slate-900">Alerts</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={alertType}
              onChange={(e) => setAlertType(e.target.value)}
            >
              <option value="low_balance">Low balance</option>
              <option value="high_spending">High monthly spend</option>
              <option value="high_usage">High daily usage</option>
              <option value="monthly_budget">Monthly budget</option>
            </select>
            <input
              className="border rounded-lg px-3 py-2 text-sm w-28"
              placeholder="ALGO"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(e.target.value)}
            />
            <button
              type="button"
              onClick={saveAlert}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm"
            >
              Save alert
            </button>
          </div>
          {(dashboard?.activeAlerts ?? []).length > 0 && (
            <ul className="text-xs text-slate-600 space-y-1">
              {dashboard.activeAlerts.map((a) => (
                <li key={a._id}>
                  {a.type}: {(a.thresholdCents / (dashboard?.rate || 35)).toFixed(4)} ALGO
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Discover APIs</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(marketplace?.trending ?? []).slice(0, 4).map((a) => (
            <div key={a.id} className="border rounded-lg p-4 text-sm">
              <p className="font-medium text-slate-900">{a.name}</p>
              <p className="text-slate-500 text-xs mt-1">{a.proxySlug}</p>
              <p className="text-indigo-600 text-xs mt-2">{a.priceAlgo} ALGO / {a.pricingModel}</p>
              <button
                type="button"
                className="mt-2 text-xs text-indigo-600 hover:underline"
                onClick={() => subscribe(a.proxySlug)}
              >
                Subscribe
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <input
            className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm"
            placeholder="proxy slug"
            value={subscribeSlug}
            onChange={(e) => setSubscribeSlug(e.target.value)}
          />
          <button
            type="button"
            onClick={() => subscribe()}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm"
          >
            Subscribe
          </button>
          <button type="button" onClick={issueKey} className="text-sm text-indigo-600 hover:underline">
            Master API key
          </button>
        </div>
        {masterKey && (
          <p className="text-xs font-mono text-slate-500">Master: {masterKey.slice(0, 20)}…</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-3">Request logs</h2>
        <LogTable rows={dashboard?.recentLogs} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-3">Billing history</h2>
        <TxTable rows={dashboard?.billingHistory} />
      </section>
    </div>
  );
}

function LogTable({ rows }) {
  if (!rows?.length) return <p className="text-sm text-slate-500">No proxied calls yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b">
            <th className="py-2">Time</th>
            <th className="py-2">API</th>
            <th className="py-2">Key</th>
            <th className="py-2">Cost</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="py-2">{new Date(row.timestamp).toLocaleString()}</td>
              <td className="py-2">{row.apiName || row.proxySlug}</td>
              <td className="py-2 font-mono text-xs">{row.apiKeyPrefix || "—"}</td>
              <td className="py-2">{row.costAlgo != null ? `${row.costAlgo.toFixed(6)} ALGO` : "—"}</td>
              <td className="py-2">{row.requestStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TxTable({ rows }) {
  if (!rows?.length) return <p className="text-sm text-slate-500">No transactions yet.</p>;
  return (
    <div className="overflow-x-auto text-sm">
      <table className="w-full">
        <thead>
          <tr className="text-left text-slate-500 border-b">
            <th className="py-2">Date</th>
            <th className="py-2">Type</th>
            <th className="py-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t._id} className="border-b border-slate-100">
              <td className="py-2">{new Date(t.createdAt).toLocaleString()}</td>
              <td className="py-2">{t.type}</td>
              <td className="py-2">{t.amountAlgo != null ? `${Math.abs(t.amountAlgo).toFixed(4)} ALGO` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
