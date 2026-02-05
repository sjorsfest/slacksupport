import { useEffect, useRef, useState } from "react";
import type { LoaderFunctionArgs, LinksFunction } from "react-router";
import { useLoaderData, useFetcher, useRevalidator } from "react-router";
import { motion } from "framer-motion";
import { Send, X, Sparkles, PartyPopper, AlertTriangle, CheckCircle2, RefreshCw, Plus, Moon } from "lucide-react";
import { isRouteErrorResponse, useRouteError } from "react-router";

import { prisma } from "~/lib/db.server";
import { settings } from "~/lib/settings.server";
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

    // Get the host (includes port when present) from referer or origin header
    let requestHost: string | null = null;
    try {
      if (referer) {
        requestHost = new URL(referer).host;
      } else if (origin) {
        requestHost = new URL(origin).host;
      }
    } catch {
      // Invalid URL in headers
    }

    if (!requestHost) {
      throw new Response("ORIGIN_NOT_VERIFIED", { status: 403 });
    }

    // Check if the request domain matches any allowed domain
    const isAllowed = allowedDomains.some((allowed) => {
      const normalizedAllowed = allowed.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
      const normalizedRequest = requestHost.toLowerCase();

      // Exact host match (supports ports, e.g., "localhost:5173")
      if (normalizedRequest === normalizedAllowed) return true;

      // Subdomain match only when allowed has no port
      if (!normalizedAllowed.includes(":")) {
        return normalizedRequest === normalizedAllowed || normalizedRequest.endsWith(`.${normalizedAllowed}`);
      }

      return false;
    });

    if (!isAllowed) {
      throw new Response("DOMAIN_NOT_ALLOWED", { status: 403 });
    }
  }

  // Check if this is a paid account (not freemium)
  const subscription = await prisma.subscription.findUnique({
    where: { accountId },
    select: { stripeProductId: true, status: true },
  });

  const isPaidAccount = subscription &&
    ['active', 'trialing'].includes(subscription.status) &&
    subscription.stripeProductId !== settings.STRIPE_FREEMIUM_PRODUCT_ID;

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
      officeHoursStart: widgetConfig.officeHoursStart,
      officeHoursEnd: widgetConfig.officeHoursEnd,
      officeHoursTimezone: widgetConfig.officeHoursTimezone,
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
    isPaidAccount,
  };
}

type Message = {
  id: string;
  source: "visitor" | "slack" | "discord" | "telegram";
  text: string;
  createdAt: string;
  slackUserName?: string | null;
  discordUserName?: string | null;
  telegramUserName?: string | null;
  pending?: boolean;
};

function getOfficeHoursStatus(config: {
  officeHoursStart?: string | null;
  officeHoursEnd?: string | null;
  officeHoursTimezone?: string | null;
}): { isOpen: boolean; opensAt?: string; closesAt?: string; timezone?: string } {
  // If no office hours set, always open
  if (!config.officeHoursStart || !config.officeHoursEnd) {
    return { isOpen: true };
  }

  // Get current time in configured timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: config.officeHoursTimezone || "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const currentTime = formatter.format(now);

  // Compare times (HH:MM string comparison works for 24h format)
  const isOpen =
    currentTime >= config.officeHoursStart &&
    currentTime < config.officeHoursEnd;

  return {
    isOpen,
    opensAt: config.officeHoursStart,
    closesAt: config.officeHoursEnd,
    timezone: config.officeHoursTimezone || "UTC",
  };
}

