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
  Check,
  CheckCheck,
  Play,
  Image as ImageIcon,
  Sparkles,
  DollarSign,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import WordCounter from "../ui/WordCounter";
import ChatAIAssistant from "./ChatAIAssistant";
import ContactProfileSheet from "./ContactProfileSheet";
import SmartReplyChips from "./SmartReplyChips";
import VapMessageBubble, { type VapBubblePayload } from "./VapMessageBubble";
import VapActionSheet from "./VapActionSheet";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/i18n/client";
import { usePolling } from "@/lib/use-polling";
import { useMessageStream, type StreamEvent } from "@/hooks/useMessageStream";
import { MOCK_CHAT_MESSAGES, MOCK_PROFILES } from "@/lib/mock-data";
import { addBreadcrumb } from "@/lib/observability";

interface ChatScreenProps {
  chatId: string;
  contactName?: string;
  onBack: () => void;
}

interface ApiMessage {
  id: string;
  senderId: string;
  receiverId: string;
  type: "text" | "image" | "voice" | "video" | "vap_transfer" | "vap_request";
  content: string | null;
  mediaUrls: string[] | null;
  durationSeconds: number | null;
  createdAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  /** A3: present when the message was auto-translated on send. */
  languageOriginal?: string | null;
  languageTranslated?: string | null;
  translatedText?: string | null;
  sender?: { id: string; displayName: string };
  receiver?: { id: string; displayName: string };
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ChatScreen({ chatId, contactName, onBack }: ChatScreenProps) {
  const { user, authFetch, accessToken } = useAuth();
  const { t } = useLocale();
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [translateOn, setTranslateOn] = useState(false);
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showVapSheet, setShowVapSheet] = useState(false);
  // Image attachment (v4.14.1 — Paperclip button used to be inert;
  // beta tester Joze couldn't send pictures).
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
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

  // Poll every 3 seconds for new messages (real contacts only). The
  // realtime stream below is the primary delivery path; polling is the
  // always-on safety net. Hook-driven dedupe by message id below.
  usePolling(fetchMessages, 3_000, !loading && !isMockContact);

