import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  signAndSendPayment,
  ensureConnectedWallet,
  buildXPaymentHeaderFromSignedBytes,
} from "../../wallet/signPayment.js";
import { buildX402SentinelNote } from "../../utils/x402Note.js";
import { getDefaultAlgodServer } from "../../utils/algodConfig.js";
import { testnetTxUrl } from "../../utils/explorer.js";
import ReactMarkdown from "react-markdown";
import { toast } from "react-hot-toast";

export default function StudioChat() {
  const { user } = useAuth();
  const location = useLocation();

  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data } = await api.get("/api/x402/services");
        setServices(data.services || []);

        const params = new URLSearchParams(location.search);
        const sid = params.get("serviceId");
        if (sid && data.services.some((s) => s.id === sid)) {
          setSelectedServiceId(sid);
        } else if (data.services.length > 0) {
          setSelectedServiceId(data.services[0].id);
        }
      } catch (err) {
        console.error("Failed to load services", err);
      }
    };
    fetchServices();
  }, [location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedServiceId) return;

    const userMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      let challengeData;
      try {
        await api.post(`/api/x402/use/${selectedServiceId}`, {
          messages: newMessages,
          stream: false,
        });
        throw new Error("Expected 402 Payment Required, but request succeeded without payment.");
      } catch (err) {
        if (err.response?.status === 402) {
          challengeData = err.response.data;
        } else {
          throw err;
        }
      }

      const acceptReq = challengeData?.accepts?.[0];
      if (!acceptReq?.payTo || acceptReq.maxAmountRequired == null) {
        throw new Error("Invalid x402 payment challenge from server");
      }

      const amountMicroAlgos = Number(acceptReq.maxAmountRequired);
      toast(`Approve ${amountMicroAlgos / 1e6} ALGO in your wallet app…`);
      const from = user?.walletAddress || (await ensureConnectedWallet());

      const { txId, signedBytes } = await signAndSendPayment({
        from,
        to: acceptReq.payTo,
        amountMicroAlgos,
        noteStr: buildX402SentinelNote(selectedServiceId),
        algodServer: getDefaultAlgodServer(),
        confirmRounds: 4,
      });

      const xPaymentHeader = buildXPaymentHeaderFromSignedBytes(signedBytes);

      setStreaming(true);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const { data } = await api.post(
        `/api/x402/use/${selectedServiceId}`,
        { messages: newMessages, stream: false },
        { headers: { "X-Payment": xPaymentHeader } }
      );

      const assistantText = data?.choices?.[0]?.message?.content || "";
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") last.content = assistantText;
        return updated;
      });

      const receiptTx = data?.sentinelReceipt?.paymentTxId || txId;
      if (receiptTx) {
        toast.success(
          (t) => (
            <span>
              x402 payment verified.{" "}
              <a
                href={testnetTxUrl(receiptTx)}
                target="_blank"
                rel="noreferrer"
                className="underline font-semibold"
                onClick={() => toast.dismiss(t.id)}
              >
                View on explorer
              </a>
            </span>
          ),
          { duration: 8000 }
        );
      }
    } catch (err) {
      console.error(err);
      const apiErr = err.response?.data;
      const apiMsg =
        apiErr?.detail ||
        apiErr?.error ||
        (typeof apiErr === "string" ? apiErr : null);
      const message = apiMsg
        ? `${err.response?.status ? `Request failed (${err.response.status})` : "Request failed"}: ${apiMsg}`
        : err.message;
      toast.error(message || "Failed to chat.");
      setMessages((prev) => prev.filter((m) => m.content !== ""));
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm m-6" style={{ height: "calc(100vh - 120px)" }}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">AI Chat</h2>
          <p className="text-sm text-slate-500">Pay per call with your connected Algorand wallet (x402).</p>
        </div>
        <div>
          <select
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
          >
            <option value="" disabled>
              Select an AI Service
            </option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.model})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Send a message to start chatting.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 shadow-sm ${msg.role === "user" ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-800"}`}
              >
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none prose-slate">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {loading && !streaming && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex items-center gap-2 text-slate-500">
              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              <span className="text-sm">Paying &amp; Confirming...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            className="flex-1 border border-slate-300 rounded-full px-5 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-inner"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || streaming}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || streaming || !selectedServiceId}
            className="bg-primary text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
