"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";

interface IntegrationStatus {
  google_calendar: boolean;
  zoom: boolean;
  google_calendar_email?: string;
}

function IntegrationsContent() {
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationStatus>({
    google_calendar: false,
    zoom: false,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState<'google_calendar' | 'zoom' | null>(null);

  useEffect(() => {
    fetchIntegrations();
    
    // Check for success/error messages from OAuth callbacks
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const errorMessage = searchParams.get('message');
    
    if (success) {
      setMessage({ type: 'success', text: getSuccessMessage(success) });
      fetchIntegrations();
    } else if (error) {
      const message = errorMessage 
        ? `${getErrorMessage(error)}: ${decodeURIComponent(errorMessage)}`
        : getErrorMessage(error);
      setMessage({ type: 'error', text: message });
    }
  }, [searchParams]);

  const fetchIntegrations = async () => {
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/integrations/status', {
        headers: token ? {
          'Authorization': `Bearer ${token}`,
        } : {},
      });
      if (response.ok) {
        const data = await response.json();
        setIntegrations({
          google_calendar: false,
          zoom: false,
          ...data.integrations,
        });
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (type: 'google' | 'zoom') => {
    setActionLoading(type);
    setMessage(null);
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/integrations/${type}/connect`, {
        headers: token ? {
          'Authorization': `Bearer ${token}`,
        } : {},
      });
      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else if (data.success) {
          setMessage({ type: 'success', text: `${type} connected successfully!` });
          await fetchIntegrations();
        } else {
          setMessage({ type: 'error', text: 'Failed to get authorization URL' });
        }
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to connect' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to connect' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnectClick = (type: 'google_calendar' | 'zoom') => {
    setDisconnectConfirm(type);
  };

  const handleDisconnectConfirm = async () => {
    if (!disconnectConfirm) return;

    const type = disconnectConfirm;
    setActionLoading(type);
    setMessage(null);
    setDisconnectConfirm(null);

    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `${type} disconnected successfully` });
        await fetchIntegrations();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to disconnect' });
      }
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to disconnect' });
    } finally {
      setActionLoading(null);
    }
  };

  const getSuccessMessage = (success: string) => {
    const messages: Record<string, string> = {
      google_connected: 'Google Calendar connected successfully!',
      zoom_connected: 'Zoom connected successfully!',
    };
    return messages[success] || 'Connection successful!';
  };

  const getErrorMessage = (error: string) => {
    const messages: Record<string, string> = {
      missing_params: 'Missing required parameters',
      no_token: 'Failed to get access token',
      save_failed: 'Failed to save integration',
      callback_failed: 'OAuth callback failed',
      config_missing: 'Integration not configured',
      no_workspace: 'No workspace found. Please complete onboarding first.',
      unauthorized: 'Unauthorized. Please log in and try again.',
      oauth_error: 'OAuth authorization error. Please check your Google Cloud Console settings.',
      redirect_uri_mismatch: 'Redirect URI mismatch. Please ensure the redirect URI in Google Cloud Console matches your application URL.',
    };
    return messages[error] || 'An error occurred';
  };

  const items = [
    {
      id: 'google_calendar',
      name: "Google Calendar",
      desc: "Add Events to your Calender and prevent Double Booking",
      connected: integrations.google_calendar,
      connectType: 'google' as const,
    },
    {
      id: 'zoom',
      name: "Zoom Information",
      desc: "Includes Zoom details in your Getsettime App",
      connected: integrations.zoom,
      connectType: 'zoom' as const,
    },
  ];

  return (
    <section className="space-y-6 mr-auto">
        <header className="flex flex-wrap justify-between relative gap-3">
            <div className="text-sm text-slate-500">
                <h3 className="text-xl font-semibold text-slate-800">Integrations</h3>
                <p className="text-xs text-slate-500">Automate scheduling with real-time sync to your favorite apps.</p>
            </div>
        </header>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-500">Loading integrations...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((it) => (
            <div key={it.id} className={`p-5 rounded-2xl border border-slate-100 bg-white shadow-md hover:shadow-lg transition-transform hover:-translate-y-1`}>
              <div className={`font-medium text-slate-800`}>{it.name}</div>
              <div className={`text-sm mt-1 text-slate-500`}>{it.desc}</div>
              <div className="mt-4 flex items-center justify-between">
                <span className={`text-xs font-medium ${ it.connected ? "text-emerald-600" : "text-slate-400" }`}>
                  {it.connected
                    ? (it.id === 'google_calendar' && integrations.google_calendar_email
                      ? `Connected (${integrations.google_calendar_email})`
                      : "Connected")
                    : "Not connected"}
                </span>
                <button 
                  onClick={() => it.connected ? handleDisconnectClick(it.id as 'google_calendar' | 'zoom') : handleConnect(it.connectType)}
                  disabled={actionLoading !== null}
                  className={`px-3 py-1 text-sm font-medium rounded-xl transition ${
                    it.connected 
                      ? "border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50" 
                      : "bg-indigo-600 text-white hover:bg-indigo-800 disabled:opacity-50"
                  }`}
                >
                  {actionLoading === it.id || actionLoading === it.connectType ? 'Loading...' : (it.connected ? "Disconnect" : "Connect")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {disconnectConfirm && (
        <ConfirmModal
          title="Disconnect Integration"
          message={`Are you sure you want to disconnect ${disconnectConfirm.replace('_', ' ')}?`}
          confirmLabel="Disconnect"
          variant="danger"
          onConfirm={handleDisconnectConfirm}
          onCancel={() => setDisconnectConfirm(null)}
        />
      )}
    </section>
  );
}

export default function Integrations() {
  return (
    <Suspense fallback={<div className="text-center py-8 text-slate-500">Loading...</div>}>
      <IntegrationsContent />
    </Suspense>
  );
}
