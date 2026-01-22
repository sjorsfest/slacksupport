import { useEffect, useRef, useState, useCallback } from "react";
import type { LoaderFunctionArgs, LinksFunction } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { motion } from "framer-motion";
import { Send, X, Sparkles, PartyPopper, AlertTriangle, CheckCircle2, RefreshCw, Plus } from "lucide-react";
import { isRouteErrorResponse, useRouteError } from "react-router";

import { prisma } from "~/lib/db.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import appStyles from "~/app.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: appStyles },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;500;600;700&family=Nunito:wght@400;500;600;700&display=swap",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");
  const visitorId = url.searchParams.get("visitorId");
  const metadata = url.searchParams.get("metadata");
  const email = url.searchParams.get("email");
  const name = url.searchParams.get("name");

  if (!accountId) {
    throw new Response("MISSING_ACCOUNT_ID", { status: 400 });
  }

  // Check if the account exists
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true },
  });

  if (!account) {
    throw new Response("ACCOUNT_NOT_FOUND", { status: 404 });
  }

  const widgetConfig = await prisma.widgetConfig.findUnique({
    where: { accountId },
    include: {
      account: {
        select: { name: true, allowedDomains: true },
      },
    },
  });

  if (!widgetConfig) {
    throw new Response("WIDGET_NOT_CONFIGURED", { status: 404 });
  }

  // Validate allowed domains if configured
  const allowedDomains = widgetConfig.account.allowedDomains || [];
  if (allowedDomains.length > 0) {
    const referer = request.headers.get("Referer");
    const origin = request.headers.get("Origin");

    // Get the domain from referer or origin header
    let requestDomain: string | null = null;
    try {
      if (referer) {
        requestDomain = new URL(referer).hostname;
      } else if (origin) {
        requestDomain = new URL(origin).hostname;
      }
    } catch {
      // Invalid URL in headers
    }

    if (!requestDomain) {
      throw new Response("ORIGIN_NOT_VERIFIED", { status: 403 });
    }

    // Check if the request domain matches any allowed domain
    const isAllowed = allowedDomains.some((allowed) => {
      // Exact match or subdomain match (e.g., "example.com" allows "sub.example.com")
      return requestDomain === allowed || requestDomain.endsWith(`.${allowed}`);
    });

    if (!isAllowed) {
      throw new Response("DOMAIN_NOT_ALLOWED", { status: 403 });
    }
  }

  let existingTicket = null;
  if (visitorId) {
    const visitor = await prisma.visitor.findUnique({
      where: {
        accountId_anonymousId: {
          accountId,
          anonymousId: visitorId,
        },
      },
      include: {
        tickets: {
          // Get the most recent ticket (open or closed)
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              take: 50,
            },
          },
        },
      },
    });
    existingTicket = visitor?.tickets[0] || null;
  }

  return {
    accountId,
    visitorId: visitorId || "",
    email: email || null,
    name: name || null,
    metadata: metadata ? JSON.parse(metadata) : null,
    config: {
      primaryColor: widgetConfig.primaryColor,
      accentColor: widgetConfig.accentColor,
      greetingText: widgetConfig.greetingText,
      companyName: widgetConfig.companyName || widgetConfig.account.name,
    },
    existingTicket: existingTicket
      ? {
          id: existingTicket.id,
          status: existingTicket.status,
          messages: existingTicket.messages.map((m) => ({
            id: m.id,
            source: m.source,
            text: m.text,
            createdAt: m.createdAt.toISOString(),
            slackUserName: m.slackUserName,
            discordUserName: m.discordUserName,
          })),
        }
      : null,
  };
}

type Message = {
  id: string;
  source: "visitor" | "slack" | "discord";
  text: string;
  createdAt: string;
  slackUserName?: string | null;
  discordUserName?: string | null;
  pending?: boolean;
};

