"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/src/providers/AuthProvider";
import { AlertModal } from "@/src/components/ui/AlertModal";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";
import { EventTypeSkeleton } from "@/src/components/ui/EventTypeSkeleton";
import {
  EventTypeFormLayout,
  split_duration_minutes,
  total_duration_minutes,
  type event_type_form_state,
} from "@/src/features/event-types/EventTypeFormLayout";

interface EventType {
  id: number;
  title: string;
  slug: string;
  duration_minutes: number | null;
  buffer_before: number | null;
  buffer_after: number | null;
  location_type: string | null;
  location_value: any;
  is_public: boolean | null;
  settings: any;
  created_at: string;
}

export default function EventTypes() {
  const { user } = useAuth();
  const [items, setItems] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [workspaceSlug, setWorkspaceSlug] = useState<string>("");
  const [loadingSlug, setLoadingSlug] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const empty_form = (): event_type_form_state => ({
    title: "",
    duration_hours: "",
    duration_minutes_part: "",
    buffer_before: "",
    buffer_after: "",
    location_type: "",
    is_public: false,
  });

  const [form, setForm] = useState<event_type_form_state>(empty_form);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!showForm) return;
    const previous_overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous_overflow;
    };
  }, [showForm]);

  const fetchWorkspaceSlug = async () => {
    console.log("=== Fetching Workspace Slug START ===");
    setLoadingSlug(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("❌ No access token found");
        return;
      }

      console.log("Calling /api/workspace/slug endpoint...");
      const response = await fetch("/api/workspace/slug", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error("❌ Error fetching workspace slug:", error);
        return;
      }

      const result = await response.json();
      console.log("✅ API Response:", result);

      if (result.slug) {
        console.log("✅ Setting workspace slug to:", result.slug);
        setWorkspaceSlug(result.slug);
      } else {
        console.error("❌ No slug in response");
      }
    } catch (err) {
      console.error("❌ Exception fetching workspace slug:", err);
    } finally {
      console.log("=== Finally block - setting loadingSlug to false ===");
      setLoadingSlug(false);
      console.log("=== Fetching Workspace Slug END ===");
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchEventTypes();
    fetchWorkspaceSlug();
  }, [user]);

  const fetchEventTypes = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("No access token found");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/event-types", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error fetching event types:", error);
        setLoading(false);
        return;
      }

      const result = await response.json();
      setItems(result.data || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.title.trim()) return;

    const durationMinutes = total_duration_minutes(form.duration_hours, form.duration_minutes_part);
    if (durationMinutes < 1) {
      setFormError("Duration must be at least 1 minute (set hours and/or minutes).");
      return;
    }

    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("No access token found");
        setFormError("You are not signed in. Please refresh and try again.");
        return;
      }

      const payload = {
        title: form.title,
        duration_minutes: durationMinutes,
        buffer_before: form.buffer_before || null,
        buffer_after: form.buffer_after || null,
        location_type: form.location_type || null,
        is_public: form.is_public,
      };

      if (editingId) {
        const response = await fetch("/api/event-types", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ id: editingId, ...payload }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error("Error updating event type:", error);
          setFormError(typeof error?.error === "string" ? error.error : "Could not update event type.");
          return;
        }

        const result = await response.json();
        setItems((prev) =>
          prev.map((item) => (item.id === editingId ? result.data : item))
        );
        setEditingId(null);
      } else {
        const response = await fetch("/api/event-types", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error("Error creating event type:", error);
          setFormError(typeof error?.error === "string" ? error.error : "Could not create event type.");
          return;
        }

        const result = await response.json();
        setItems((prev) => [result.data, ...prev]);
      }

      setForm(empty_form());
      setShowForm(false);
      setFormError(null);
      await fetchEventTypes();
    } catch (err) {
      console.error("Error:", err);
      setFormError("Something went wrong. Please try again.");
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const handleEdit = (item: EventType) => {
    setFormError(null);
    setEditingId(item.id);
    const { duration_hours, duration_minutes_part } = split_duration_minutes(
      item.duration_minutes ?? undefined
    );
    setForm({
      title: item.title,
      duration_hours,
      duration_minutes_part,
      buffer_before: item.buffer_before?.toString() || "",
      buffer_after: item.buffer_after?.toString() || "",
      location_type: item.location_type || "",
      is_public: item.is_public || false,
    });
    setShowForm(true);
  };

  const handleDeleteClick = (id: number) => setDeleteConfirmId(id);

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setDeleteConfirmId(null);
        setAlertMessage("Not authenticated");
        return;
      }

      const response = await fetch(`/api/event-types?id=${deleteConfirmId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        setDeleteConfirmId(null);
        setAlertMessage(error?.error || "Failed to delete event type");
        return;
      }

      setItems((prev) => prev.filter((item) => item.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Error:", err);
      setDeleteConfirmId(null);
      setAlertMessage("An error occurred while deleting the event type");
    }
  };

  const handleCancel = () => {
    setForm(empty_form());
    setFormError(null);
    setShowForm(false);
    setEditingId(null);
  };

  const handleNewEvent = () => {
    setForm(empty_form());
    setFormError(null);
    setEditingId(null);
    setShowForm(true);
  };

  const handleCopyLink = async (item: EventType) => {
    if (!workspaceSlug) {
      setAlertMessage("Unable to copy link. Workspace slug is not loaded yet. Please try again.");
      return;
    }
    
    if (!item.slug) {
      setAlertMessage(`Unable to copy link. Event type "${item.title}" does not have a slug. Please edit and save the event type to generate a slug.`);
      return;
    }

    const embedLink = `${window.location.origin}/${workspaceSlug}/${item.slug}`;
    
    try {
      await navigator.clipboard.writeText(embedLink);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
      setAlertMessage("Failed to copy link. Please try again.");
    }
  };

  return (
    <section className="space-y-8 mr-auto rounded-2xl">
      <header className="flex flex-wrap justify-between relative gap-3">
        <div className="text-sm text-slate-500">
          <h3 className="text-xl font-semibold text-slate-800">Event Types</h3>
          {/* <p className="text-xs text-slate-500">AI Tip: Your 45-min consult converts 9% better</p> */}
          {/* {loadingSlug ? (
            <p className="text-xs text-amber-500 mt-1">
              ⏳ Loading workspace...
            </p>
          ) : workspaceSlug ? (
            <p className="text-xs text-gray-400 mt-1">
              Workspace: <span className="font-mono text-indigo-600">{workspaceSlug}</span>
            </p>
          ) : (
            <p className="text-xs text-red-500 mt-1">
              ⚠️ Workspace slug not found. <button onClick={fetchWorkspaceSlug} className="underline hover:text-red-700">Retry</button>
            </p>
          )} */}
        </div>
        <button onClick={() => (showForm ? handleCancel() : handleNewEvent())} className="cursor-pointer text-sm font-bold text-indigo-600 transition">
          {showForm ? "Cancel" : "+ New event type"}
        </button>
      </header>

      {showForm &&
        portalReady &&
        createPortal(
          <div
            className="fixed inset-0 z-[100000] flex min-h-0 flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-type-form-heading"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close event form"
              onClick={handleCancel}
            />
            <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
              <EventTypeFormLayout
                value={form}
                onChange={(next) => {
                  setForm(next);
                  if (formError) setFormError(null);
                }}
                editingId={editingId}
                formError={formError}
                submitting={submitting}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
              />
            </div>
          </div>,
          document.body
        )}

      {loading ? (
        <EventTypeSkeleton />
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          No event types found. Create your first one!
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...items]
            .sort((a, b) => (a.duration_minutes ?? Infinity) - (b.duration_minutes ?? Infinity))
            .map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-100 bg-white shadow-md hover:shadow-lg transition-transform hover:-translate-y-1"
            >
              <div className="p-5">
                <div className="font-semibold text-lg text-slate-800">
                  {item.title}
                </div>
                <div className="text-sm mt-1 text-slate-500 space-y-1">
                  {item.duration_minutes && (
                    <div>Duration: {item.duration_minutes} minutes</div>
                  )}
                  {(item.buffer_before || item.buffer_after) && (
                    <div>
                      Buffer: {item.buffer_before || 0}min before, {item.buffer_after || 0}min after
                    </div>
                  )}
                  {item.location_type && (
                    <div>Location: {item.location_type}</div>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                        item.is_public
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {item.is_public ? "Public" : "Private"}
                    </span>
                    {item.slug && (
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-gray-50 px-2 py-1 text-xs font-medium text-slate-600">
                        {item.slug}
                      </span>
                    )}
                  </div>
                  {/* {workspaceSlug && item.slug && (
                    <div className="text-xs text-gray-500 break-all font-mono bg-gray-50 p-2 rounded border border-gray-200">
                      {`${window.location.origin}/${workspaceSlug}/${item.slug}`}
                    </div>
                  )} */}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button onClick={() => handleEdit(item)} className="cursor-pointer inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 inset-ring inset-ring-indigo-700/10 hover:bg-indigo-100">Edit</button>

                  <button 
                    onClick={() => handleCopyLink(item)} 
                    disabled={loadingSlug || !item.slug}
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium inset-ring transition-colors ${
                      loadingSlug || !item.slug
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : copiedId === item.id 
                        ? 'bg-green-600 text-white inset-ring-green-600/20 cursor-pointer' 
                        : 'bg-green-50 text-green-700 inset-ring-green-600/20 hover:bg-gray-100 cursor-pointer'
                    }`}
                    title={loadingSlug ? 'Loading workspace...' : !item.slug ? 'No slug available' : 'Copy embed link'}
                  >
                    {loadingSlug ? 'Loading...' : copiedId === item.id ? '✓ Copied!' : !item.slug ? 'No slug' : 'Copy link'}
                  </button>

                  <button onClick={() => handleDeleteClick(item.id)} className="cursor-pointer inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 inset-ring inset-ring-red-600/10 hover:bg-red-100">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteConfirmId && (
        <ConfirmModal
          title="Delete Event Type"
          message="Are you sure you want to delete this event type? This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}

      {alertMessage && (
        <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}
    </section>
  );
}