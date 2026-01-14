import { useEffect, useRef, useState, useCallback } from "react";
import type { LoaderFunctionArgs, LinksFunction } from "react-router";
import { useLoaderData, useFetcher, Links, Meta } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, MessageSquare, Sparkles, PartyPopper } from "lucide-react";

import { prisma } from "~/lib/db.server";
import { isServerless } from "~/lib/env.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import appStyles from "~/app.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: appStyles },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;500;600;700&family=Nunito:wght@400;500;600;700&display=swap" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");
  const visitorId = url.searchParams.get("visitorId");
  const metadata = url.searchParams.get("metadata");
  const email = url.searchParams.get("email");
  const name = url.searchParams.get("name");

  if (!accountId) {
    throw new Response("Missing accountId", { status: 400 });
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
    throw new Response("Widget not configured", { status: 404 });
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
          where: {
            status: { in: ["OPEN", "PENDING"] },
          },
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

  const usePolling = isServerless();
  
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
          messages: existingTicket.messages.map((m) => ({
            id: m.id,
            source: m.source,
            text: m.text,
            createdAt: m.createdAt.toISOString(),
            slackUserName: m.slackUserName,
          })),
        }
      : null,
    usePolling,
  };
}

type Message = {
  id: string;
  source: "visitor" | "slack" | "agent_dashboard" | "system";
  text: string;
  createdAt: string;
  slackUserName?: string | null;
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
  const [inputValue, setInputValue] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<Date>(new Date());
  const lastMessageTimeRef = useRef<string | null>(null);

  const messageFetcher = useFetcher();
  const pollingFetcher = useFetcher<{ messages: Message[] }>();

  const [visitorInfo, setVisitorInfo] = useState({
    name: data.name || "",
    email: data.email || "",
  });
  
  const showMissingInfoForm = (!visitorInfo.name || !visitorInfo.email) && !ticketId;

  const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
  const POLLING_INTERVAL_MS = 2000;

  const resetIdleTimeout = useCallback(() => {
    lastActivityRef.current = new Date();
    if (isIdle) {
      setIsIdle(false);
    }
    
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    
    if (data.usePolling && ticketId) {
      idleTimeoutRef.current = setTimeout(() => {
        console.log("Chat idle, stopping polling");
        setIsIdle(true);
        setIsConnected(false);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }, IDLE_TIMEOUT_MS);
    }
  }, [isIdle, data.usePolling, ticketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messageFetcher.data) {
      const result = messageFetcher.data as any;
      
      if (result.ticketId && !ticketId) {
        setTicketId(result.ticketId);
      }

      if (result.messageId) {
        setMessages((prev) => {
          const lastPendingIndex = [...prev].reverse().findIndex(m => m.pending);
          if (lastPendingIndex !== -1) {
            const realIndex = prev.length - 1 - lastPendingIndex;
             const newMsgs = [...prev];
             newMsgs[realIndex] = {
               ...newMsgs[realIndex],
               id: result.messageId,
               pending: false
             };
             return newMsgs;
          }
          return prev;
        });
      }
    }
  }, [messageFetcher.data, ticketId]);

  useEffect(() => {
    if (pollingFetcher.data && pollingFetcher.data.messages) {
       const newMessages = pollingFetcher.data.messages;
       if (newMessages.length > 0) {
          lastMessageTimeRef.current = newMessages[newMessages.length - 1].createdAt;
          
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
    }
  }, [pollingFetcher.data]);

  const startPolling = useCallback(() => {
    if (!ticketId || !data.usePolling) return;

    setIsConnected(true);
    setIsIdle(false);
    resetIdleTimeout();

    if (!lastMessageTimeRef.current && messages.length > 0) {
      lastMessageTimeRef.current = messages[messages.length - 1].createdAt;
    }

    const poll = () => {
        if (pollingFetcher.state === "idle") {
            const since = lastMessageTimeRef.current || '';
            const params = new URLSearchParams();
            if (since) params.set("since", since);
            
            pollingFetcher.load(`/api/tickets/${ticketId}/messages?${params.toString()}`);
        }
    };

    poll();
    pollingIntervalRef.current = setInterval(poll, POLLING_INTERVAL_MS);
  }, [ticketId, data.usePolling, messages, resetIdleTimeout, pollingFetcher]);

  const connectSSE = useCallback(() => {
    if (!ticketId || data.usePolling) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sseUrl = `/api/tickets/${ticketId}/stream`;
    const eventSource = new EventSource(sseUrl);

    eventSource.addEventListener("connected", () => {
      setIsConnected(true);
    });

    eventSource.addEventListener("message", (event) => {
      try {
        const messageData = JSON.parse(event.data);
        const newMessage: Message = {
          id: messageData.messageId,
          source: messageData.source,
          text: messageData.text,
          createdAt: messageData.createdAt,
          slackUserName: messageData.slackUserName,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
        window.parent.postMessage({ type: "sw:newMessage" }, "*");
      } catch (e) {
        console.error("Failed to parse SSE message:", e);
      }
    });

    eventSource.onerror = (error) => {
      setIsConnected(false);
      eventSource.close();
      
      setTimeout(() => {
        connectSSE();
      }, 3000);
    };

    eventSourceRef.current = eventSource;
  }, [ticketId, data.usePolling]);

  useEffect(() => {
    if (ticketId) {
      if (data.usePolling) {
        startPolling();
      } else {
        connectSSE();
      }
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [ticketId, data.usePolling, connectSSE, startPolling]);

  const handleContinueChat = () => {
    if (data.usePolling && ticketId) {
      startPolling();
    }
  };

  useEffect(() => {
    window.parent.postMessage({ type: "sw:ready" }, "*");
  }, []);

  const handleClose = () => {
    window.parent.postMessage({ type: "sw:close" }, "*");
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
      let currentTicketId = ticketId;

      if (!currentTicketId) {
        messageFetcher.submit(
          {
            accountId: data.accountId!,
            visitorId: data.visitorId,
            message: text,
            email: visitorInfo.email,
            name: visitorInfo.name,
            metadata: data.metadata ? JSON.stringify(data.metadata) : "{}",
          },
          {
            method: "POST",
            action: "/api/tickets",
            encType: "application/json",
          }
        );
      } else {
        messageFetcher.submit(
          { text, source: "visitor" },
          {
            method: "POST",
            action: `/api/tickets/${currentTicketId}/messages`,
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
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Support</title>
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-transparent overflow-hidden font-sans">
        <div className="h-full flex flex-col bg-background rounded-3xl overflow-hidden shadow-2xl border border-border/50">
          {/* Header */}
          <div 
            className="p-4 text-white flex items-center justify-between shrink-0 transition-colors duration-300 bg-secondary"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shadow-inner">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg leading-tight tracking-wide">
                  {data.config.companyName}
                </h1>
                <p className="text-xs text-white/90 font-medium">
                  We reply in a few minutes
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 hover:text-white rounded-full transition-colors"
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
                  <div className="w-20 h-20 bg-white rounded-3xl shadow-lg flex items-center justify-center mx-auto mb-6 animate-bounce-subtle border border-border/50">
                    <PartyPopper className="w-10 h-10 text-secondary" />
                  </div>
                  <h2 className="font-display text-3xl font-bold mb-2 text-slate-800">Welcome! 👋</h2>
                  <p className="text-slate-500 text-lg">
                    Let's get to know each other before we start.
                  </p>
                </div>
                <form onSubmit={handleInfoSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-bold text-slate-700 ml-1">Name</label>
                    <Input
                      id="name"
                      value={visitorInfo.name}
                      onChange={(e) => setVisitorInfo(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="What should we call you?"
                      required
                      className="bg-white border-slate-200 h-12 rounded-xl text-base shadow-sm focus:ring-2 focus:ring-secondary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-bold text-slate-700 ml-1">Email</label>
                    <Input
                      id="email"
                      type="email"
                      value={visitorInfo.email}
                      onChange={(e) => setVisitorInfo(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Where can we reach you?"
                      required
                      className="bg-white border-slate-200 h-12 rounded-xl text-base shadow-sm focus:ring-2 focus:ring-secondary/20"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full font-bold text-lg h-12 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] bg-secondary text-white border-0"
                  >
                    Start Chatting
                  </Button>
                </form>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
                  {messages.length === 0 && (
                    <div className="text-center py-12 px-4">
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-block bg-white px-6 py-4 rounded-3xl shadow-sm border border-slate-100"
                      >
                        <p className="text-slate-600 font-medium">
                          {data.config.greetingText}
                        </p>
                      </motion.div>
                    </div>
                  )}

                  {groupedMessages.map((group, groupIdx) => (
                    <div key={groupIdx} className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-slate-200" />
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{group.date}</span>
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
                              <AvatarFallback className={cn(
                                "text-xs font-bold",
                                isVisitor ? "bg-slate-800 text-white" : "bg-white text-slate-800 border border-slate-200"
                              )}>
                                {isVisitor ? "Y" : msg.slackUserName?.[0]?.toUpperCase() || "A"}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className={cn(
                              "flex flex-col gap-1",
                              isVisitor ? "items-end" : "items-start"
                            )}>
                              <div 
                                className={cn(
                                  "p-3.5 rounded-2xl text-sm shadow-sm leading-relaxed",
                                  isVisitor 
                                    ? "text-white rounded-tr-none bg-secondary" 
                                    : "bg-white text-slate-700 rounded-tl-none border border-slate-100",
                                  msg.pending && "opacity-70"
                                )}
                              >
                                {msg.text}
                              </div>
                              <span className="text-[10px] text-slate-400 px-1 font-medium">
                                {msg.source !== "visitor" && msg.slackUserName && (
                                  <span className="mr-1">{msg.slackUserName} •</span>
                                )}
                                {formatTime(msg.createdAt)}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ))}
                  
                  {isTyping && (
                    <div className="flex gap-3">
                      <Avatar className="w-8 h-8"><AvatarFallback>...</AvatarFallback></Avatar>
                      <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-slate-100">
                  {isIdle ? (
                    <div className="text-center">
                      <p className="text-sm text-slate-500 mb-3">Chat paused due to inactivity</p>
                      <Button onClick={handleContinueChat} variant="outline" className="rounded-full border-slate-300 hover:bg-slate-50">
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
                        className="min-h-[3rem] max-h-32 py-3.5 resize-none rounded-2xl pr-12 bg-slate-50 focus:bg-white transition-all border-slate-200 focus-visible:ring-2 focus-visible:ring-secondary/20 focus-visible:border-secondary/50"
                        rows={1}
                      />
                      <Button
                        size="icon"
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || messageFetcher.state !== "idle"}
                        className={cn(
                          "absolute right-1.5 bottom-1.5 h-10 w-10 rounded-full transition-all duration-200 shadow-sm bg-secondary border-0",
                          inputValue.trim() ? "scale-100 opacity-100" : "scale-90 opacity-0"
                        )}
                      >
                        <Send className="w-5 h-5 text-white" />
                      </Button>
                    </div>
                  )}
                  <div className="text-center mt-3">
                     <a href="#" className="text-[10px] font-bold text-slate-300 hover:text-secondary transition-colors uppercase tracking-widest">
                       Powered by Donkey Support
                     </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
