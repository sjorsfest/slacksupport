import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "~/lib/db.server";

/**
 * GET /widget/config.json?accountId=xxx
 * Returns the widget configuration (colors) for the chat button.
 * This is called by the loader script to style the button immediately.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");

  if (!accountId) {
    return Response.json(
      { error: "Missing accountId" },
      { status: 400 }
    );
  }

  const widgetConfig = await prisma.widgetConfig.findUnique({
    where: { accountId },
    select: {
      primaryColor: true,
      accentColor: true,
    },
  });

  if (!widgetConfig) {
    return Response.json(
      { error: "Widget not configured" },
      { status: 404 }
    );
  }

  return Response.json(
    {
      primaryColor: widgetConfig.primaryColor,
      accentColor: widgetConfig.accentColor,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
