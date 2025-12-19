import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { subscribeToTicket, type TicketMessagePayload } from './redis.server';

// Map of ticketId -> Set of connected WebSocket clients
const ticketSubscribers = new Map<string, Set<WebSocket>>();

// Map of WebSocket -> ticketId (for cleanup)
const clientTickets = new Map<WebSocket, string>();

// Unsubscribe functions from Redis
const redisUnsubscribers = new Map<string, () => void>();

let wss: WebSocketServer | null = null;

/**
 * Initialize the WebSocket server.
 * Should be called once when the HTTP server starts.
 */
export function initializeWebSocketServer(server: Server): WebSocketServer {
  if (wss) {
    return wss;
  }

  wss = new WebSocketServer({ 
    server,
    path: '/ws',
  });

  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');

    // Parse ticket ID from URL query
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const ticketId = url.searchParams.get('ticketId');

    if (!ticketId) {
      ws.close(4000, 'Missing ticketId');
      return;
    }

    // Add client to ticket subscribers
    subscribeClientToTicket(ws, ticketId);

    // Handle messages from client
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        handleClientMessage(ws, ticketId, data);
      } catch (e) {
        console.error('Invalid WebSocket message:', e);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      unsubscribeClientFromTicket(ws);
    });

    // Send initial confirmation
    ws.send(JSON.stringify({ type: 'connected', ticketId }));
  });

  console.log('WebSocket server initialized');
  return wss;
}

/**
 * Subscribe a WebSocket client to a ticket.
 */
function subscribeClientToTicket(ws: WebSocket, ticketId: string): void {
  // Add to local subscribers
  if (!ticketSubscribers.has(ticketId)) {
    ticketSubscribers.set(ticketId, new Set());

    // Create Redis subscription for this ticket
    const unsubscribe = subscribeToTicket(ticketId, (message) => {
      broadcastToTicket(ticketId, message);
    });
    redisUnsubscribers.set(ticketId, unsubscribe);
  }

  ticketSubscribers.get(ticketId)!.add(ws);
  clientTickets.set(ws, ticketId);
}

/**
 * Unsubscribe a WebSocket client from its ticket.
 */
function unsubscribeClientFromTicket(ws: WebSocket): void {
  const ticketId = clientTickets.get(ws);
  if (!ticketId) return;

  const subscribers = ticketSubscribers.get(ticketId);
  if (subscribers) {
    subscribers.delete(ws);

    // If no more subscribers for this ticket, clean up
    if (subscribers.size === 0) {
      ticketSubscribers.delete(ticketId);

      // Unsubscribe from Redis
      const unsubscribe = redisUnsubscribers.get(ticketId);
      if (unsubscribe) {
        unsubscribe();
        redisUnsubscribers.delete(ticketId);
      }
    }
  }

  clientTickets.delete(ws);
}

/**
 * Broadcast a message to all subscribers of a ticket.
 */
function broadcastToTicket(ticketId: string, message: TicketMessagePayload): void {
  const subscribers = ticketSubscribers.get(ticketId);
  if (!subscribers) return;

  const payload = JSON.stringify({ type: 'message', data: message });

  for (const ws of subscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/**
 * Handle messages from WebSocket clients.
 */
function handleClientMessage(
  ws: WebSocket, 
  ticketId: string, 
  data: { type: string; [key: string]: unknown }
): void {
  switch (data.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
    case 'typing':
      // Could broadcast typing indicators to other subscribers
      // For now, just acknowledge
      break;
    default:
      console.log('Unknown message type:', data.type);
  }
}

/**
 * Send a message directly to all subscribers of a ticket.
 * Used when we want to bypass Redis pub/sub (e.g., for local testing).
 */
export function sendToTicketSubscribers(ticketId: string, message: TicketMessagePayload): void {
  broadcastToTicket(ticketId, message);
}

/**
 * Get the number of active connections for a ticket.
 */
export function getTicketConnectionCount(ticketId: string): number {
  return ticketSubscribers.get(ticketId)?.size || 0;
}

/**
 * Get total number of active WebSocket connections.
 */
export function getTotalConnectionCount(): number {
  return clientTickets.size;
}

/**
 * Close all connections and clean up.
 */
export function closeWebSocketServer(): void {
  if (wss) {
    for (const ws of clientTickets.keys()) {
      ws.close();
    }
    wss.close();
    wss = null;
  }
  ticketSubscribers.clear();
  clientTickets.clear();
  for (const unsubscribe of redisUnsubscribers.values()) {
    unsubscribe();
  }
  redisUnsubscribers.clear();
}

