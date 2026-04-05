"use client";

import { useState, useRef, useEffect } from "react";
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

interface ChatScreenProps {
  chatId: string;
  onBack: () => void;
}

interface Message {
  id: string;
  text: string;
  sent: boolean;
  time: string;
  read: boolean;
  type: "text" | "image" | "voice";
  duration?: number;
}

const mockMessages: Message[] = [
  { id: "1", text: "Hey! How are you doing?", sent: false, time: "10:30 AM", read: true, type: "text" },
  { id: "2", text: "Great! Just finished the new UI mockups for CopyMe. They look incredible!", sent: true, time: "10:31 AM", read: true, type: "text" },
  { id: "3", text: "", sent: false, time: "10:32 AM", read: true, type: "image" },
  { id: "4", text: "That gradient design is absolutely stunning! The glass morphism effect really pops", sent: false, time: "10:33 AM", read: true, type: "text" },
  { id: "5", text: "", sent: true, time: "10:34 AM", read: true, type: "voice", duration: 12 },
  { id: "6", text: "Let me review and share feedback by end of day. The team will love this direction!", sent: false, time: "10:35 AM", read: true, type: "text" },
  { id: "7", text: "Sounds perfect! Excited for the launch", sent: true, time: "10:36 AM", read: false, type: "text" },
];

export default function ChatScreen({ chatId, onBack }: ChatScreenProps) {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [translateOn, setTranslateOn] = useState(false);
  const [showAIAssist, setShowAIAssist] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const contactName = "Amara Okafor";
  const remainingMessages = 7 - mockMessages.filter((m) => m.sent).length;

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
            <Avatar name={contactName} size="md" online showStatus />
            <div>
              <p className="text-sm font-semibold text-slate-900">{contactName}</p>
              <p className="text-[11px] text-emerald-500">online</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <Video size={17} className="text-slate-500" />
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
              <Phone size={17} className="text-white/60" />
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
              ? `${remainingMessages} messages remaining today`
              : "Daily message limit reached"}
          </span>
        </div>

        {mockMessages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[80%] ${msg.sent ? "items-end" : "items-start"}`}>
              {msg.type === "text" && (
                <div
                  className={`px-4 py-2.5 rounded-2xl ${
                    msg.sent
                      ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-br-md"
                      : "bg-slate-100 rounded-bl-md"
                  }`}
                >
                  <p className={`text-sm leading-relaxed ${msg.sent ? "text-white" : "text-slate-800"}`}>
                    {msg.text}
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
                    msg.sent
                      ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-br-md"
                      : "bg-slate-100 rounded-bl-md"
                  }`}
                >
                  <button className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Play size={14} className="text-white ml-0.5" />
                  </button>
                  {/* Waveform */}
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
                  <span className="text-[11px] text-white/60 ml-1">{msg.duration}s</span>
                </div>
              )}

              {/* Timestamp + read receipts */}
              <div className={`flex items-center gap-1 mt-1 ${msg.sent ? "justify-end" : "justify-start"}`}>
                <span className="text-[10px] text-slate-400">{msg.time}</span>
                {msg.sent && (
                  <CheckCheck
                    size={13}
                    className={msg.read ? "text-purple-400" : "text-slate-300"}
                  />
                )}
              </div>
            </div>
          </motion.div>
        ))}
        <div ref={messagesEnd} />
      </div>

      {/* Input area */}
      <div className="relative px-4 pb-6 pt-3 bg-white/90 backdrop-blur-xl border-t border-slate-200">
        {/* AI Assistant Panel */}
        <AnimatePresence>
          {showAIAssist && (
            <ChatAIAssistant
              currentMessage={message}
              conversationContext={mockMessages.map((m) => m.text).join(" ")}
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
              className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20"
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
