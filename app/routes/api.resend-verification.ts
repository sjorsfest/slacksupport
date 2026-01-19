import type { ActionFunctionArgs } from "react-router";
import { auth, getCurrentUser } from "~/lib/auth.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await getCurrentUser(request);

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await auth.api.sendVerificationEmail({
      body: {
        email: user.email,
        callbackURL: "/verify-email/success",
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to resend verification email:", error);
    return Response.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }
}
