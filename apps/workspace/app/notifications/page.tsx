"use client";
import { useState, useEffect } from "react";
import { FcFeedback, FcClock, FcPhone, FcOk, FcSettings, FcAutomotive, FcBusinessman, FcBusinesswoman } from "react-icons/fc";
import { IconType } from "react-icons";
import { useAuth } from "@/src/providers/AuthProvider";

interface Workflow {
  id: number;
  name: string;
  description: string;
  active: boolean;
  iconIndex?: number;
  settingsKey?: string;
}

// Map workflow settings keys to display data
const WORKFLOW_DEFINITIONS = [
  { settingsKey: "email-reminder", name: "24h reminder email", description: "Reminder email sent 24 hours before meeting", iconIndex: 0 },
  { settingsKey: "sms-reminder", name: "SMS 1h before", description: "SMS notification 1 hour prior", iconIndex: 1 },
  { settingsKey: "post-meeting-follow-up", name: "Post-meeting follow-up", description: "Send thank you email after meeting", iconIndex: 2 },
  { settingsKey: "auto-confirm-booking", name: "Auto-confirm bookings", description: "Automatically confirm new bookings without manual approval", iconIndex: 3 },
];

export default function Workflows({ dark = false }) {
  const { user } = useAuth();
  const [flows, setFlows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  // Load notification settings from Supabase on mount
  useEffect(() => {
    const loadSettings = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c18ea6a2-9a56-4a40-8939-326a1784f350',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:35',message:'loadSettings started',data:{hasUser:!!user},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c18ea6a2-9a56-4a40-8939-326a1784f350',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:46',message:'Session retrieved',data:{hasSession:!!session,hasToken:!!session?.access_token,workspaceId:user?.user_metadata?.workspace_id},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion

        if (!session?.access_token) {
          setLoading(false);
          return;
        }

        const response = await fetch('/api/settings', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          const notificationSettings = result.settings?.notifications || {};
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/c18ea6a2-9a56-4a40-8939-326a1784f350',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:67',message:'Settings loaded',data:{notificationSettings,fullSettings:result.settings},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion

          // Map notification settings to workflows
          const loadedFlows: Workflow[] = WORKFLOW_DEFINITIONS.map((def, index) => ({
            id: index + 1,
            name: def.name,
            description: def.description,
            active: notificationSettings[def.settingsKey] ?? true, // Default to true if not set
            iconIndex: def.iconIndex,
            settingsKey: def.settingsKey,
          }));

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/c18ea6a2-9a56-4a40-8939-326a1784f350',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:81',message:'Flows mapped',data:{loadedFlows},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H4'})}).catch(()=>{});
          // #endregion

          setFlows(loadedFlows);
        }
      } catch (error) {
        console.error('Error loading notification settings:', error);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c18ea6a2-9a56-4a40-8939-326a1784f350',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:91',message:'Load error',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        // Initialize with defaults on error
        const defaultFlows: Workflow[] = WORKFLOW_DEFINITIONS.map((def, index) => ({
          id: index + 1,
          name: def.name,
          description: def.description,
          active: true,
          iconIndex: def.iconIndex,
          settingsKey: def.settingsKey,
        }));
        setFlows(defaultFlows);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // Save notification settings to Supabase
  const saveNotificationSettings = async (updatedFlows: Workflow[]) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c18ea6a2-9a56-4a40-8939-326a1784f350',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:118',message:'saveNotificationSettings called',data:{flowsCount:updatedFlows.length,hasUser:!!user},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    if (!user) return;

    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      // Convert flows to notification settings format
      const notificationSettings: Record<string, boolean> = {};
      updatedFlows.forEach(flow => {
        if (flow.settingsKey) {
          notificationSettings[flow.settingsKey] = flow.active;
        }
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c18ea6a2-9a56-4a40-8939-326a1784f350',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:138',message:'Notification settings prepared',data:{notificationSettings},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: {
            notifications: notificationSettings,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save notification settings');
      }

      const result = await response.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c18ea6a2-9a56-4a40-8939-326a1784f350',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:162',message:'Settings saved successfully',data:{savedSettings:result.settings},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      console.error('Error saving notification settings:', error);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c18ea6a2-9a56-4a40-8939-326a1784f350',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:169',message:'Save error',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
    }
  };

  const toggleFlow = async (id: number) => {
    const updatedFlows = flows.map(f => (f.id === id ? { ...f, active: !f.active } : f));
    setFlows(updatedFlows);
    await saveNotificationSettings(updatedFlows);
  };

  // Icon mapping for workflows - cycles through different icons
  const workflowIcons: IconType[] = [
    FcFeedback,
    FcClock,
    FcPhone,
    FcOk,
    FcSettings,
    FcAutomotive,
    FcBusinessman,
    FcBusinesswoman,
  ];

  const getWorkflowIcon = (flow: Workflow): IconType => {
    const iconIndex = flow.iconIndex ?? ((flow.id - 1) % workflowIcons.length);
    return workflowIcons[iconIndex];
  };

  if (loading) {
    return (
      <section className="space-y-6 rounded-xl mr-auto">
        <div className="text-center py-10">
          <p className="text-slate-500">Loading notification settings...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-xl mr-auto">
      <header className="flex flex-wrap justify-between relative gap-3">
        <div className="text-sm text-slate-500">
          <h3 className={`text-xl font-semibold ${dark ? "text-white" : "text-slate-800"}`}>Notifications</h3>
          <p className={`text-xs ${dark ? "text-white/70" : "text-slate-500"}`}>Automate your booking workflows with email and SMS notifications.</p>
        </div>
      </header>

      {/* Workflows List */}
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map((flow) => {
            const IconComponent = getWorkflowIcon(flow);
            return (
            <div key={flow.id} className={`flex items-center gap-3 px-4 py-5 rounded-xl border border-slate-200 bg-white/70 text-slate-700 shadow-md hover:shadow-lg transition-transform hover:-translate-y-1`}>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center flex-shrink-0">
                <IconComponent className="w-6 h-6" />
              </div>

              <div className="flex-1 min-w-0">
                <div className={`font-medium ${dark ? "text-white" : "text-slate-800"}`}>{flow.name}</div>
                <div className={`text-xs ${dark ? "text-white/70" : "text-slate-500"}`}>{flow.description || "No description"}</div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleFlow(flow.id)} className={`relative w-10 h-5 rounded-full p-1 transition-colors duration-200 ${ flow.active ? "bg-emerald-500" : dark ? "bg-slate-600" : "bg-slate-300"}`}>
                  <span className={`block w-3 h-3 bg-white rounded-full shadow-md transform transition-transform duration-200 ${ flow.active ? "translate-x-5" : "translate-x-0"}`}/>
                </button>
              </div>
            </div>
          );
          })}
        </div>
      </div>
    </section>
  );
}