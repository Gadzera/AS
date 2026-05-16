'use client';

import { useEffect, useState } from 'react';
import { authApi, billingApi } from '@/lib/api';
import type { User } from '@/types';
import Topbar from '@/components/layout/Topbar';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

const PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: '$49/mo',
    leads: '500 leads',
    features: ['500 leads', '3 active campaigns', 'Email outreach', 'AI message generation'],
  },
  {
    id: 'GROWTH',
    name: 'Growth',
    price: '$149/mo',
    leads: '2,000 leads',
    features: ['2,000 leads', '10 campaigns', 'Email + LinkedIn', 'Apollo.io integration', 'Priority support'],
  },
  {
    id: 'AGENCY',
    name: 'Agency',
    price: '$399/mo',
    leads: '10,000 leads',
    features: ['10,000 leads', 'Unlimited campaigns', 'All channels', 'White-label options', 'Dedicated support'],
  },
];

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<{
    plan: string;
    status: string;
    currentPeriodEnd?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([authApi.me(), billingApi.subscription()])
      .then(([u, sub]) => {
        setUser(u);
        setSubscription(sub as typeof subscription);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCheckout = async (plan: string) => {
    setCheckoutLoading(plan);
    try {
      const { url } = await billingApi.checkout(plan);
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    try {
      const { url } = await billingApi.portal();
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <Topbar title="Settings" />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl space-y-6">
          {/* Account */}
          <Card padding="md">
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="skeleton h-4 rounded w-48" />
                <div className="skeleton h-4 rounded w-64" />
              </div>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Name</dt>
                  <dd className="font-medium text-white">{user?.name}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Email</dt>
                  <dd className="font-medium text-white">{user?.email}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Organization</dt>
                  <dd className="font-medium text-white">{user?.org?.name}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Role</dt>
                  <dd className="font-medium text-white">{user?.role}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Current plan</dt>
                  <dd className="font-medium text-white">{user?.org?.plan}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Leads limit</dt>
                  <dd className="font-medium text-white">{user?.org?.leadsLimit?.toLocaleString()}</dd>
                </div>
              </dl>
            )}
          </Card>

          {/* Subscription */}
          <Card padding="md">
            <CardHeader>
              <CardTitle>Billing & Subscription</CardTitle>
              {subscription?.status === 'active' && (
                <Button size="sm" variant="secondary" onClick={handlePortal}>
                  Manage Billing
                </Button>
              )}
            </CardHeader>

            {subscription && (
              <div className="mb-6 p-4 bg-gray-800/40 rounded-lg text-sm">
                <p>
                  <span className="text-gray-500">Status:</span>{' '}
                  <span className="font-medium capitalize">{subscription.status}</span>
                </p>
                {subscription.currentPeriodEnd && (
                  <p className="mt-1">
                    <span className="text-gray-500">Renews:</span>{' '}
                    <span className="font-medium">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PLANS.map((plan) => {
                const isCurrent = user?.org?.plan === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`border-2 rounded-xl p-4 ${
                      isCurrent ? 'border-brand-500/60 bg-brand-500/10' : 'border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-white">{plan.name}</h3>
                      {isCurrent && (
                        <span className="text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">{plan.price}</p>
                    <ul className="text-xs text-gray-500 space-y-1 mb-4">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      variant={isCurrent ? 'secondary' : 'primary'}
                      className="w-full"
                      disabled={isCurrent}
                      loading={checkoutLoading === plan.id}
                      onClick={() => handleCheckout(plan.id)}
                    >
                      {isCurrent ? 'Current plan' : 'Upgrade'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* API Keys Info */}
          <Card padding="md">
            <CardHeader>
              <CardTitle>API Integrations</CardTitle>
            </CardHeader>
            <p className="text-sm text-gray-500 mb-4">
              API keys are configured via environment variables on the server. Contact your admin to update them.
            </p>
            <div className="space-y-3">
              {[
                { name: 'Claude AI (Anthropic)', key: 'ANTHROPIC_API_KEY', required: true },
                { name: 'Apollo.io', key: 'APOLLO_API_KEY', required: false },
                { name: 'Unipile (LinkedIn)', key: 'UNIPILE_API_KEY', required: false },
                { name: 'Stripe', key: 'STRIPE_SECRET_KEY', required: false },
                { name: 'SMTP Email', key: 'SMTP_HOST', required: false },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{item.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{item.key}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      item.required
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {item.required ? 'Required' : 'Optional'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