export default function WidgetFrame() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const messageFetcher = useFetcher();

  // Derive from loader (source of truth)
  const loaderMessages: Message[] = data.existingTicket?.messages || [];
  const ticketId = data.existingTicket?.id || null;
  const ticketStatus = (data.existingTicket?.status as "OPEN" | "CLOSED") || "OPEN";

  // Only pending messages in state
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isIdle, setIsIdle] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevLoaderMessagesLengthRef = useRef(loaderMessages.length);

  const [visitorInfo, setVisitorInfo] = useState({
    name: data.name || "",
    email: data.email || "",
  });
  const [hasSubmittedInfo, setHasSubmittedInfo] = useState(
    Boolean(data.name && data.email)
  );
  const [emailError, setEmailError] = useState<string | null>(null);

  // Combined messages for display
  const allMessages = [...loaderMessages, ...pendingMessages];

  // Office hours status
  const officeStatus = getOfficeHoursStatus(data.config);

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const showMissingInfoForm = !hasSubmittedInfo && !ticketId;

  const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const POLLING_INTERVAL_MS = 2500; // 2.5 seconds

  const resetIdleTimeout = () => {
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
      }, IDLE_TIMEOUT_MS);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  // Notify parent when new messages arrive from operator
  useEffect(() => {
    if (loaderMessages.length > prevLoaderMessagesLengthRef.current) {
      const newMessages = loaderMessages.slice(prevLoaderMessagesLengthRef.current);
      const hasOperatorMessage = newMessages.some(m => m.source !== "visitor");
      if (hasOperatorMessage) {
        window.parent.postMessage({ type: "sw:newMessage" }, "*");
      }
    }
    prevLoaderMessagesLengthRef.current = loaderMessages.length;
  }, [loaderMessages]);

  // Reconcile: remove pending messages that now exist in loader data
  // When we find a match, also remove all earlier pending messages since they
  // must have been processed too (handles race condition when fetcher.data gets overwritten)
  useEffect(() => {
    if (loaderMessages.length === 0) return;
    setPendingMessages(prev => {
      // Find the last index where the pending message ID exists in loader
      let lastMatchIndex = -1;
      for (let i = 0; i < prev.length; i++) {
        if (loaderMessages.some(m => m.id === prev[i].id)) {
          lastMatchIndex = i;
        }
      }

      // Remove all messages up to and including the last match
      if (lastMatchIndex >= 0) {
        return prev.slice(lastMatchIndex + 1);
      }
      return prev;
    });
  }, [loaderMessages]);

  // Handle fetcher response - update pending message with real ID
  useEffect(() => {
    const result = messageFetcher.data as {
      messageId?: string;
      pendingId?: string;
      ticketId?: string;
    } | undefined;

    if (result?.messageId && result?.pendingId) {
      setPendingMessages(prev =>
        prev.map(m =>
          m.id === result.pendingId
            ? { ...m, id: result.messageId!, pending: false }
            : m
        )
      );
    }
  }, [messageFetcher.data]);

  // Polling via revalidator
  useEffect(() => {
    if (!ticketId || isIdle || ticketStatus === "CLOSED") return;

    const interval = setInterval(() => {
      if (revalidator.state === "idle") {
        revalidator.revalidate();
      }
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [ticketId, isIdle, ticketStatus, revalidator]);

  // Cleanup idle timeout on unmount
  useEffect(() => {
    return () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, []);

  // Notify parent frame that widget is ready
  useEffect(() => {
    window.parent.postMessage(
      {
        type: "sw:ready",
        accentColor: data.config.accentColor,
      },
      "*"
    );
  }, [data.config.accentColor]);

  const handleContinueChat = () => {
    setIsIdle(false);
    resetIdleTimeout();
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
        revalidator.revalidate();
      } else {
        console.error("Failed to reopen ticket");
      }
    } catch (error) {
      console.error("Error reopening ticket:", error);
    }
  };

  const handleStartNewTicket = () => {
    setPendingMessages([]);
    // Navigate to clear the ticket from URL/loader
    window.location.reload();
  };

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    if (!visitorInfo.name.trim()) {
      return;
    }

    if (!visitorInfo.email.trim()) {
      setEmailError("Please enter your email");
      return;
    }

    if (!isValidEmail(visitorInfo.email.trim())) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setHasSubmittedInfo(true);
  };

  const handleSendMessage = () => {
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
    setPendingMessages(prev => [...prev, pendingMessage]);

    if (!ticketId) {
      messageFetcher.submit(
        {
          accountId: data.accountId!,
          visitorId: data.visitorId,
          message: text,
          email: visitorInfo.email,
          name: visitorInfo.name,
          metadata: data.metadata || undefined,
          pendingId,
        },
        {
          method: "POST",
          action: "/api/tickets",
          encType: "application/json",
        }
      );
    } else {
      messageFetcher.submit(
        { text, pendingId },
        {
          method: "POST",
          action: `/api/tickets/${ticketId}/messages`,
          encType: "application/json",
        }
      );
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
  for (const msg of allMessages) {
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
                      onChange={(e) => {
                        setVisitorInfo((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }));
                        // Clear error when user starts typing
                        if (emailError) setEmailError(null);
                      }}
                      placeholder="Where can we reach you?"
                      required
                      className={cn(
                        "bg-white border-slate-200 h-12 rounded-xl text-base shadow-sm focus:ring-2 focus:ring-slate-300",
                        emailError && "border-red-400 focus:ring-red-200"
                      )}
                    />
                    {emailError && (
                      <p className="text-sm text-red-500 ml-1">{emailError}</p>
                    )}
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
                  allMessages.length === 0 ? "overflow-hidden" : "overflow-y-auto"
                )}>
                  {allMessages.length === 0 && (
                    <div className="h-full flex items-center justify-center text-center p-4">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white px-5 py-4 rounded-2xl shadow-sm border border-slate-100"
                      >
                        {officeStatus.isOpen ? (
                          <>
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
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                              <Moon className="w-5 h-5 text-slate-500" />
                            </div>
                            <p
                              className="font-bold mb-1"
                              style={{ color: data.config.accentColor }}
                            >
                              We're currently away
                            </p>
                            <p className="text-xs text-slate-500 mb-2">
                              We'll be back at {officeStatus.opensAt}
                            </p>
                            <p className="text-xs text-slate-400">
                              Leave a message and we'll get back to you!
                            </p>
                          </>
                        )}
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
                                    msg.discordUserName ||
                                    msg.telegramUserName) && (
                                    <span className="mr-1">
                                      {msg.slackUserName || msg.discordUserName || msg.telegramUserName}{" "}
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
                          !inputValue.trim() || messageFetcher.state !== "idle" || pendingMessages.length > 0
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

                {/* Powered by watermark for freemium accounts */}
                {!data.isPaidAccount && (
                  <div className="pb-2 -mt-4 px-4 bg-white text-center">
                    <a
                      href="https://donkey.support"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Powered by <span style={{ color: data.config.primaryColor }} className="font-semibold">Donkey Support 🫏</span>
                    </a>
                  </div>
                )}
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
