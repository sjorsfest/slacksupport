import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
  // Redirect back to upgrade selection with canceled flag
  return redirect('/upgrade?canceled=true');
}

export default function CheckoutCancel() {
  // This should never render since loader always redirects
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-slate-600">Redirecting...</p>
    </div>
  );
}
