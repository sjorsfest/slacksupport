import { redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const params = url.searchParams.toString();
  const suffix = params ? `?${params}` : '';

  return redirect(`/onboarding/connect${suffix}`);
}
