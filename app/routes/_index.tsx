import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { getCurrentUser } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getCurrentUser(request);
  if (user) {
    return redirect('/tickets');
  }
  // Redirect unauthenticated users to login instead of showing marketing page
  return redirect('/login');
}
