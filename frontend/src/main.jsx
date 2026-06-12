import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import App from "./App.jsx";
import { WalletProvider } from "@txnlab/use-wallet-react";
import { AuthProvider } from "./context/AuthContext.jsx";
import { PeraLoginProvider } from "./context/PeraLoginContext.jsx";
import { walletManager } from "./wallet/walletManager.js";
import WalletSignerBridge from "./components/WalletSignerBridge.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <WalletProvider manager={walletManager}>
            <PeraLoginProvider>
              <WalletSignerBridge />
              <App />
              <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
            </PeraLoginProvider>
          </WalletProvider>
        </AuthProvider>
      </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
