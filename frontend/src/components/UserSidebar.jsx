import { Link } from "react-router-dom";

export default function UserSidebar({ activeTab }) {
  const tabs = [
    { id: "marketplace", path: "/user/marketplace", icon: "storefront", label: "Marketplace" },
    { id: "hosted-apps", path: "/user/hosted-apps", icon: "widgets", label: "Hosted Apps" },
    { id: "dashboard", path: "/user/dashboard", icon: "key", label: "Keys & usage" },
    { id: "analytics", path: "/user/analytics", icon: "insights", label: "Usage Analytics" },
    { id: "transactions", path: "/user/transactions", icon: "receipt_long", label: "Transaction history" },
  ];

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-slate-50 border-r border-slate-100 flex-col py-8 text-[0.875rem] overflow-y-auto max-md:hidden md:flex">
      <div className="px-6 mb-8">
        <h3 className="text-slate-900 font-semibold">User</h3>
        <p className="text-slate-500 text-xs">Verified Role</p>
      </div>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            to={tab.path}
            className={`flex items-center gap-3 px-6 py-3 transition-colors ${
              isActive
                ? "text-slate-900 font-semibold bg-slate-100 border-r-2 border-slate-900"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <span className="material-symbols-outlined">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </aside>
  );
}
