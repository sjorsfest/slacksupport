import type { LoaderFunctionArgs } from 'react-router';
import { getCurrentUser } from '~/lib/auth.server';
import { redirect } from 'react-router';
import {
  Navbar,
  Hero,
  TrustedBy,
  ProblemSolution,
  Features,
  HowItWorks,
  WidgetShowcase,
  Pricing,
  FAQ,
  Footer,
} from '~/components/landing';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getCurrentUser(request);
  if (user) {
    return redirect('/tickets');
  }
  return null;
}

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <TrustedBy />
        <ProblemSolution />
        <Features />
        <HowItWorks />
        <WidgetShowcase />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
