import { useEffect, useRef, useState, useCallback } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { prisma } from "~/lib/db.server";
import { isServerless } from "~/lib/env.server";
import "../styles/widget.frame.css";

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

  // Get widget config
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

  // Get existing ticket for this visitor if any
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

  // Use polling on serverless environments (Vercel, Lambda, etc.) where SSE doesn't work reliably
  const usePolling = isServerless();
  
  if (usePolling) {
    console.log("[Widget] Running in SERVERLESS mode - using polling for real-time updates");
  } else {
    console.log("[Widget] Running in PERSISTENT SERVER mode - using SSE for real-time updates");
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

  const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const POLLING_INTERVAL_MS = 2000; // 2 seconds

  // Reset idle timeout on activity
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

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle message sending response
  useEffect(() => {
    if (messageFetcher.data) {
      const result = messageFetcher.data as any;
      
      // If we just created a ticket
      if (result.ticketId && !ticketId) {
        setTicketId(result.ticketId);
      }

      // If we got a message ID back (success)
      if (result.messageId) {
        // Find the pending message and update it
        setMessages((prev) => {
          // We need to find which pending message this corresponds to.
          // Since we don't pass the pending ID to the server, we might just look for the last pending one
          // or rely on the fact that we only send one at a time effectively.
          // A better approach would be to pass a client-side ID to the server and have it return it.
          // For now, let's just update the most recent pending message or all pending messages if we can't distinguish.
          // Actually, let's just replace the pending message with the real one if we can match the text or just rely on the server response.
          
          // Simplification: Just mark the last pending message as sent or replace it.
          // Ideally we'd match by a temporary ID.
          
          // Let's try to match by text if possible, or just the last pending one.
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


  // Polling logic using useFetcher
  useEffect(() => {
    if (pollingFetcher.data && pollingFetcher.data.messages) {
       const newMessages = pollingFetcher.data.messages;
       if (newMessages.length > 0) {
          // Update last message time
          lastMessageTimeRef.current = newMessages[newMessages.length - 1].createdAt;
          
          // Add new messages
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


  // Polling for serverless environments (Vercel, Lambda, etc.)
  const startPolling = useCallback(() => {
    if (!ticketId || !data.usePolling) return;

    setIsConnected(true);
    setIsIdle(false);
    resetIdleTimeout();

    // Set initial last message time
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

    // Poll immediately, then every 2 seconds
    poll();
    pollingIntervalRef.current = setInterval(poll, POLLING_INTERVAL_MS);
  }, [ticketId, data.usePolling, messages, resetIdleTimeout, pollingFetcher]); // Added pollingFetcher to deps

  // SSE connection for persistent server environments
  const connectSSE = useCallback(() => {
    if (!ticketId || data.usePolling) return;

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // We can use a relative URL here because the browser will resolve it against the current origin
    const sseUrl = `/api/tickets/${ticketId}/stream`;
    const eventSource = new EventSource(sseUrl);

    eventSource.addEventListener("connected", () => {
      setIsConnected(true);
      console.log("SSE connected");
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
          // Avoid duplicates
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
        // Notify parent of new message
        window.parent.postMessage({ type: "sw:newMessage" }, "*");
      } catch (e) {
        console.error("Failed to parse SSE message:", e);
      }
    });

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      setIsConnected(false);
      eventSource.close();
      
      // Reconnect after 3 seconds
      setTimeout(() => {
        console.log("SSE reconnecting...");
        connectSSE();
      }, 3000);
    };

    eventSourceRef.current = eventSource;
  }, [ticketId, data.usePolling]);

  // Start real-time connection based on environment
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

  // Continue chat after idle
  const handleContinueChat = () => {
    if (data.usePolling && ticketId) {
      startPolling();
    }
  };

  // Notify parent that widget is ready
  useEffect(() => {
    window.parent.postMessage({ type: "sw:ready" }, "*");
  }, []);

  const handleClose = () => {
    window.parent.postMessage({ type: "sw:close" }, "*");
  };

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form visibility is derived from visitorInfo state, so no need to explicitly hide it
  };

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text) return;

    // Reset idle timeout on user activity
    resetIdleTimeout();

    setInputValue("");

    // Add pending message
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

      // Create ticket if needed
      if (!currentTicketId) {
        messageFetcher.submit(
          {
            accountId: data.accountId!, // We checked this in loader
            visitorId: data.visitorId,
            message: text,
            email: visitorInfo.email,
            name: visitorInfo.name,
            metadata: data.metadata ? JSON.stringify(data.metadata) : "{}", // Ensure string for FormData/JSON
          },
          {
            method: "POST",
            action: "/api/tickets",
            encType: "application/json",
          }
        );
      } else {
        // Send message to existing ticket
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
      // Remove pending message on error
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      // Could show error toast here
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

  // Group messages by date
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

  if (showMissingInfoForm && !ticketId) {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Support</title>
        </head>
        <body>
          <div 
            className="widget-container"
            style={{ 
              "--primary-color": data.config.primaryColor, 
              "--accent-color": data.config.accentColor 
            } as React.CSSProperties}
          >
            <header className="widget-header">
              <h1>{data.config.companyName}</h1>
              <button
                className="close-button"
                onClick={handleClose}
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </header>

            <div className="form-container">
              <h2 className="form-title">Welcome! 👋</h2>
              <p className="form-subtitle">
                Please introduce yourself to start chatting.
              </p>
              <form onSubmit={handleInfoSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="name">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    className="form-input"
                    value={visitorInfo.name}
                    onChange={(e) =>
                      setVisitorInfo((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Your name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="form-input"
                    value={visitorInfo.email}
                    onChange={(e) =>
                      setVisitorInfo((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="name@example.com"
                    required
                  />
                </div>
                <button type="submit" className="submit-button">
                  Start Chat
                </button>
              </form>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Support</title>
      </head>
      <body>
        <div 
          className="widget-container"
          style={{ 
            "--primary-color": data.config.primaryColor, 
            "--accent-color": data.config.accentColor 
          } as React.CSSProperties}
        >
          <header className="widget-header">
            <div>
              <h1>{data.config.companyName}</h1>
              <div className="subtitle">
                We typically reply in a few minutes
              </div>
            </div>
            <button
              className="close-button"
              onClick={handleClose}
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </header>

          {ticketId && !isConnected && (
            <div
              className={`connection-status ${isConnected ? "" : "disconnected"}`}
            >
              Reconnecting...
            </div>
          )}

          <div className="messages-container">
            {messages.length === 0 && (
              <div className="greeting-message">
                <h2>👋 Hi there!</h2>
                <p>{data.config.greetingText}</p>
              </div>
            )}

            {groupedMessages.map((group, groupIdx) => (
              <div key={groupIdx}>
                <div className="date-divider">
                  <span>{group.date}</span>
                </div>
                {group.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message ${msg.source} ${msg.pending ? "pending" : ""}`}
                  >
                    <div className="message-avatar">
                      {msg.source === "visitor"
                        ? "Y"
                        : msg.slackUserName?.[0]?.toUpperCase() || "A"}
                    </div>
                    <div className="message-content">
                      <div className="message-bubble">{msg.text}</div>
                      <div className="message-meta">
                        {msg.source !== "visitor" && msg.slackUserName && (
                          <span className="message-sender">
                            {msg.slackUserName}
                          </span>
                        )}
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {isTyping && (
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {isIdle ? (
            <div className="idle-overlay">
              <p>Chat paused due to inactivity</p>
              <button className="continue-button" onClick={handleContinueChat}>
                Continue Chat
              </button>
            </div>
          ) : (
            <div className="composer">
              <div className="composer-input-wrapper">
                <textarea
                  className="composer-input"
                  placeholder="Send a message..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  className="send-button"
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || messageFetcher.state !== "idle"}
                  aria-label="Send message"
                >
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="powered-by">
            Powered by <a href="#">Support Widget</a>
          </div>
        </div>
      </body>
    </html>
  );
}