  // Realtime stream (A5). Server only emits when the feature flag is on;
  // otherwise this idles in "disabled" state and polling carries on.
  const handleStreamEvent = useCallback((ev: StreamEvent) => {
    if (ev.type !== "message") return;
    // Ignore events that don't belong to this conversation.
    const peerId = ev.senderId === user?.id ? ev.receiverId : ev.senderId;
    if (peerId !== chatId) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === ev.messageId)) return prev;
      // Fetch the full row in the background (translation + media URLs).
      void fetchMessages();
      return prev;
    });
  }, [chatId, user?.id, fetchMessages]);

  useMessageStream({
    accessToken,
    contactId: isMockContact ? undefined : chatId,
    onEvent: handleStreamEvent,
    enabled: !isMockContact && !!accessToken,
  });

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-mark-read: whenever we land in a conversation (or receive a new
  // message from this peer while the screen is open), tell the server
  // those messages have been read. Only fires for real users / real peers.
  useEffect(() => {
    if (!user || isMockContact) return;
    const hasUnread = messages.some(
      (m) => m.senderId === chatId && !m.readAt,
    );
    if (!hasUnread) return;

    // Optimistic local update so checkmarks tick forward even if the
    // server is slow; the next poll will reconcile if something changes.
    const now = new Date().toISOString();
    setMessages((prev) =>
      prev.map((m) =>
        m.senderId === chatId && !m.readAt ? { ...m, readAt: now } : m,
      ),
    );

    authFetch("/api/messages/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peerId: chatId }),
    }).catch(() => {
      // Non-fatal; the next poll will try again.
    });
  }, [messages, chatId, user, isMockContact, authFetch]);

  const sentCount = messages.filter((m) => m.senderId === user?.id || m.senderId === "me").length;
  const remainingMessages = Math.max(0, 7 - sentCount);

  // Smart-reply input: only show chips when the most recent message in the
  // thread came FROM the peer (not us). We pass the translated text when the
  // reader has translation toggled on so the suggestions match what they're
  // actually reading.
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastMessageIsFromPeer = !!lastMessage && lastMessage.senderId !== user?.id && lastMessage.senderId !== "me";
  const smartReplyInbound =
    lastMessageIsFromPeer && lastMessage
      ? (translateOn && lastMessage.translatedText) || lastMessage.content || null
      : null;
  const smartReplyContext = messages
    .map((m) => (translateOn && m.translatedText) || m.content || "")
    .filter((s) => s.length > 0);

  // VAP request actions (Pay / Decline / Cancel from a thread bubble).
  // Posts to /api/vap/request/[id] and lets polling reconcile the new
  // status into the rendered bubble.
  const handleVapAction = useCallback(
    async (requestId: string, action: "fulfill" | "decline" | "cancel") => {
      try {
        const res = await authFetch(`/api/vap/request/${requestId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (res.ok) {
          // Immediate refetch so the bubble flips status without waiting
          // for the 3s poll.
          void fetchMessages();
        } else {
          const data = await res.json().catch(() => ({}));
          console.warn("VAP action failed:", data?.error?.code ?? res.status);
        }
      } catch {
        console.warn("Network error on VAP action");
      }
    },
    [authFetch, fetchMessages],
  );

  // Image attachment: pick → /api/uploads/message-media (server sniffs
  // + EXIF-strips bytes) → /api/messages/send with type:"image" and the
  // returned blob URLs in mediaUrls. We only allow a single image per
  // tap for now; multi-select can come later but every additional file
  // multiplies the upload time on mobile.
  const handleImagePick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setAttachError(null);
      const file = e.target.files?.[0];
      if (!file) return;
      if (!user || isMockContact) {
        setAttachError("Sign in to send photos.");
        if (imageInputRef.current) imageInputRef.current.value = "";
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setAttachError("Image must be under 25 MB.");
        if (imageInputRef.current) imageInputRef.current.value = "";
        return;
      }
      setImageUploading(true);
      try {
        const draftId = `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        const form = new FormData();
        form.append("messageDraftId", draftId);
        form.append("file_0", file);
        const upRes = await authFetch("/api/uploads/message-media", {
          method: "POST",
          body: form,
        });
        const upData = await upRes.json().catch(() => ({}));
        if (!upRes.ok || !upData.ok) {
          setAttachError(
            upData?.error === "FILE_TOO_LARGE"
              ? "Image must be under 25 MB."
              : upData?.error === "REJECTED"
                ? "That image type isn't supported."
                : "Couldn't upload. Try again.",
          );
          return;
        }
        const sendRes = await authFetch("/api/messages/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiverId: chatId,
            type: "image",
            mediaUrls: upData.urls,
          }),
        });
        if (sendRes.ok) {
          const data = await sendRes.json();
          setMessages((prev) => [...prev, data.data]);
        } else {
          setAttachError("Couldn't send. Try again.");
        }
      } catch {
        setAttachError("Network error. Try again.");
      } finally {
        setImageUploading(false);
        if (imageInputRef.current) imageInputRef.current.value = "";
      }
    },
    [authFetch, chatId, user, isMockContact],
  );

  const handleSend = async () => {
    const text = message.trim();
    if (!text || sending) return;

    // Demo mode: add message locally without calling API
    if (!user || isMockContact) {
      const demoMsg: ApiMessage = {
        id: `demo_${Date.now()}`,
        senderId: "me",
        receiverId: chatId,
        type: "text",
        content: text,
        mediaUrls: null,
        durationSeconds: null,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, demoMsg]);
      setMessage("");
      return;
    }

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
        const data = await res.json().catch(() => ({ error: "Failed to send" }));
        const msg = typeof data.error === "string" ? data.error : data.error?.message || "Failed to send";
        console.warn("Send failed:", msg);
      }
    } catch {
      console.warn("Network error sending message");
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
            <button
              onClick={() => isMockContact && setShowProfile(true)}
              className="flex items-center gap-3"
            >
              {isMockContact && MOCK_PROFILES[chatId]?.avatarUrl ? (
                <div className="relative">
                  <img
                    src={MOCK_PROFILES[chatId].avatarUrl}
                    alt={displayName}
                    className="w-10 h-10 rounded-full object-cover bg-slate-100"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
                </div>
              ) : (
                <Avatar name={displayName} size="md" online showStatus />
              )}
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="text-[11px] text-emerald-500">
                  {isMockContact ? "Tap to view profile" : "online"}
                </p>
                <p className="text-[9px] text-slate-400">Direct Message</p>
              </div>
            </button>
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
                className={`flex ${isSent ? "justify-end" : "justify-start"} gap-2`}
              >
                {/* Contact avatar on received messages */}
                {!isSent && isMockContact && MOCK_PROFILES[chatId]?.avatarUrl && (
                  <img
                    src={MOCK_PROFILES[chatId].avatarUrl}
                    alt={displayName}
                    className="w-7 h-7 rounded-full object-cover bg-slate-100 shrink-0 mt-1"
                  />
                )}
                <div className={`max-w-[75%] ${isSent ? "items-end" : "items-start"}`}>
                  {/* Sender name on first message or when switching sender */}
                  {i === 0 || (messages[i - 1] && (messages[i - 1].senderId === user?.id || messages[i - 1].senderId === "me") !== isSent) ? (
                    <p className={`text-[10px] font-semibold mb-1 ${isSent ? "text-right text-purple-400" : "text-slate-500"}`}>
                      {isSent ? "You" : displayName}
                    </p>
                  ) : null}
                  {msg.type === "text" && (
                    <div
                      className={`px-4 py-2.5 rounded-2xl ${
                        isSent
                          ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-br-md"
                          : "bg-slate-100 rounded-bl-md"
                      }`}
                    >
                      <p className={`text-sm leading-relaxed ${isSent ? "text-white" : "text-slate-800"}`}>
                        {translateOn && msg.translatedText ? msg.translatedText : msg.content}
                      </p>
                      {msg.translatedText && (
                        <button
                          type="button"
                          onClick={() => setTranslateOn(!translateOn)}
                          className={`mt-1 inline-flex items-center gap-1 text-[10px] font-medium ${
                            isSent ? "text-white/70 hover:text-white" : "text-slate-500 hover:text-slate-700"
                          }`}
                          aria-label={translateOn ? "Show original" : "Translate"}
                        >
                          <Globe size={10} />
                          {translateOn
                            ? `original · ${msg.languageOriginal ?? ""}`
                            : `translate · ${msg.languageOriginal ?? "auto"} → ${msg.languageTranslated ?? ""}`}
                        </button>
                      )}
                    </div>
                  )}

                  {msg.type === "image" && (
                    <div className="rounded-2xl overflow-hidden p-[2px] bg-gradient-to-br from-indigo-500/40 via-purple-500/40 to-pink-500/40">
                      {msg.mediaUrls && msg.mediaUrls.length > 0 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={msg.mediaUrls[0]}
                          alt={msg.content ?? "Sent image"}
                          className="w-52 max-h-72 rounded-2xl object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-52 h-36 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                          <ImageIcon size={32} className="text-white/20" />
                        </div>
                      )}
                    </div>
                  )}

                  {(msg.type === "vap_transfer" || msg.type === "vap_request") && (() => {
                    // Defensively parse the JSON payload. If anything is
                    // malformed we render a tiny fallback chip rather
                    // than crashing the whole thread.
                    let payload: VapBubblePayload | null = null;
                    try {
                      const parsed = JSON.parse(msg.content ?? "{}");
                      if (parsed && (parsed.kind === "vap_transfer" || parsed.kind === "vap_request")) {
                        payload = parsed as VapBubblePayload;
                      }
                    } catch {
                      /* ignore */
                    }
                    if (!payload) {
                      return (
                        <div className="px-3 py-2 rounded-2xl bg-slate-100 text-[11px] text-slate-400">
                          [payment bubble]
                        </div>
                      );
                    }
                    return (
                      <VapMessageBubble
                        payload={payload}
                        isSent={isSent}
                        onAction={
                          payload.requestId
                            ? (a) => handleVapAction(payload!.requestId!, a)
                            : undefined
                        }
                      />
                    );
                  })()}

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

                  {/* Timestamp + receipt status */}
                  <div className={`flex items-center gap-1 mt-1 ${isSent ? "justify-end" : "justify-start"}`}>
                    <span className="text-[10px] text-slate-400">{formatTime(msg.createdAt)}</span>
                    {isSent && (() => {
                      // Legacy demo / mock messages have no delivered/read
                      // data — render the old double-check to keep the
                      // demo looking identical.
                      if (isMockContact || msg.id.startsWith("demo_")) {
                        return <CheckCheck size={13} className="text-purple-400" />;
                      }
                      if (msg.readAt) {
                        // read: bright purple double-check
                        return <CheckCheck size={13} className="text-purple-500" aria-label="Read" />;
                      }
                      if (msg.deliveredAt) {
                        // delivered but not yet read: muted double-check
                        return <CheckCheck size={13} className="text-slate-400" aria-label="Delivered" />;
                      }
                      // queued / sending: single check
                      return <Check size={13} className="text-slate-300" aria-label="Sent" />;
                    })()}
                  </div>
                </div>
                {/* User avatar on sent messages. Renders the deterministic
                    gradient + initials variant of the signed-in user via
                    the Avatar component. The previous hardcoded
                    "/avatars/paul-1.jpg" was a dev-time placeholder that
                    leaked Paul's face onto every other user's sent-message
                    bubbles — caught by a real beta user (Joze Krajz) when
                    his messages to Paul started showing Paul's photo on
                    his own outgoing bubbles. */}
                {isSent && (
                  <div className="shrink-0 mt-1">
                    <Avatar name={user?.displayName ?? "You"} size="sm" />
                  </div>
                )}
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

        {/* Smart-reply chips (S-207) — fetches when there's a fresh inbound */}
        <SmartReplyChips
          inboundMessage={smartReplyInbound}
          threadContext={smartReplyContext}
          onPick={(reply) => {
            setMessage(reply);
            addBreadcrumb("yogi.smart_reply.accepted", { replyLength: reply.length });
          }}
        />

        {attachError && (
          <div className="mb-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200">
            <p className="text-[11px] text-rose-700">{attachError}</p>
          </div>
        )}

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
          {/* Attachment — opens an image picker. Hidden file input is
              mounted below the action area so the button can trigger it.
              Disabled for mock peers (no real userId to send to). */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={handleImagePick}
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => !isMockContact && imageInputRef.current?.click()}
            disabled={isMockContact || imageUploading}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 disabled:opacity-50"
            aria-label="Attach an image"
          >
            {imageUploading ? (
              <span className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Paperclip size={18} className="text-slate-400" />
            )}
          </motion.button>

          {/* VAP — Send / Request / Split. Disabled for mock peers since
              there's no real userId to address the API to. */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => !isMockContact && setShowVapSheet(true)}
            disabled={isMockContact}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              isMockContact
                ? "bg-slate-100 opacity-50"
                : "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-500/20"
            }`}
            aria-label="Open wallet actions"
          >
            <DollarSign size={18} className={isMockContact ? "text-slate-400" : "text-white"} />
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
              placeholder={t("chat.composer.placeholder")}
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

      {/* Contact Profile Sheet */}
      <AnimatePresence>
        {showProfile && isMockContact && MOCK_PROFILES[chatId] && (
          <ContactProfileSheet
            profile={MOCK_PROFILES[chatId]}
            messagesRemaining={remainingMessages}
            onClose={() => setShowProfile(false)}
            onMessage={() => setShowProfile(false)}
          />
        )}
      </AnimatePresence>

      {/* VAP Action Sheet — Send / Request / Split with the current peer.
          Only mounted for real (non-mock) contacts. */}
      <AnimatePresence>
        {showVapSheet && !isMockContact && (
          <VapActionSheet
            authFetch={authFetch}
            peerId={chatId}
            peerName={displayName}
            onClose={() => setShowVapSheet(false)}
            onSent={() => {
              // Refetch immediately so the new vap_* message appears as
              // an inline bubble without waiting for the 3s poll.
              void fetchMessages();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
