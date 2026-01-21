import { useState, useEffect } from 'react';
import { useNavigate, useLoaderData, useFetcher, redirect } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';
import { settings } from '~/lib/settings.server';
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  // Check for active subscription
  const subscription = await prisma.subscription.findUnique({
    where: { accountId: user.accountId },
  });

  if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
    return redirect('/onboarding/subscription');
  }

  const account = await prisma.account.findUnique({
    where: { id: user.accountId },
    include: {
      slackInstallation: true,
    },
  });

  const baseUrl = settings.BASE_URL;

  return { user, account, baseUrl };
}

export default function Onboarding() {
  const { account, baseUrl } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [domains, setDomains] = useState<string[]>(account?.allowedDomains || []);
  const [newDomain, setNewDomain] = useState('');
  const fetcher = useFetcher();

  const isSaving = fetcher.state !== 'idle';

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      navigate('/onboarding/connect');
    }
  }, [fetcher.state, fetcher.data, navigate]);

  const addDomain = () => {
    const domain = newDomain.trim().toLowerCase();
    if (domain && !domains.includes(domain)) {
      setDomains([...domains, domain]);
      setNewDomain('');
    }
  };

  const removeDomain = (domain: string) => {
    setDomains(domains.filter((d) => d !== domain));
  };

  const handleSave = () => {
    fetcher.submit(
      { domains },
      {
        method: 'PUT',
        action: '/api/account/allowed-domains',
        encType: 'application/json',
      }
    );
  };

  return (
    <div className="max-w-3xl mx-auto py-7 px-6">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-secondary-500/10 rounded-full mb-4">
          <img src="/static/donkey.png" alt="Logo" className="w-12 h-12" />
        </div>
        <h1 className="font-display text-3xl text-secondary-400">Welcome aboard</h1>
        <p className="text-slate-600 mt-2">
          Set the guardrails that keep your widget secure.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
        <Badge variant="muted" className="rounded-full px-4 py-1">0 · Plan</Badge>
        <Badge className="bg-primary text-primary-foreground">1 · Domains</Badge>
        <Badge variant="muted" className="rounded-full px-4 py-1">2 · Connect</Badge>
        <Badge variant="muted" className="rounded-full px-4 py-1">3 · Embed</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Allowed Domains</CardTitle>
          <CardDescription>
            Specify which sites are permitted to embed your widget.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
              placeholder="example.com"
            />
            <Button variant="secondary" onClick={addDomain}>
              Add
            </Button>
          </div>

          {domains.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-6">
              {domains.map((domain) => (
                <Badge
                  key={domain}
                  variant="muted"
                  className="gap-2 rounded-xl"
                >
                  {domain}
                  <button
                    onClick={() => removeDomain(domain)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500 text-sm mb-6">
              No domains added yet. Add domains where your widget will be embedded.
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate('/onboarding/connect')}
            >
              Skip for now
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Continue'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
