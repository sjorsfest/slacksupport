import { useState, useEffect } from 'react';
import { useNavigate, useLoaderData, useFetcher } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { requireUser } from '~/lib/auth.server';
import { prisma } from '~/lib/db.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  
  const account = await prisma.account.findUnique({
    where: { id: user.accountId },
    include: {
      slackInstallation: true,
    },
  });

  const baseUrl = process.env.BASE_URL || 'http://localhost:5173';

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
      navigate('/integrations/slack');
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
    <div className="max-w-2xl mx-auto py-12 px-6">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-[#4A154B]/10 rounded-2xl mb-4">
          <svg className="w-8 h-8 text-[#4A154B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to Support Widget!</h1>
        <p className="text-gray-600 mt-2">Let's get your support widget set up in a few easy steps.</p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center justify-center mb-10">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-[#4A154B] text-white rounded-full flex items-center justify-center font-medium text-sm">1</div>
          <div className="ml-2 mr-8">
            <div className="text-sm font-medium text-gray-900">Configure Domains</div>
          </div>
        </div>
        <div className="w-8 h-px bg-gray-300"></div>
        <div className="flex items-center ml-8">
          <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center font-medium text-sm">2</div>
          <div className="ml-2 mr-8">
            <div className="text-sm font-medium text-gray-400">Connect Slack</div>
          </div>
        </div>
        <div className="w-8 h-px bg-gray-300"></div>
        <div className="flex items-center ml-8">
          <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center font-medium text-sm">3</div>
          <div className="ml-2">
            <div className="text-sm font-medium text-gray-400">Add Widget</div>
          </div>
        </div>
      </div>

      {/* Domain configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Allowed Domains</h2>
        <p className="text-gray-600 text-sm mb-6">
          Specify which domains are allowed to embed your support widget. This helps prevent unauthorized use.
        </p>

        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
            placeholder="example.com"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A154B] focus:border-transparent"
          />
          <button
            onClick={addDomain}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Add
          </button>
        </div>

        {domains.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-6">
            {domains.map((domain) => (
              <span
                key={domain}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm"
              >
                {domain}
                <button
                  onClick={() => removeDomain(domain)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500 text-sm mb-6">
            No domains added yet. Add domains where your widget will be embedded.
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate('/integrations/slack')}
            className="px-4 py-2.5 text-gray-600 font-medium hover:text-gray-800"
          >
            Skip for now
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-[#4A154B] text-white font-medium rounded-lg hover:bg-[#3D1141] transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

