"use client";

import React, { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [accountName, setAccountName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2ECC71');
  const [accentColor, setAccentColor] = useState('#673AB7');
  const [timezone, setTimezone] = useState('');
  const [logoFileName, setLogoFileName] = useState('No file selected');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setIsLoading(false);
        return;
      }

      const token = session.access_token;

      // Load workspace data (name and logo_url)
      const workspaceResponse = await fetch('/api/workspace', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!workspaceResponse.ok) {
        const errorData = await workspaceResponse.json().catch(() => ({}));
        console.error('Failed to load workspace:', errorData);
        throw new Error(errorData.error || 'Failed to load workspace data');
      }

      const workspaceData = await workspaceResponse.json();
      if (workspaceData?.workspace) {
        const workspace = workspaceData.workspace;
        // Set account name (even if empty/null)
        setAccountName(workspace.name || '');
        setWorkspaceSlug(workspace.slug || '');
        
        // Set logo if it exists
        if (workspace.logo_url) {
          setLogoUrl(workspace.logo_url);
          // Extract filename from URL for display
          const urlParts = workspace.logo_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          setLogoFileName(fileName || 'No file selected');
        } else {
          // Reset logo if not present
          setLogoUrl(null);
          setLogoFileName('No file selected');
        }
      } else {
        console.warn('Workspace data not found in response:', workspaceData);
      }

      // Load colors from configurations table
      const settingsResponse = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (settingsResponse.ok) {
        const data = await settingsResponse.json();
        if (data?.settings) {
          const settings = data.settings;
          const general = settings.general || {};
          if (general.primaryColor) setPrimaryColor(general.primaryColor);
          if (general.accentColor) setAccentColor(general.accentColor);
          setTimezone(general.timezone || '');
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    setSaveMessage(null);

    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/settings/logo', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to upload logo');
      }

      const result = await response.json();
      setLogoFileName(file.name);
      setLogoUrl(result.url);
      setLogoPath(result.path);
      setSaveMessage({ type: 'success', text: 'Logo uploaded successfully.' });
      setTimeout(() => setSaveMessage(null), 2500);
    } catch (error) {
      console.error('Error uploading logo:', error);
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to upload logo. Please try again.',
      });
      setTimeout(() => setSaveMessage(null), 4000);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);
    setSaveMessage(null);

    const trimmedSlug = workspaceSlug.trim();
    if (!trimmedSlug) {
      setLinkError('Link is required');
      setSaveMessage({ type: 'error', text: 'Link is required.' });
      return;
    }

    setIsSaving(true);

    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Update workspace table with name and logo_url
      const workspaceResponse = await fetch('/api/workspace', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: accountName,
          slug: workspaceSlug.trim().toLowerCase() || undefined,
          logo_url: logoUrl,
        }),
      });

      if (!workspaceResponse.ok) {
        const result = await workspaceResponse.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to save workspace settings');
      }

      // Save other settings (colors, timezone) to configurations table
      const settingsData = {
        general: {
          primaryColor,
          accentColor,
          timezone: timezone.trim() || undefined,
        },
      };

      const settingsResponse = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ settings: settingsData }),
      });

      if (!settingsResponse.ok) {
        // Non-critical error - workspace is updated, just log it
        console.warn('Failed to save color settings:', await settingsResponse.json().catch(() => ({})));
      }

      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save settings. Please try again.',
      });
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="space-y-6 mr-auto">
        <div className="text-center py-8 text-slate-500">Loading settings...</div>
      </section>
    );
  }

  return (
    <section className="space-y-6 mr-auto">
      <header className="flex flex-wrap justify-between relative gap-3">
        <div className="text-sm text-slate-500">
          <h3 className="text-xl font-semibold text-slate-800">Settings</h3>
          <p className="text-xs text-slate-500">Manage your account and branding preferences.</p>
        </div>
      </header>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden">
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-6">
                {/* Account Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter account name"
                  />
                </div>

                {/* Workspace slug / My Link */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    My Link
                  </label>
                  <input
                    type="text"
                    value={workspaceSlug}
                    onChange={(e) => {
                      setWorkspaceSlug(e.target.value);
                      if (linkError) setLinkError(null);
                    }}
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      linkError ? 'border-red-500' : 'border-slate-300'
                    }`}
                    placeholder="Enter link"
                    required
                  />
                  {linkError && (
                    <p className="mt-1 text-sm text-red-600">{linkError}</p>
                  )}
                </div>

                {/* Primary Color */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Brand color (Primary)
                  </label>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-full h-12 rounded-lg border border-slate-300 cursor-pointer"
                      style={{ backgroundColor: primaryColor }}
                      onClick={() => document.getElementById('primary-color-input')?.click()}
                    />
                    <input
                      id="primary-color-input"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="sr-only"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-32 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="#2ECC71"
                    />
                  </div>
                </div>

                {/* Accent Color */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Accent color
                  </label>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-full h-12 rounded-lg border border-slate-300 cursor-pointer"
                      style={{ backgroundColor: accentColor }}
                      onClick={() => document.getElementById('accent-color-input')?.click()}
                    />
                    <input
                      id="accent-color-input"
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="sr-only"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-32 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="#673AB7"
                    />
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Timezone
                  </label>
                  <input
                    type="text"
                    list="timezone-options"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. Asia/Kolkata (leave empty to use visitor's timezone)"
                  />
                  <datalist id="timezone-options">
                    <option value="Asia/Kolkata" />
                    <option value="America/New_York" />
                    <option value="America/Los_Angeles" />
                    <option value="America/Chicago" />
                    <option value="Europe/London" />
                    <option value="Europe/Paris" />
                    <option value="Asia/Dubai" />
                    <option value="Asia/Singapore" />
                    <option value="Australia/Sydney" />
                    <option value="UTC" />
                  </datalist>
                  <p className="mt-1 text-xs text-slate-500">
                    Used for booking times in sidebar, emails, and API. IANA format (e.g. Asia/Kolkata).
                  </p>
                </div>

                {/* Logo Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Logo
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      readOnly
                      value={logoFileName}
                      className="flex-1 px-4 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none"
                    />
                    <label className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
                      {isUploadingLogo ? 'Uploading...' : 'Browse...'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        disabled={isUploadingLogo}
                        className="sr-only"
                      />
                    </label>
                  </div>
                  {logoUrl && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoUrl} alt="Logo preview" className="w-full h-full object-contain" />
                      </div>
                      <span className="text-xs text-slate-500">{logoPath}</span>
                    </div>
                  )}
                </div>
              </div>

              {saveMessage && (
                <div
                  className={`p-3 rounded-lg text-sm font-medium ${
                    saveMessage.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {saveMessage.text}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  className="px-6 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors ${
                    isSaving ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
        </div>
      </div>
    </section>
  );
}
