import { useEffect, useRef, useState, useCallback } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { prisma } from "~/lib/db.server";

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

  const baseUrl = process.env.BASE_URL || "http://localhost:5173";

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
    baseUrl,
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [visitorInfo, setVisitorInfo] = useState({
    name: data.name || "",
    email: data.email || "",
  });
  const [showMissingInfoForm, setShowMissingInfoForm] = useState(
    !data.name || !data.email
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (!ticketId) return;

    const wsUrl = `${data.baseUrl.replace("http", "ws")}/ws?ticketId=${ticketId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message" && data.data) {
          const newMessage: Message = {
            id: data.data.messageId,
            source: data.data.source,
            text: data.data.text,
            createdAt: data.data.createdAt,
            slackUserName: data.data.slackUserName,
          };
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
          // Notify parent of new message
          window.parent.postMessage({ type: "sw:newMessage" }, "*");
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket disconnected, reconnecting...");
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    wsRef.current = ws;
  }, [ticketId, data.baseUrl]);

  useEffect(() => {
    if (ticketId) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [ticketId, connectWebSocket]);

  // Notify parent that widget is ready
  useEffect(() => {
    window.parent.postMessage({ type: "sw:ready" }, "*");
  }, []);

  const handleClose = () => {
    window.parent.postMessage({ type: "sw:close" }, "*");
  };

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (visitorInfo.name && visitorInfo.email) {
      setShowMissingInfoForm(false);
    }
  };

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text) return;

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
        const response = await fetch(`${data.baseUrl}/api/tickets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: data.accountId,
            visitorId: data.visitorId,
            message: text,
            email: visitorInfo.email,
            name: visitorInfo.name,
            metadata: data.metadata || {},
          }),
        });

        if (!response.ok) throw new Error("Failed to create ticket");

        const result = await response.json();
        currentTicketId = result.ticketId;
        setTicketId(currentTicketId);

        // Update pending message with real ID
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, id: result.messageId, pending: false }
              : m
          )
        );
      } else {
        // Send message to existing ticket
        const response = await fetch(
          `${data.baseUrl}/api/tickets/${currentTicketId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, source: "visitor" }),
          }
        );

        if (!response.ok) throw new Error("Failed to send message");

        const result = await response.json();

        // Update pending message with real ID
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, id: result.messageId, pending: false }
              : m
          )
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
          <style
            dangerouslySetInnerHTML={{
              __html: `
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            
            html, body, #root {
              height: 100%;
              overflow: hidden;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              font-size: 15px;
              line-height: 1.4;
              color: #1D1C1D;
              background: #fff;
            }
            
            .widget-container {
              display: flex;
              flex-direction: column;
              height: 100%;
            }
            
            .widget-header {
              background: linear-gradient(135deg, ${data.config.primaryColor} 0%, ${data.config.primaryColor}dd 100%);
              color: white;
              padding: 16px 20px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              flex-shrink: 0;
            }
            
            .widget-header h1 {
              font-size: 17px;
              font-weight: 600;
              margin: 0;
            }
            
            .close-button {
              background: rgba(255, 255, 255, 0.2);
              border: none;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: background 0.15s ease;
            }
            
            .close-button:hover {
              background: rgba(255, 255, 255, 0.3);
            }
            
            .close-button svg {
              width: 18px;
              height: 18px;
              fill: white;
            }

            .form-container {
              padding: 24px;
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }

            .form-title {
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 8px;
              text-align: center;
            }

            .form-subtitle {
              font-size: 14px;
              color: #616061;
              margin-bottom: 24px;
              text-align: center;
            }

            .form-group {
              margin-bottom: 16px;
            }

            .form-label {
              display: block;
              font-size: 13px;
              font-weight: 500;
              margin-bottom: 6px;
              color: #1D1C1D;
            }

            .form-input {
              width: 100%;
              padding: 10px 12px;
              border: 1px solid #E8E8E8;
              border-radius: 8px;
              font-size: 15px;
              transition: border-color 0.15s ease;
            }

            .form-input:focus {
              outline: none;
              border-color: ${data.config.accentColor};
            }

            .submit-button {
              width: 100%;
              padding: 12px;
              background: ${data.config.accentColor};
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 15px;
              font-weight: 600;
              cursor: pointer;
              transition: opacity 0.15s ease;
              margin-top: 8px;
            }

            .submit-button:hover {
              opacity: 0.9;
            }

            .submit-button:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
          `,
            }}
          />
        </head>
        <body>
          <div className="widget-container">
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
        <style
          dangerouslySetInnerHTML={{
            __html: `
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          html, body, #root {
            height: 100%;
            overflow: hidden;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 15px;
            line-height: 1.4;
            color: #1D1C1D;
            background: #fff;
          }
          
          .widget-container {
            display: flex;
            flex-direction: column;
            height: 100%;
          }
          
          .widget-header {
            background: linear-gradient(135deg, ${data.config.primaryColor} 0%, ${data.config.primaryColor}dd 100%);
            color: white;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
          }
          
          .widget-header h1 {
            font-size: 17px;
            font-weight: 600;
            margin: 0;
          }
          
          .widget-header .subtitle {
            font-size: 13px;
            opacity: 0.85;
            margin-top: 2px;
          }
          
          .close-button {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.15s ease;
          }
          
          .close-button:hover {
            background: rgba(255, 255, 255, 0.3);
          }
          
          .close-button svg {
            width: 18px;
            height: 18px;
            fill: white;
          }
          
          .messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 16px 20px;
            background: #F8F8F8;
          }
          
          .date-divider {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 16px 0;
          }
          
          .date-divider span {
            background: #E8E8E8;
            color: #616061;
            font-size: 12px;
            font-weight: 500;
            padding: 4px 12px;
            border-radius: 12px;
          }
          
          .message {
            display: flex;
            margin-bottom: 8px;
            animation: messageIn 0.2s ease-out;
          }
          
          @keyframes messageIn {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .message.visitor {
            flex-direction: row-reverse;
          }
          
          .message-avatar {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            background: ${data.config.accentColor};
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 600;
            flex-shrink: 0;
          }
          
          .message.visitor .message-avatar {
            background: #8E8E8E;
          }
          
          .message-content {
            max-width: 75%;
            margin: 0 10px;
          }
          
          .message-bubble {
            padding: 10px 14px;
            border-radius: 18px;
            word-wrap: break-word;
          }
          
          .message.visitor .message-bubble {
            background: ${data.config.accentColor};
            color: white;
            border-bottom-right-radius: 4px;
          }
          
          .message.agent .message-bubble,
          .message.slack .message-bubble,
          .message.agent_dashboard .message-bubble {
            background: #fff;
            border: 1px solid #E8E8E8;
            border-bottom-left-radius: 4px;
          }
          
          .message-meta {
            font-size: 11px;
            color: #616061;
            margin-top: 4px;
            padding: 0 4px;
          }
          
          .message.visitor .message-meta {
            text-align: right;
          }
          
          .message.pending .message-bubble {
            opacity: 0.7;
          }
          
          .message-sender {
            font-weight: 600;
            margin-right: 6px;
          }
          
          .typing-indicator {
            display: flex;
            align-items: center;
            padding: 10px 14px;
            background: #fff;
            border: 1px solid #E8E8E8;
            border-radius: 18px;
            border-bottom-left-radius: 4px;
            width: fit-content;
            margin-left: 42px;
          }
          
          .typing-indicator span {
            width: 8px;
            height: 8px;
            background: #B0B0B0;
            border-radius: 50%;
            margin: 0 2px;
            animation: typing 1.4s infinite;
          }
          
          .typing-indicator span:nth-child(2) {
            animation-delay: 0.2s;
          }
          
          .typing-indicator span:nth-child(3) {
            animation-delay: 0.4s;
          }
          
          @keyframes typing {
            0%, 60%, 100% {
              transform: translateY(0);
              opacity: 0.4;
            }
            30% {
              transform: translateY(-4px);
              opacity: 1;
            }
          }
          
          .greeting-message {
            text-align: center;
            padding: 24px 16px;
            color: #616061;
          }
          
          .greeting-message h2 {
            color: #1D1C1D;
            font-size: 18px;
            margin-bottom: 8px;
          }
          
          .composer {
            padding: 12px 16px 16px;
            background: #fff;
            border-top: 1px solid #E8E8E8;
            flex-shrink: 0;
          }
          
          .composer-input-wrapper {
            display: flex;
            align-items: flex-end;
            background: #F8F8F8;
            border: 1px solid #E8E8E8;
            border-radius: 12px;
            padding: 8px 12px;
            transition: border-color 0.15s ease;
          }
          
          .composer-input-wrapper:focus-within {
            border-color: ${data.config.accentColor};
          }
          
          .composer-input {
            flex: 1;
            border: none;
            background: transparent;
            font-size: 15px;
            font-family: inherit;
            resize: none;
            outline: none;
            max-height: 120px;
            min-height: 24px;
          }
          
          .composer-input::placeholder {
            color: #9E9E9E;
          }
          
          .send-button {
            background: ${data.config.accentColor};
            border: none;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.15s ease, opacity 0.15s ease;
            margin-left: 8px;
            flex-shrink: 0;
          }
          
          .send-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .send-button:not(:disabled):hover {
            transform: scale(1.05);
          }
          
          .send-button svg {
            width: 18px;
            height: 18px;
            fill: white;
          }
          
          .powered-by {
            text-align: center;
            padding: 8px;
            font-size: 11px;
            color: #9E9E9E;
            background: #fff;
          }
          
          .powered-by a {
            color: #616061;
            text-decoration: none;
          }
          
          .powered-by a:hover {
            text-decoration: underline;
          }
          
          .connection-status {
            position: absolute;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
            background: #FFF3CD;
            color: #856404;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            opacity: 0;
            transition: opacity 0.2s ease;
          }
          
          .connection-status.disconnected {
            opacity: 1;
          }
        `,
          }}
        />
      </head>
      <body>
        <div className="widget-container">
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
                disabled={!inputValue.trim()}
                aria-label="Send message"
              >
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="powered-by">
            Powered by <a href="#">Support Widget</a>
          </div>
        </div>
      </body>
    </html>
  );
}
