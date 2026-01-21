import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { Toaster } from "./components/ui/toaster";

import type { Route } from "./+types/root";
import "./app.css";
import { SupportWidget } from "./components/SupportWidget";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
    <SupportWidget
      accountId="cmkmutu7o0000zalwjxgvg6jz"
      baseUrl="http://localhost:5173"
    />
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full rounded-3xl border border-border bg-card p-8 shadow-lg">
        <h1 className="font-display text-2xl text-white mb-2">{message}</h1>
        <p className="text-muted-foreground">{details}</p>
        {stack && (
          <pre className="w-full mt-4 p-4 rounded-xl bg-muted text-muted-foreground overflow-x-auto text-xs">
            <code>{stack}</code>
          </pre>
        )}
      </div>
    </main>
  );
}
