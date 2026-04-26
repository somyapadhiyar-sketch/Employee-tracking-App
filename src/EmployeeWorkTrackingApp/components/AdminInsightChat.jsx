import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, Bot, User, Loader2, AlertCircle, Trash2,
  Plus, MessageSquare, Edit3, Check, X, Menu, History
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const AdminInsightChat = ({ isDark, userName }) => {
  // --- State ---
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem('admin_insight_chats');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeChatId, setActiveChatId] = useState(() => {
    return localStorage.getItem('admin_active_chat_id') || null;
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editMsgText, setEditMsgText] = useState('');

  const messagesEndRef = useRef(null);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile && !isSidebarOpen) {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('admin_insight_chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem('admin_active_chat_id', activeChatId);
    } else {
      localStorage.removeItem('admin_active_chat_id');
    }
  }, [activeChatId]);

  // --- Auto-create New Chat on Mount ---
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    setChats(prev => {
      // If the top chat is already empty, just select it
      if (prev.length > 0 && prev[0].messages.length === 0) {
        setActiveChatId(prev[0].id);
        return prev;
      }

      // Otherwise create a new blank chat automatically
      const newId = uuidv4();
      const newChat = {
        id: newId,
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString()
      };
      setActiveChatId(newId);
      return [newChat, ...prev];
    });
  }, []); // Only run on mount

  // --- Auto-scroll ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats, activeChatId, isLoading]);

  // --- Active Chat Helpers ---
  const activeChat = chats.find(c => c.id === activeChatId);
  const activeMessages = activeChat ? activeChat.messages : [];

  // --- Actions ---
  const createNewChat = () => {
    const newId = uuidv4();
    const newChat = {
      id: newId,
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newId);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const deleteChat = (e, id) => {
    e.stopPropagation();
    if (window.confirm("Delete this chat?")) {
      setChats(prev => prev.filter(c => c.id !== id));
      if (activeChatId === id) {
        setActiveChatId(null);
      }
    }
  };

  const startEditing = (e, chat) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const saveTitle = (e, id) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      setChats(prev => prev.map(c => c.id === id ? { ...c, title: editTitle } : c));
    }
    setEditingChatId(null);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !activeChatId) return;

    const userMsg = {
      id: uuidv4(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    // Update messages locally
    setChats(prev => prev.map(c =>
      c.id === activeChatId
        ? { ...c, messages: [...c.messages, userMsg], title: c.title === 'New Chat' ? input.substring(0, 30) : c.title }
        : c
    ));

    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/n8n-webhook/webhook/admin-insights-chat-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          sessionId: activeChatId
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      const aiMsg = {
        id: uuidv4(),
        role: 'ai',
        content: data.reply || "I couldn't process that request.",
        timestamp: new Date().toISOString()
      };

      setChats(prev => prev.map(c =>
        c.id === activeChatId
          ? { ...c, messages: [...c.messages, aiMsg] }
          : c
      ));
    } catch (err) {
      console.error("Chat Error:", err);
      const errorMsg = {
        id: uuidv4(),
        role: 'ai',
        content: "System is currently busy. Please try again later.",
        timestamp: new Date().toISOString(),
        isError: true
      };
      setChats(prev => prev.map(c =>
        c.id === activeChatId
          ? { ...c, messages: [...c.messages, errorMsg] }
          : c
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSubmit = async (msgId, newText) => {
    if (!newText.trim() || isLoading) return;

    const chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;

    const msgIndex = chat.messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    // Truncate messages after edited message
    const truncatedMessages = chat.messages.slice(0, msgIndex);
    const editedMsg = {
      ...chat.messages[msgIndex],
      content: newText,
      timestamp: new Date().toISOString()
    };

    const finalMessages = [...truncatedMessages, editedMsg];

    setChats(prev => prev.map(c =>
      c.id === activeChatId ? { ...c, messages: finalMessages } : c
    ));

    setEditingMsgId(null);
    setIsLoading(true);

    try {
      const response = await fetch('/n8n-webhook/webhook/admin-insights-chat-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newText,
          sessionId: activeChatId
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      const aiMsg = {
        id: uuidv4(),
        role: 'ai',
        content: data.reply || "I couldn't process that request.",
        timestamp: new Date().toISOString()
      };

      setChats(prev => prev.map(c =>
        c.id === activeChatId ? { ...c, messages: [...finalMessages, aiMsg] } : c
      ));
    } catch (err) {
      console.error("Edit Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`relative flex h-[calc(100vh-50px)] rounded-3xl overflow-hidden border shadow-2xl transition-all duration-500 ${isDark ? 'bg-gray-950 border-gray-800' : 'bg-white border-gray-100'
      }`}>

      {/* Backdrop for Mobile Sidebar - Only mount when needed */}
      <AnimatePresence>
        {isSidebarOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[20] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* --- Sidebar --- 
          On mobile, we only render if open or animating to avoid squashing issues.
          On desktop, it remains part of the flex layout.
      */}
      <AnimatePresence>
        {(isSidebarOpen || !isMobile) && (
          <motion.div
            initial={isMobile ? { x: -300, opacity: 0 } : false}
            animate={{
              width: isMobile ? '280px' : (isSidebarOpen ? '300px' : '0px'),
              opacity: (isSidebarOpen || !isMobile) ? 1 : 0,
              x: (isSidebarOpen || !isMobile) ? 0 : -300
            }}
            exit={isMobile ? { x: -300, opacity: 0 } : { width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: isMobile ? 'absolute' : 'relative',
              zIndex: isMobile ? 30 : 10
            }}
            className={`top-0 left-0 bottom-0 flex flex-col h-full overflow-hidden border-r shadow-2xl lg:shadow-none ${isDark
              ? 'bg-[#0f1115] border-gray-800 text-gray-200'
              : 'bg-white border-gray-100 text-gray-700'
              }`}
          >
            <div className="p-4 flex flex-col h-full">
              {/* Professional New Chat Button */}
              <button
                onClick={createNewChat}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold mb-6 group relative overflow-hidden ${isDark
                  ? 'bg-gray-800 hover:bg-gray-700 text-white shadow-lg shadow-black/20'
                  : 'bg-white hover:bg-gray-50 text-gray-800 shadow-md hover:shadow-lg border border-gray-100'
                  }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${isDark ? 'bg-blue-600/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                  }`}>
                  <Plus size={18} />
                </div>
                <span className="text-sm">New Chat</span>
                <div className="ml-auto opacity-40 group-hover:opacity-100 transition-opacity">
                  <Edit3 size={14} />
                </div>
              </button>

              <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                <div className="flex items-center justify-between px-2 mb-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                    <History size={12} /> Recent
                  </h3>
                </div>
                {chats.length === 0 && (
                  <p className="text-sm text-gray-500 px-4 py-8 text-center bg-gray-100/50 dark:bg-gray-800/30 rounded-2xl italic">
                    No conversation history yet.
                  </p>
                )}
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setActiveChatId(chat.id);
                      if (window.innerWidth < 1024) setIsSidebarOpen(false);
                    }}
                    className={`group relative flex items-center gap-3 px-3.5 py-3 rounded-2xl cursor-pointer transition-all duration-200 border ${activeChatId === chat.id
                      ? isDark
                        ? 'bg-blue-600/10 border-blue-500/50 text-blue-400 shadow-sm shadow-blue-500/10'
                        : 'bg-blue-50 border-blue-100 text-blue-700 shadow-sm shadow-blue-500/5'
                      : isDark
                        ? 'bg-transparent border-transparent hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                        : 'bg-transparent border-transparent hover:bg-gray-50 text-gray-500 hover:text-gray-900'
                      }`}
                  >
                    <div className={`p-1.5 rounded-lg transition-colors ${activeChatId === chat.id
                      ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                      : isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'
                      }`}>
                      <MessageSquare size={14} />
                    </div>

                    {editingChatId === chat.id ? (
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={(e) => saveTitle(e, chat.id)}
                        onKeyDown={(e) => e.key === 'Enter' && saveTitle(e, chat.id)}
                        className="flex-1 bg-transparent border-none outline-none text-sm font-bold"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="flex-1 text-sm font-bold truncate pr-14">
                        {chat.title}
                      </span>
                    )}

                    <div className={`absolute right-1 top-1 bottom-1 flex items-center gap-1.5 px-2 transition-opacity ${editingChatId === chat.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      } ${activeChatId === chat.id
                        ? ''
                        : isDark ? 'bg-gradient-to-l from-[#0f1115] via-[#0f1115] to-transparent' : 'bg-gradient-to-l from-white via-white to-transparent'
                      }`}>
                      {editingChatId === chat.id ? (
                        <button onClick={(e) => saveTitle(e, chat.id)} className="p-1.5 hover:text-green-500 bg-gray-800/50 rounded-md">
                          <Check size={12} />
                        </button>
                      ) : (
                        <>
                          <button onClick={(e) => startEditing(e, chat)} className={`p-1.5 rounded-md hover:bg-blue-600 hover:text-white transition-colors ${activeChatId === chat.id ? 'text-blue-400' : 'text-gray-500'}`}>
                            <Edit3 size={12} />
                          </button>
                          <button onClick={(e) => deleteChat(e, chat.id)} className={`p-1.5 rounded-md hover:bg-red-600 hover:text-white transition-colors ${activeChatId === chat.id ? 'text-blue-400' : 'text-gray-500'}`}>
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Main Chat Area --- */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent">
        {/* Top Header */}
        <header className={`px-3 sm:px-6 py-2.5 sm:py-4 border-b flex items-center justify-between z-10 ${isDark ? 'bg-gray-950/80 border-gray-800 backdrop-blur-md' : 'bg-white/80 border-gray-100 backdrop-blur-md'
          }`}>
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSidebarOpen(!isSidebarOpen);
              }}
              className={`w-9 h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-xl transition-all shadow-md flex-shrink-0 relative z-[70] ${isDark
                ? 'bg-gray-800 hover:bg-gray-700 text-blue-400 border border-gray-700'
                : 'bg-white hover:bg-gray-50 text-blue-600 border border-blue-50'
                }`}
              title="Toggle Sidebar"
            >
              <History size={isMobile ? 18 : 22} className={isSidebarOpen && isMobile ? "rotate-90 transition-transform" : "transition-transform"} />
            </button>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="min-w-0">
                <h2 className={`font-bold text-sm sm:text-lg truncate leading-tight ${isDark ? 'text-white' : 'text-gray-800'}`}>
                  {activeChat ? activeChat.title : 'Assistant'}
                </h2>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
                  <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-widest truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile/Tablet New Chat Button */}
          <button
            onClick={createNewChat}
            className={`lg:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-all shadow-md flex-shrink-0 ${
              isDark 
                ? 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500' 
                : 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-600'
            }`}
            title="Start New Chat"
          >
            <Plus size={18} />
          </button>
        </header>

        {/* Messages area */}
        <div className={`flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8 custom-scrollbar ${isDark ? 'bg-gray-950' : 'bg-gray-50/30'
          }`}>
          {!activeChatId ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 max-w-lg mx-auto">
              <div className="w-14 h-14 sm:w-20 sm:h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-4 sm:mb-6 animate-bounce">
                <Bot size={isMobile ? 28 : 40} />
              </div>
              <h1 className={`text-2xl sm:text-3xl font-black mb-2 sm:mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                Insight Assistant
              </h1>
              <p className={`text-sm sm:text-lg mb-6 sm:mb-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Analyze enterprise data with AI. Start a new session to begin.
              </p>
              <button
                onClick={createNewChat}
                className="px-6 py-3 sm:px-8 sm:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl sm:rounded-2xl font-bold shadow-lg transition-all hover:scale-105 active:scale-95 text-sm sm:text-base"
              >
                Start New Investigation
              </button>
            </div>
          ) : (
            <>
              {activeMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 max-w-2xl mx-auto mt-10">
                  <h1 className={`text-2xl sm:text-2xl font-black mb-0.5 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    Hi {userName ? userName.split(' ')[0] : 'Admin'}
                  </h1>
                  <h2 className={`text-lg sm:text-xl font-bold mb-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    How can I help you today?
                  </h2>
                </div>
              )}
              {activeMessages.map((msg, index) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`group/wrap flex gap-2 sm:gap-4 items-center max-w-[95%] sm:max-w-[85%] lg:max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md self-end mb-4 sm:mb-6 ${msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : isDark ? 'bg-gray-800 text-blue-400' : 'bg-white border border-blue-100 text-blue-600'
                      }`}>
                      {msg.role === 'user' ? <User size={isMobile ? 14 : 20} /> : <Bot size={isMobile ? 14 : 20} />}
                    </div>

                    <div className={`relative px-3 pt-2 pb-1 sm:px-5 sm:pt-3.5 sm:pb-1.5 rounded-xl sm:rounded-3xl shadow-sm overflow-hidden ${msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : isDark
                        ? 'bg-gray-900 text-gray-200 border border-gray-800 rounded-tl-none'
                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                      } ${msg.isError ? 'border-red-500 text-red-500' : ''}`}>
                      {editingMsgId === msg.id ? (
                        <div className="flex flex-col gap-1.5 min-w-[250px] sm:min-w-[400px]">
                          <textarea
                            autoFocus
                            value={editMsgText}
                            onChange={(e) => setEditMsgText(e.target.value)}
                            className="w-full bg-blue-700 text-white p-2 sm:p-2.5 rounded-xl border-none outline-none resize-none font-bold placeholder-blue-300 min-h-[60px] hide-scrollbar"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingMsgId(null)}
                              className="px-3 py-1.5 text-xs font-bold hover:bg-blue-700 rounded-lg transition-colors border border-blue-400"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleEditSubmit(msg.id, editMsgText)}
                              className="px-3 py-1.5 text-xs font-bold bg-white text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shadow-lg"
                            >
                              Save & Submit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={`markdown-content max-w-none ${msg.role === 'user' ? 'user-markdown' : 'ai-markdown'}`}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        </>
                      )}
                      {editingMsgId !== msg.id && (
                        <div className={`mt-0.5 flex items-center gap-2 text-[10px] font-bold opacity-30 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>•</span>
                          <span className="uppercase tracking-tighter">{msg.role === 'user' ? 'Admin' : 'AI Assistant'}</span>
                        </div>
                      )}
                    </div>

                    {/* Edit button placed OUTSIDE the message bubble */}
                    {msg.role === 'user' && !isLoading && editingMsgId !== msg.id && (
                      <button
                        onClick={() => {
                          setEditingMsgId(msg.id);
                          setEditMsgText(msg.content);
                        }}
                        className="p-2 sm:p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full opacity-0 group-hover/wrap:opacity-100 transition-all hover:scale-110 shadow-sm text-gray-500 dark:text-gray-400 self-center"
                        title="Edit message"
                      >
                        <Edit3 size={isMobile ? 14 : 16} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex gap-2 sm:gap-4 max-w-[90%] sm:max-w-[80%]">
                    <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-2xl flex items-center justify-center flex-shrink-0 mt-1 shadow-md ${isDark ? 'bg-gray-800 text-blue-400' : 'bg-white border border-blue-100 text-blue-600'
                      }`}>
                      <Bot size={isMobile ? 14 : 20} />
                    </div>
                    <div className={`px-4 py-3 sm:px-6 sm:py-4 rounded-xl sm:rounded-3xl rounded-tl-none border flex items-center gap-2 sm:gap-4 ${isDark ? 'bg-gray-900 border-gray-800 text-blue-400' : 'bg-blue-50/50 border-blue-100 text-blue-600'
                      }`}>
                      <div className="flex gap-1 sm:gap-1.5 flex-shrink-0">
                        <motion.span animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-current"></motion.span>
                        <motion.span animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-current"></motion.span>
                        <motion.span animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-current"></motion.span>
                      </div>
                      <span className="text-[10px] sm:text-sm font-bold tracking-tight whitespace-nowrap">Assistant is thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        {activeChatId && (
          <div className={`p-2 sm:p-3.5 border-t ${isDark ? 'bg-gray-950 border-gray-800' : 'bg-white border-gray-100'
            }`}>
            <form onSubmit={handleSend} className="relative max-w-4xl mx-auto flex items-end gap-2">
              <div className="relative flex-1 flex">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  disabled={isLoading}
                  placeholder={isMobile ? "Ask your assistant..." : "Ask your assistant anything about the platform...."}
                  rows={Math.min(5, input.split('\n').length || 1)}
                  className={`w-full h-full pl-4 sm:pl-6 pr-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl border-2 transition-all outline-none font-medium text-sm sm:text-base lg:text-lg resize-none min-h-[40px] sm:min-h-[50px] hide-scrollbar ${isDark
                    ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 placeholder-gray-600'
                    : 'bg-gray-50 border-gray-100 text-gray-800 focus:border-blue-400 focus:bg-white placeholder-gray-400 shadow-xl shadow-gray-200/50'
                    }`}
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={`h-[40px] sm:h-[50px] px-3 sm:px-6 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale shadow-md flex-shrink-0 border-2 border-transparent ${!input.trim() || isLoading ? '' : 'hover:scale-105 active:scale-95'
                  }`}
              >
                {isLoading ? <Loader2 className="animate-spin flex-shrink-0" size={isMobile ? 16 : 20} /> : <Send className="flex-shrink-0" size={isMobile ? 16 : 20} />}
                {!isMobile && <span className="flex-shrink-0">Send</span>}
              </button>
            </form>
            <p className={`text-[9px] sm:text-[10px] mt-1.5 sm:mt-2 text-center font-medium ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              AI can make mistakes. Verify important statistics with the main dashboard.
            </p>
          </div>
        )}
      </div>

      <style>{`
        .markdown-content {
          font-size: 0.9rem;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        @media (max-width: 640px) {
          .markdown-content { font-size: 0.8rem; }
          .markdown-content table { font-size: 0.7rem !important; }
          .markdown-content th, .markdown-content td { padding: 8px !important; }
        }
        .markdown-content table {
          width: 100%;
          display: block;
          overflow-x: auto;
          white-space: nowrap;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 0.9rem;
          background: ${isDark ? '#0a0a0a' : '#fff'};
          border-radius: 8px;
          border: 1px solid ${isDark ? '#1f2937' : '#f3f4f6'};
          max-width: 100%;
        }
        .markdown-content th, .markdown-content td {
          border: 1px solid ${isDark ? '#1f2937' : '#f3f4f6'};
          padding: 10px 12px;
          text-align: left;
        }
        .markdown-content th {
          background-color: ${isDark ? '#111827' : '#f8fafc'};
          font-weight: 800;
          color: ${isDark ? '#3b82f6' : '#2563eb'};
          text-transform: uppercase;
          font-size: 0.7rem;
          letter-spacing: 0.05em;
        }
        .markdown-content tr:nth-child(even) {
          background-color: ${isDark ? '#0d0d0d' : '#f9fafb'};
        }
        .markdown-content ul, .markdown-content ol {
          margin-left: 20px;
          margin-bottom: 8px;
        }
        .markdown-content h1, .markdown-content h2, .markdown-content h3 {
          font-weight: 800;
          margin-top: 16px;
          margin-bottom: 8px;
          color: ${isDark ? '#fff' : '#1e293b'};
          line-height: 1.2;
        }
        .markdown-content h1 { font-size: 1.4rem; }
        .markdown-content h2 { font-size: 1.2rem; }
        .markdown-content h3 { font-size: 1rem; }
        
        .markdown-content p {
          margin-bottom: 4px;
          line-height: 1.5;
        }
        .markdown-content p:last-child {
          margin-bottom: 0;
        }
        .user-markdown {
          color: white;
        }
        .ai-markdown {
          color: ${isDark ? '#e2e8f0' : '#334155'};
        }
        .custom-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .custom-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default AdminInsightChat;
