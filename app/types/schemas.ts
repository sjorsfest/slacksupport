import { z } from 'zod';

// Auth schemas
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  companyName: z.string().min(1, 'Company name is required'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Account schemas
export const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  allowedDomains: z.array(z.string()).optional(),
});

export const updateAllowedDomainsSchema = z.object({
  domains: z.array(z.string()),
});

// Widget config schemas
export const updateWidgetConfigSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  greetingText: z.string().max(500).optional(),
  companyName: z.string().max(100).optional(),
  officeHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  officeHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  officeHoursTimezone: z.string().optional().nullable(),
});

// Ticket schemas
export const createTicketSchema = z.object({
  accountId: z.string(),
  visitorId: z.string(),
  message: z.string().min(1, 'Message is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
});

export const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  subject: z.string().optional(),
  assignedUserId: z.string().cuid().optional().nullable(),
});

export const createMessageSchema = z.object({
  text: z.string().min(1, 'Message is required'),
  source: z.enum(['visitor', 'agent_dashboard']).default('visitor'),
});

// Webhook schemas
export const createWebhookSchema = z.object({
  url: z.string().url('Invalid URL'),
});

export const updateWebhookSchema = z.object({
  url: z.string().url('Invalid URL').optional(),
  enabled: z.boolean().optional(),
});

// Slack schemas
export const selectChannelSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
  channelName: z.string().min(1, 'Channel name is required'),
});

// Widget visitor identification
export const visitorIdentifySchema = z.object({
  anonymousId: z.string().min(1),
  email: z.string().email().optional(),
  name: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Ticket filters schema
export const ticketFiltersSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  search: z.string().optional(),
}).merge(paginationSchema);

// Type exports
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type UpdateWidgetConfigInput = z.infer<typeof updateWidgetConfigSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
export type SelectChannelInput = z.infer<typeof selectChannelSchema>;
export type VisitorIdentifyInput = z.infer<typeof visitorIdentifySchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type TicketFiltersInput = z.infer<typeof ticketFiltersSchema>;

