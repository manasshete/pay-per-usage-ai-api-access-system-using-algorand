import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth, api } from './AuthContext';

function LoginScreen() {
  const { loginWithGoogle, isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 text-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Sentinal Chat</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">Login with your Sentinal profile to continue</p>
        
        <button 
          onClick={loginWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 font-medium py-3 px-4 rounded-xl transition-colors shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          Continue with Google
        </button>
      </div>
    </div>
  );
}

function ChatInterface() {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [burnerBalance, setBurnerBalance] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    fetchBurnerInfo();
  }, []);

  useEffect(() => {
    if (activeConvo) fetchMessages(activeConvo._id);
  }, [activeConvo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchBurnerInfo() {
    try {
      const res = await api.get('/user-info');
      setBurnerBalance(res.data.balance);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchConversations() {
    try {
      const res = await api.get('/conversations');
      setConversations(res.data);
      if (res.data.length > 0 && !activeConvo) {
        setActiveConvo(res.data[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchMessages(convoId) {
    try {
      const res = await api.get(`/conversations/${convoId}/messages`);
      setMessages(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleNewChat() {
    setActiveConvo(null);
    setMessages([]);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    
    // Optimistic UI
    setMessages(prev => [...prev, { role: 'user', content: userMessage, _id: Date.now() }]);

    try {
      const res = await api.post('/chat', {
        conversationId: activeConvo?._id,
        content: userMessage
      });
      
      setMessages(prev => [...prev, res.data.message]);
      
      if (!activeConvo) {
        // Find the newly created convo in the backend
        fetchConversations();
        setActiveConvo({ _id: res.data.conversationId, title: userMessage.slice(0, 30) });
      }
      // Refresh burner balance after payment
      fetchBurnerInfo();
    } catch (err) {
      console.error(err);
      // Revert optimistic message on error or show error
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, there was an error processing your request. Ensure your Burner Wallet has sufficient ALGO on the Sentinal website.', _id: Date.now(), isError: true }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-sans antialiased">
      {/* Sidebar */}
      <div className="w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full">
        <div className="p-4">
          <button 
            onClick={handleNewChat}
            className="w-full flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg px-4 py-2.5 transition-colors shadow-sm text-sm font-medium"
          >
            New Chat
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-3 space-y-1 mt-2">
          {conversations.map(c => (
            <button
              key={c._id}
              onClick={() => setActiveConvo(c)}
              className={`w-full text-left truncate px-3 py-2 rounded-lg text-sm transition-colors ${activeConvo?._id === c._id ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
            >
              {c.title}
            </button>
          ))}
        </div>
        
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-4">
          <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Burner Wallet</span>
              <span className="text-xs font-mono font-medium text-blue-600 dark:text-blue-400">{burnerBalance !== null ? `${burnerBalance.toFixed(2)} ALGO` : '...'}</span>
            </div>
            <a href="http://localhost:5173/wallet" target="_blank" rel="noopener noreferrer" className="text-[11px] flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors mt-2">
              Manage on Sentinal 
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>

          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.displayName}</p>
            </div>
            <button onClick={logout} className="text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              </div>
              <h2 className="text-2xl font-semibold mb-2">How can I help you today?</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Powered by Sentinal Marketplace APIs. Usage is automatically paid using your connected Burner Wallet.</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6 pb-24">
              {messages.map((m, i) => (
                <div key={m._id || i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                    </div>
                  )}
                  <div className={`px-5 py-3.5 rounded-2xl max-w-[85%] ${
                    m.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-sm' 
                      : m.isError 
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-bl-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                  }`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    {m.paymentTxId && (
                      <div className="mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Paid via Burner
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                  </div>
                  <div className="px-5 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 rounded-bl-sm shadow-sm border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 w-full bg-gradient-to-t from-white via-white to-transparent dark:from-slate-900 dark:via-slate-900 pt-10 pb-6 px-4">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={sendMessage} className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Message Sentinal Chat..."
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl pl-6 pr-14 py-4 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                disabled={loading}
              />
              <button 
                type="submit"
                disabled={!input.trim() || loading}
                className="absolute right-2 p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:dark:bg-slate-700 text-white disabled:text-slate-400 rounded-xl transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" /></svg>
              </button>
            </form>
            <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-3 font-medium">Sentinal Chat can make mistakes. Consider verifying important information.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MainLayout() {
  const { loading, isAuthenticated } = useAuth();
  
  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white font-medium">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  return <ChatInterface />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} />
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/" element={<MainLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