export default function WidgetFrame() {
  const data = useLoaderData<typeof loader>();
  const [messages, setMessages] = useState<Message[]>(
    data.existingTicket?.messages || []
  );
  const [ticketId, setTicketId] = useState<string | null>(
    data.existingTicket?.id || null
  );
  const [ticketStatus, setTicketStatus] = useState<"OPEN" | "CLOSED">(
    (data.existingTicket?.status as "OPEN" | "CLOSED") || "OPEN"
  );
  const [inputValue, setInputValue] = useState("");
  const [isIdle, setIsIdle] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<Date>(new Date());
  const lastMessageTimeRef = useRef<string | null>(null);

  const messageFetcher = useFetcher();
  const isPollingRef = useRef(false);

  const [visitorInfo, setVisitorInfo] = useState({
    name: data.name || "",
    email: data.email || "",
  });

  const showMissingInfoForm =
    (!visitorInfo.name || !visitorInfo.email) && !ticketId;

  const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const POLLING_INTERVAL_MS = 2500; // 2.5 seconds

  const resetIdleTimeout = useCallback(() => {
    lastActivityRef.current = new Date();
    if (isIdle) {
      setIsIdle(false);
    }

    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    if (ticketId) {
      idleTimeoutRef.current = setTimeout(() => {
        console.log("Chat idle, stopping polling");
        setIsIdle(true);
        isPollingRef.current = false;
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }, IDLE_TIMEOUT_MS);
    }
  }, [isIdle, ticketId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!lastMessageTimeRef.current && messages.length > 0) {
      lastMessageTimeRef.current = messages[messages.length - 1].createdAt;
    }
  }, [messages]);

  // Handle message fetcher response (for sending messages)
  useEffect(() => {
    if (messageFetcher.data) {
      const result = messageFetcher.data as {
        ticketId?: string;
        messageId?: string;
      };

      if (result.messageId) {
        // Update the pending message with the real ID first
        setMessages((prev) => {
          const lastPendingIndex = [...prev]
            .reverse()
            .findIndex((m) => m.pending);
          if (lastPendingIndex !== -1) {
            const realIndex = prev.length - 1 - lastPendingIndex;
            const newMsgs = [...prev];
            const confirmedMessage = {
              ...newMsgs[realIndex],
              id: result.messageId!,
              pending: false,
            };
            newMsgs[realIndex] = confirmedMessage;
            // Update lastMessageTimeRef to prevent polling from fetching this message again
            lastMessageTimeRef.current = confirmedMessage.createdAt;
            return newMsgs;
          }
          return prev;
        });
      }

      // Set ticketId after updating the message to ensure lastMessageTimeRef is set before polling starts
      if (result.ticketId && !ticketId) {
        setTicketId(result.ticketId);
      }
    }
  }, [messageFetcher.data, ticketId]);


  // Start polling for new messages
  const startPolling = useCallback(() => {
    if (!ticketId || isPollingRef.current) return;

    setIsIdle(false);
    isPollingRef.current = true;
    resetIdleTimeout();

    const poll = async () => {
      try {
        const since = lastMessageTimeRef.current || "";
        const params = new URLSearchParams();
        if (since) params.set("since", since);

        const response = await fetch(
          `/api/tickets/${ticketId}/messages?${params.toString()}`
        );

        if (!response.ok) {
          console.error(`Polling failed: ${response.status}`);
          return;
        }

        const pollData = await response.json();
        const newMessages = pollData.messages || [];

        // Check if ticket status changed
        if (pollData.ticketStatus && pollData.ticketStatus !== ticketStatus) {
          setTicketStatus(pollData.ticketStatus);
          // If ticket was closed, stop polling
          if (pollData.ticketStatus === "CLOSED") {
            isPollingRef.current = false;
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            return;
          }
        }

        if (newMessages.length > 0) {
          lastMessageTimeRef.current =
            newMessages[newMessages.length - 1].createdAt;

          setMessages((prev) => {
            const newMsgs = newMessages.filter(
              (m: Message) => !prev.some((p) => p.id === m.id)
            );
            if (newMsgs.length > 0) {
              window.parent.postMessage({ type: "sw:newMessage" }, "*");
              return [...prev, ...newMsgs];
            }
            return prev;
          });
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    // Initial poll
    poll();

    // Set up interval
    pollingIntervalRef.current = setInterval(poll, POLLING_INTERVAL_MS);
  }, [ticketId, ticketStatus, resetIdleTimeout]);

  // Start/stop polling when ticketId changes
  useEffect(() => {
    if (ticketId && !isPollingRef.current) {
      startPolling();
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
      isPollingRef.current = false;
    };
  }, [ticketId, startPolling]);

  // Notify parent frame that widget is ready
  useEffect(() => {
    window.parent.postMessage({ type: "sw:ready" }, "*");
  }, []);

  const handleContinueChat = () => {
    if (ticketId) {
      // Force reset to allow startPolling to restart
      isPollingRef.current = false;
      // Use setTimeout to ensure state update is processed before calling startPolling
      setTimeout(() => startPolling(), 0);
    }
  };

  const handleClose = () => {
    window.parent.postMessage({ type: "sw:close" }, "*");
  };

  const handleReopenTicket = async () => {
    if (!ticketId) return;

    try {
      const response = await fetch(`/api/tickets/${ticketId}/reopen`, {
        method: "POST",
      });

      if (response.ok) {
        setTicketStatus("OPEN");
        // Restart polling
        isPollingRef.current = false;
        setTimeout(() => startPolling(), 0);
      } else {
        console.error("Failed to reopen ticket");
      }
    } catch (error) {
      console.error("Error reopening ticket:", error);
    }
  };

  const handleStartNewTicket = () => {
    // Reset all state to start fresh
    setTicketId(null);
    setTicketStatus("OPEN");
    setMessages([]);
    lastMessageTimeRef.current = null;
    isPollingRef.current = false;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text) return;

    resetIdleTimeout();
    setInputValue("");

    const pendingId = `pending-${Date.now()}`;
    const pendingMessage: Message = {
      id: pendingId,
      source: "visitor",
      text,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, pendingMessage]);

    try {
      if (!ticketId) {
        messageFetcher.submit(
          {
            accountId: data.accountId!,
            visitorId: data.visitorId,
            message: text,
            email: visitorInfo.email,
            name: visitorInfo.name,
            metadata: data.metadata || undefined,
          },
          {
            method: "POST",
            action: "/api/tickets",
            encType: "application/json",
          }
        );
      } else {
        messageFetcher.submit(
          { text },
          {
            method: "POST",
            action: `/api/tickets/${ticketId}/messages`,
            encType: "application/json",
          }
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  };

  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const msgDate = formatDate(msg.createdAt);
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ date: msgDate, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  return (
        <div className="h-full flex flex-col bg-background overflow-hidden">
          {/* Header */}
          <div
            className="p-6 text-white flex items-center justify-between shrink-0 transition-colors duration-300 border-b-2 border-black"
            style={{ backgroundColor: data.config.primaryColor }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shadow-inner">
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg leading-tight tracking-wide">
                  {data.config.companyName}
                </h1>
                <p className="text-xs text-white/90 font-medium">
                  We reply fast!
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 hover:text-white rounded-full transition-all hover:scale-105 active:scale-95"
              onClick={handleClose}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden relative bg-slate-50">
            {showMissingInfoForm && !ticketId ? (
              <div className="absolute inset-0 z-10 bg-slate-50 p-6 flex flex-col justify-center">
                <div className="text-center mb-8">
                  <motion.div
                    className="w-20 h-20 bg-white rounded-3xl shadow-lg flex items-center justify-center mx-auto mb-6 border border-border/50"
                    animate={{ y: [0, -6, 0] }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <PartyPopper
                      className="w-10 h-10"
                      style={{ color: data.config.accentColor }}
                    />
                  </motion.div>
                  <h2 className="font-display text-3xl font-bold mb-2 text-primary">
                    Welcome! 👋
                  </h2>
                  <p className="text-slate-500 text-lg">
                    Let's get to know each other before we start.
                  </p>
                </div>
                <form onSubmit={handleInfoSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="name"
                      className="text-sm font-bold text-slate-700 ml-1"
                    >
                      Name
                    </label>
                    <Input
                      id="name"
                      value={visitorInfo.name}
                      onChange={(e) =>
                        setVisitorInfo((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="What should we call you?"
                      required
                      className="bg-white border-slate-200 h-12 rounded-xl text-base shadow-sm focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="text-sm font-bold text-slate-700 ml-1"
                    >
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={visitorInfo.email}
                      onChange={(e) =>
                        setVisitorInfo((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="Where can we reach you?"
                      required
                      className="bg-white border-slate-200 h-12 rounded-xl text-base shadow-sm focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full font-bold text-lg h-12 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] text-white border-0"
                    style={{ backgroundColor: data.config.accentColor }}
                  >
                    Start Chatting
                  </Button>
                </form>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                {/* Messages Area */}
                <div className={cn(
                  "flex-1 p-4 space-y-6 scroll-smooth",
                  messages.length === 0 ? "overflow-hidden" : "overflow-y-auto"
                )}>
                  {messages.length === 0 && (
                    <div className="h-full flex items-center justify-center text-center p-4">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white px-5 py-4 rounded-2xl shadow-sm border border-slate-100"
                      >
                        <div className="text-2xl mb-2">👋</div>
                        <p
                          className="font-bold mb-1"
                          style={{ color: data.config.accentColor }}
                        >
                          Hi there!
                        </p>
                        <p className="text-xs text-slate-500">
                          {data.config.greetingText}
                        </p>
                      </motion.div>
                    </div>
                  )}

                  {groupedMessages.map((group, groupIdx) => (
                    <div key={groupIdx} className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-slate-200" />
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                          {group.date}
                        </span>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>

                      {group.messages.map((msg) => {
                        const isVisitor = msg.source === "visitor";
                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={cn(
                              "flex gap-3 max-w-[85%]",
                              isVisitor ? "ml-auto flex-row-reverse" : ""
                            )}
                          >
                            <Avatar className="w-8 h-8 border-2 border-white shadow-sm shrink-0">
                              <AvatarFallback
                                className={cn(
                                  "text-xs font-bold",
                                  isVisitor
                                    ? "bg-slate-800 text-white"
                                    : "bg-white text-slate-800 border border-slate-200"
                                )}
                              >
                                {isVisitor
                                  ? "Y"
                                  : (msg.slackUserName ||
                                      msg.discordUserName)?.[0]?.toUpperCase() ||
                                    "A"}
                              </AvatarFallback>
                            </Avatar>

                            <div
                              className={cn(
                                "flex flex-col gap-1",
                                isVisitor ? "items-end" : "items-start"
                              )}
                            >
                              <div
                                className={cn(
                                  "p-3.5 rounded-2xl text-sm shadow-sm leading-relaxed",
                                  isVisitor
                                    ? "text-white rounded-tr-none"
                                    : "bg-white text-slate-700 rounded-tl-none border border-slate-100",
                                  msg.pending && "opacity-70"
                                )}
                                style={
                                  isVisitor
                                    ? { backgroundColor: data.config.accentColor }
                                    : undefined
                                }
                              >
                                {msg.text}
                              </div>
                              <span className="text-[10px] text-slate-400 px-1 font-medium">
                                {msg.source !== "visitor" &&
                                  (msg.slackUserName ||
                                    msg.discordUserName) && (
                                    <span className="mr-1">
                                      {msg.slackUserName || msg.discordUserName}{" "}
                                      •
                                    </span>
                                  )}
                                {formatTime(msg.createdAt)}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ))}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-black">
                  {ticketStatus === "CLOSED" ? (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <p className="text-sm text-slate-600 font-medium">
                          This conversation has been closed
                        </p>
                      </div>
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={handleReopenTicket}
                          variant="outline"
                          className="rounded-full border-slate-300 hover:bg-slate-50 gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Reopen
                        </Button>
                        <Button
                          onClick={handleStartNewTicket}
                          className="rounded-full gap-2 text-white border-0"
                          style={{ backgroundColor: data.config.accentColor }}
                        >
                          <Plus className="w-4 h-4" />
                          New Conversation
                        </Button>
                      </div>
                    </div>
                  ) : isIdle ? (
                    <div className="text-center">
                      <p className="text-sm text-slate-500 mb-3">
                        Chat paused due to inactivity
                      </p>
                      <Button
                        onClick={handleContinueChat}
                        variant="outline"
                        className="rounded-full border-slate-300 hover:bg-slate-50"
                      >
                        Continue Chat
                      </Button>
                    </div>
                  ) : (
                    <div className="relative flex items-end gap-2">
                      <Textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="min-h-12 max-h-32 py-3.5 resize-none rounded-2xl pr-12 bg-slate-50 focus:bg-white transition-all border-slate-200 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:border-slate-400"
                        rows={1}
                      />
                      <Button
                        size="icon"
                        onClick={handleSendMessage}
                        disabled={
                          !inputValue.trim() || messageFetcher.state !== "idle"
                        }
                        className={cn(
                          "absolute right-1.5 bottom-1.5 h-10 w-10 rounded-full transition-all duration-200 shadow-sm border-0",
                          inputValue.trim()
                            ? "scale-100 opacity-100"
                            : "scale-90 opacity-0"
                        )}
                        style={{ backgroundColor: data.config.accentColor }}
                      >
                        <Send className="w-5 h-5 text-white" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
  );
}

// Error messages for different error codes
const ERROR_MESSAGES: Record<
  string,
  { title: string; description: string; hint?: string }
> = {
  MISSING_ACCOUNT_ID: {
    title: "Missing Configuration",
    description: "The widget is missing the account ID parameter.",
    hint: "Make sure you're using the correct widget embed code from your dashboard.",
  },
  ACCOUNT_NOT_FOUND: {
    title: "Account Not Found",
    description: "The account ID provided does not exist.",
    hint: "Please verify you're using the correct account ID from your dashboard.",
  },
  WIDGET_NOT_CONFIGURED: {
    title: "Widget Not Configured",
    description: "The support widget hasn't been set up for this account yet.",
    hint: "Go to your dashboard settings to configure the widget.",
  },
  ORIGIN_NOT_VERIFIED: {
    title: "Origin Not Verified",
    description: "We couldn't verify the origin of this request.",
    hint: "This widget must be loaded from an allowed domain.",
  },
  DOMAIN_NOT_ALLOWED: {
    title: "Domain Not Allowed",
    description: "This widget is not authorized to run on this domain.",
    hint: "Add this domain to your allowed domains list in the dashboard settings.",
  },
};

export function ErrorBoundary() {
  const error = useRouteError();


  let errorCode = "UNKNOWN";
  let errorInfo: { title: string; description: string; hint?: string } = {
    title: "Something Went Wrong",
    description: "An unexpected error occurred while loading the widget.",
    hint: "Please try refreshing the page or contact support if the issue persists.",
  };

  if (isRouteErrorResponse(error)) {
    errorCode = error.data || "UNKNOWN";
    if (ERROR_MESSAGES[errorCode]) {
      errorInfo = ERROR_MESSAGES[errorCode];
    }
  }

  return (
        <div className="h-full flex flex-col bg-background overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-secondary text-white flex items-center justify-between shrink-0 border-b-2 border-black">
            <div className="flex items-center gap-3 mt-2">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shadow-inner">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display text-primary font-bold text-lg leading-tight tracking-wide">
                  Donkey Support
                </h1>
                <p className="text-xs text-white/90 font-medium">
                  Configuration Error
                </p>
              </div>
            </div>
          </div>

          {/* Error Content */}
          <div className="flex-1 overflow-hidden relative bg-slate-50">
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mb-6 border border-red-200"
              >
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </motion.div>

              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="font-display text-primary text-2xl font-bold mb-2">
                  {errorInfo.title}
                </h2>
                <p className="text-slate-600 mb-4 max-w-sm">
                  {errorInfo.description}
                </p>
                {errorInfo.hint && (
                  <p className="text-sm text-slate-500 bg-slate-100 rounded-xl px-4 py-3 max-w-sm">
                    💡 {errorInfo.hint}
                  </p>
                )}
              </motion.div>

              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-6"
              >
                <p className="text-xs text-slate-400 font-mono">
                  Error code: {errorCode}
                </p>
              </motion.div>
            </div>
          </div>
        </div>
  );
}
