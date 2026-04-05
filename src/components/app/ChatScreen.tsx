"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Video,
  Phone,
  Paperclip,
  Mic,
  Send,
  Globe,
  CheckCheck,
  Play,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import WordCounter from "../ui/WordCounter";
import ChatAIAssistant from "./ChatAIAssistant";
import { useAuth } from "@/lib/auth-context";
import { usePolling } from "@/lib/use-polling";
import { MOCK_CHAT_MESSAGES, MOCK_PROFILES } from "@/lib/mock-data";

interface ChatScreenProps {
  chatId: string;
  contactName?: string;
  onBack: () => void;
}

interface ApiMessage {
  id: string;
  senderId: string;
  receiverId: string;
  type: "text" | "image" | "voice" | "video";
  content: string | null;
  mediaUrls: string[] | null;
  durationSeconds: number | null;
  createdAt: string;
  sender?: { id: string; displayName: string };
  receiver?: { id: string; displayName: string };
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ChatScreen({ chatId, contactName, onBack }: ChatScreenProps) {
  const { user, authFetch } = useAuth();
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [translateOn, setTranslateOn] = useState(false);
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  const displayName = contactName || "Chat";
  const isMockContact = chatId.startsWith("mock_");

  // Load mock messages for demo contacts
  useEffect(() => {
    if (isMockContact) {
      const mockMsgs = MOCK_CHAT_MESSAGES[chatId] ?? [];
      setMessages(mockMsgs.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        receiverId: m.receiverId,
        type: m.type as ApiMessage["type"],
        content: m.content,
        mediaUrls: m.mediaUrls,
        durationSeconds: m.durationSeconds,
        createdAt: m.createdAt,
      })));
      setLoading(false);
    }
  }, [chatId, isMockContact]);

  // Fetch real messages (skip for mock contacts)
  const fetchMessages = useCallback(async () => {
    if (isMockContact) return;
    try {
      const res = await authFetch(`/api/messages/inbox?contactId=${chatId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages((data.data ?? []).reverse());
      }
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  }, [chatId, authFetch, isMockContact]);

  useEffect(() => {
    if (!isMockContact) fetchMessages();
  }, [fetchMessages, isMockContact]);

  // Poll every 3 seconds for new messages (real contacts only)
  usePolling(fetchMessages, 3_000, !loading && !isMockContact);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sentCount = messages.filter((m) => m.senderId === user?.id || m.senderId === "me").length;
  const remainingMessages = Math.max(0, 7 - sentCount);

  const handleSend = async () => {
    const text = message.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const res = await authFetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: chatId,
          type: "text",
          content: text,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.data]);
        setMessage("");
      } else {
        const data = await res.json();
        const msg = typeof data.error === "string" ? data.error : data.error?.message || "Failed to send";
        alert(msg);
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="relative z-10 px-4 pt-12 pb-3 bg-white/90 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              onClick={onBack}
              whileTap={{ scale: 0.9 }}
              className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
            >
              <ArrowLeft size={18} className="text-slate-600" />
            </motion.button>
            <Avatar name={displayName} size="md" online showStatus />
            <div>
              <p className="text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="text-[11px] text-emerald-500">online</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <Video size={17} className="text-slate-500" />
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <Phone size={17} className="text-slate-500" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Remaining messages indicator */}
        <div className="flex justify-center mb-2">
          <span className="px-4 py-1.5 rounded-full bg-slate-50 text-[11px] text-slate-500 border border-slate-200">
            {remainingMessages > 0
              ? `${remainingMessages} messages remaining`
              : "Message limit reached — oldest will cycle out"}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-slate-400 text-sm">No messages yet</p>
            <p className="text-slate-300 text-xs mt-1">Send the first message!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isSent = msg.senderId === user?.id || msg.senderId === "me";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex ${isSent ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[80%] ${isSent ? "items-end" : "items-start"}`}>
                  {msg.type === "text" && (
                    <div
                      className={`px-4 py-2.5 rounded-2xl ${
                        isSent
                          ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-br-md"
                          : "bg-slate-100 rounded-bl-md"
                      }`}
                    >
                      <p className={`text-sm leading-relaxed ${isSent ? "text-white" : "text-slate-800"}`}>
                        {msg.content}
                      </p>
                    </div>
                  )}

                  {msg.type === "image" && (
                    <div className="rounded-2xl overflow-hidden p-[2px] bg-gradient-to-br from-indigo-500/40 via-purple-500/40 to-pink-500/40">
                      <div className="w-52 h-36 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                        <ImageIcon size={32} className="text-white/20" />
                      </div>
                    </div>
                  )}

                  {msg.type === "voice" && (
                    <div
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${
                        isSent
                          ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-br-md"
                          : "bg-slate-100 rounded-bl-md"
                      }`}
                    >
                      <button className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <Play size={14} className="text-white ml-0.5" />
                      </button>
                      <div className="flex items-center gap-[2px]">
                        {Array.from({ length: 20 }).map((_, j) => (
                          <div
                            key={j}
                            className="w-[3px] rounded-full bg-white/60"
                            style={{
                              height: `${8 + Math.sin(j * 0.8) * 10 + Math.random() * 6}px`,
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-white/60 ml-1">{msg.durationSeconds}s</span>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className={`flex items-center gap-1 mt-1 ${isSent ? "justify-end" : "justify-start"}`}>
                    <span className="text-[10px] text-slate-400">{formatTime(msg.createdAt)}</span>
                    {isSent && <CheckCheck size={13} className="text-purple-400" />}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Input area */}
      <div className="relative px-4 pb-6 pt-3 bg-white/90 backdrop-blur-xl border-t border-slate-200">
        {/* AI Assistant Panel */}
        <AnimatePresence>
          {showAIAssist && (
            <ChatAIAssistant
              currentMessage={message}
              conversationContext={messages.map((m) => m.content || "").join(" ")}
              onInsertReply={(text) => {
                setMessage(text);
                setShowAIAssist(false);
              }}
              onClose={() => setShowAIAssist(false)}
            />
          )}
        </AnimatePresence>

        <div className="flex items-center gap-1 mb-1.5 justify-between px-1">
          {/* AI button */}
          <motion.button
            onClick={() => setShowAIAssist(!showAIAssist)}
            whileTap={{ scale: 0.9 }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
              showAIAssist
                ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white"
                : "bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200"
            }`}
          >
            <Sparkles size={10} />
            AI
          </motion.button>
          <WordCounter text={message} maxWords={70} />
        </div>
        <div className="flex items-end gap-2">
          {/* Attachment */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0"
          >
            <Paperclip size={18} className="text-slate-400" />
          </motion.button>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 pr-10 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/40 resize-none transition-colors"
            />
            {/* Translate toggle */}
            <button
              onClick={() => setTranslateOn(!translateOn)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                translateOn ? "text-purple-400" : "text-slate-400"
              }`}
            >
              <Globe size={16} />
            </button>
          </div>

          {/* Voice / Send */}
          {message.trim() ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSend}
              disabled={sending}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20 disabled:opacity-50"
            >
              <Send size={17} className="text-white -rotate-45 ml-0.5" />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onTouchStart={() => setIsRecording(true)}
              onTouchEnd={() => setIsRecording(false)}
              onMouseDown={() => setIsRecording(true)}
              onMouseUp={() => setIsRecording(false)}
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                isRecording
                  ? "bg-rose-500 scale-125 shadow-lg shadow-rose-500/30"
                  : "bg-slate-100"
              }`}
            >
              <Mic size={17} className={isRecording ? "text-white" : "text-slate-400"} />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
