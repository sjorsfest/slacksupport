import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { redirect } from 'react-router';
import { prisma } from "./db.server";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  account: {
    modelName: "AuthAccount",
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "twitter", "email-password"],
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    },
  },
  user: {
    additionalFields: {
      accountId: {
        type: "string",
        required: false,
      },
      role: {
        type: "string",
        required: true,
        defaultValue: "member",
      },
    },
  },
  /**
   * After-hook runs after endpoints execute.
   * We use it to ensure a user is linked to an Account (tenant) after OAuth callback.
   */
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Social login: session is created on the callback endpoint
      if (!ctx.path.startsWith("/callback/")) return;

      const newSession = ctx.context.newSession;
      if (!newSession) return;

      const userId = newSession.user.id;

      // Load full user record from Prisma
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, accountId: true, role: true },
      });

      if (!dbUser) return;
      if (dbUser.accountId) return; // already linked

      // Try to find existing account by email domain
      const domain = dbUser.email.split("@")[1]?.toLowerCase();
      let account = domain
        ? await prisma.account.findFirst({
            where: { allowedDomains: { has: domain } },
            select: { id: true },
          })
        : null;

      // If no matching tenant, create one
      if (!account) {
        const userName = dbUser.name || dbUser.email.split("@")[0] || "My Company";
        
        account = await prisma.account.create({
          data: {
            name: `${userName}'s Workspace`,
            allowedDomains: domain ? [domain] : [],
            widgetConfig: { create: { companyName: `${userName}'s Company` } },
          },
          select: { id: true },
        });

        await prisma.user.update({
          where: { id: dbUser.id },
          data: { accountId: account.id, role: "admin" },
        });

        console.log(`Created account for OAuth user: ${userId}`);
        return;
      }

      // Attach user to existing tenant
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { accountId: account.id, role: "member" },
      });
    }),
  },
});

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  accountId: string;
  role: string;
};

export async function getSession(request: Request) {
  return auth.api.getSession({
    headers: request.headers,
  });
}

export async function getCurrentUser(request: Request) {
  const session = await getSession(request);
  if (!session) return null;
  return session.user;
}

export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw redirect('/login');
  }
  
  if (!user.accountId || !user.role) {
    throw redirect('/login');
  }

  return user as SessionUser;
}
