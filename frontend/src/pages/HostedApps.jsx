import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import UserLiveWalletBar from "../components/UserLiveWalletBar.jsx";
import ProfileDropdown from "../components/ProfileDropdown.jsx";
import UserSidebar from "../components/UserSidebar.jsx";

const HOSTED_APPS = [
  {
    id: "chat",
    title: "Sentinal Chat",
    description: "A fast, clean ChatGPT-like interface. Just paste your Sentinal API key and start talking.",
    icon: "forum",
    url: "http://localhost:5555",
  },
  {
    id: "image",
    title: "Sentinal Image Studio",
    description: "Generate images using Stable Diffusion or DALL-E models using your Sentinal keys.",
    icon: "image",
    url: "https://image.example.com", // Placeholder
  },
  {
    id: "coder",
    title: "Sentinal Coder",
    description: "An AI coding assistant web UI optimized for coding tasks and code generation.",
    icon: "code",
    url: "https://code.example.com", // Placeholder
  }
];

export default function HostedApps() {
  const { user, logout } = useAuth();
  const [keys, setKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    async function loadKeys() {
      try {
        const { data } = await api.get("/api/user/proxy-keys");
        setKeys(data ?? []);
      } catch {
        toast.error("Failed to load your API keys");
      } finally {
        setLoadingKeys(false);
      }
    }
    loadKeys();
  }, []);

  const handleCopy = (keyText) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKey(keyText);
    toast.success("API Key copied to clipboard!", {
      style: {
        borderRadius: '10px',
        background: '#333',
        color: '#fff',
      },
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="antialiased min-h-screen bg-[#f9f9f9]">
      <header className="bg-white fixed top-0 z-50 w-full border-b border-slate-100 h-16 px-6 flex justify-between items-center font-body text-sm gap-2">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="text-xl font-bold tracking-tight font-headline text-slate-900 shrink-0">
            Sentinal
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {user?.walletAddress && <UserLiveWalletBar walletAddress={user.walletAddress} />}
          <ProfileDropdown />
        </div>
      </header>

      <UserSidebar activeTab="hosted-apps" />

      <main className="md:pl-64 pt-24 px-6 pb-16 max-w-5xl">
        <div className="relative mb-10 overflow-hidden rounded-2xl bg-slate-900 p-8 text-white editorial-shadow">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-secondary opacity-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-primary opacity-30 blur-3xl"></div>
          <div className="relative z-10">
            <h1 className="font-headline text-3xl font-semibold mb-2 tracking-tight">Hosted Apps</h1>
            <p className="text-slate-300 max-w-lg">
              Explore partner applications designed to plug straight into your Sentinal API keys. 
              No extra billing, no extra setups.
            </p>
          </div>
        </div>

        {/* Quick Access to API Keys */}
        <section className="mb-14 bg-gradient-to-br from-primary-container/80 to-primary-container/30 border border-primary/20 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="bg-secondary w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white">
              <span className="material-symbols-outlined">key</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-primary text-base">Your API Keys</h2>
              <p className="text-sm text-on-surface-variant mt-1 mb-4">
                Copy an API key to use in the hosted apps below.
              </p>
              
              {loadingKeys ? (
                <p className="text-sm text-on-surface-variant">Loading keys...</p>
              ) : keys.length === 0 ? (
                <p className="text-sm text-on-surface-variant">
                  You don't have any keys yet. Go to the <Link to="/user/marketplace" className="text-secondary underline">Marketplace</Link> to generate one.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {keys.map(row => (
                    <div key={row.id} className="bg-white border border-outline-variant/60 rounded-xl p-4 flex justify-between items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate mb-1">{row.service?.title ?? "Unknown Service"}</p>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          <p className="font-mono text-xs text-slate-500 truncate">{row.key}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleCopy(row.key)}
                        className={`p-2 rounded-lg flex items-center justify-center transition-all ${
                          copiedKey === row.key 
                            ? "bg-green-100 text-green-700" 
                            : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200"
                        }`}
                        title="Copy Key"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {copiedKey === row.key ? "check" : "content_copy"}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Hosted Apps Grid */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <h2 className="font-semibold text-primary text-xl">Available Applications</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-wider">
              {HOSTED_APPS.length} Apps
            </span>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {HOSTED_APPS.map(app => (
              <div key={app.id} className="bg-white border border-surface-variant rounded-2xl p-6 flex flex-col hover:border-secondary/50 hover:shadow-lg transition-all duration-300 group hover:-translate-y-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-container/40 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                
                <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-white text-primary transition-colors duration-300 border border-slate-100 shadow-sm">
                  <span className="material-symbols-outlined text-[28px]">{app.icon}</span>
                </div>
                <h3 className="font-headline font-semibold text-slate-900 text-lg">{app.title}</h3>
                <p className="text-sm text-slate-500 mt-2 flex-1 leading-relaxed">{app.description}</p>
                <a 
                  href={app.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="mt-8 inline-flex items-center justify-center gap-2 w-full py-2.5 bg-white border-2 border-slate-900 text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-900 hover:text-white transition-colors duration-300"
                >
                  Launch App
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </a>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
