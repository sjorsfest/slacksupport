import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const params = url.searchParams.toString();
  const suffix = params ? `?${params}` : "";

  return redirect(`/onboarding/settings${suffix}`);
}

export default function OnboardingDomainsRedirect() {
  return null;
}
