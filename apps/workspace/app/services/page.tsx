"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AlertModal } from "@/src/components/ui/AlertModal";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";

interface Service {
  id: string;
  workspace_id: number;
  name: string;
  description: string | null;
  price: number | null;
  created_at: string;
  updated_at: string;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceFormData, setServiceFormData] = useState({
    name: "",
    description: "",
    price: "",
  });
  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch services on mount
  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/services', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const handleNewService = () => {
    setEditingService(null);
    setServiceFormData({ name: "", description: "", price: "" });
    setShowServiceForm(true);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setServiceFormData({
      name: service.name,
      description: service.description || "",
      price: service.price?.toString() || "",
    });
    setShowServiceForm(true);
  };

  const handleServiceFormCancel = () => {
    setShowServiceForm(false);
    setEditingService(null);
    setServiceFormData({ name: "", description: "", price: "" });
  };

  const handleServiceFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAlertMessage('Not authenticated');
        return;
      }

      const url = '/api/services';
      const method = editingService ? 'PUT' : 'POST';
      const body = editingService
        ? { id: editingService.id, ...serviceFormData }
        : serviceFormData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await fetchServices();
        handleServiceFormCancel();
      } else {
        const errorData = await response.json();
        setAlertMessage(`Error: ${errorData.error || 'Failed to save service'}`);
      }
    } catch (error) {
      console.error('Error saving service:', error);
      setAlertMessage('An error occurred while saving the service');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteServiceClick = (id: string) => setDeleteConfirmId(id);

  const handleDeleteServiceConfirm = async () => {
    if (!deleteConfirmId) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setDeleteConfirmId(null);
        setAlertMessage('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/services?id=${deleteConfirmId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        await fetchServices();
        setDeleteConfirmId(null);
      } else {
        const errorData = await response.json();
        setDeleteConfirmId(null);
        setAlertMessage(`Error: ${errorData.error || 'Failed to delete service'}`);
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      setDeleteConfirmId(null);
      setAlertMessage('An error occurred while deleting the service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6 rounded-xl">
      <header className="flex flex-wrap justify-between relative gap-3">
        <div className="text-sm text-slate-500">
          <h3 className="text-xl font-semibold text-slate-800">Services</h3>
          <p className="text-xs text-slate-500">Manage services that can be selected during booking.</p>
        </div>
        <button onClick={handleNewService} className="cursor-pointer text-sm font-bold text-indigo-600 transition hover:text-indigo-700">+ New Service</button>
      </header>

      {/* Services List */}
      <div className="rounded-2xl bg-white shadow-md p-6">
        {services.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-900">No services</h3>
            <p className="mt-1 text-sm text-slate-500">Get started by creating your first service.</p>
            <div className="mt-6">
              <button
                onClick={handleNewService}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Service
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div key={service.id} className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:shadow-sm transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-medium text-slate-800 truncate">{service.name}</h4>
                    {service.price && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ${service.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {service.description && (
                    <p className="mt-1 text-sm text-slate-600 line-clamp-2">{service.description}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    Created {new Date(service.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEditService(service)}
                    className="inline-flex items-center rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteServiceClick(service.id)}
                    className="inline-flex items-center rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Service Form Modal */}
      {showServiceForm && (
        <div className={`fixed inset-0 z-40 flex m-0 justify-end transition-opacity duration-200 ${showServiceForm ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${showServiceForm ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" onClick={handleServiceFormCancel}/>
          <section className={`relative h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform duration-300 ${showServiceForm ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{editingService ? "Edit Service" : "Create New Service"}</h2>
                <p className="text-xs text-slate-500 mt-1">Fill in the service details below</p>
              </div>
              <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100 transition" aria-label="Close form" onClick={handleServiceFormCancel}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-y-auto p-6">
              <form onSubmit={handleServiceFormSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Service Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={serviceFormData.name}
                    onChange={(e) => setServiceFormData({ ...serviceFormData, name: e.target.value })}
                    placeholder="e.g., Consultation, Workshop, Training"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Description
                  </label>
                  <textarea
                    value={serviceFormData.description}
                    onChange={(e) => setServiceFormData({ ...serviceFormData, description: e.target.value })}
                    placeholder="Brief description of the service (optional)"
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none transition"
                  />
                  <p className="mt-1 text-xs text-slate-500">Provide details to help customers understand this service</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Price (optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={serviceFormData.price}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, price: e.target.value })}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Leave empty if price varies or is discussed separately</p>
                </div>

                <div className="flex gap-3 justify-end pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleServiceFormCancel}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : (editingService ? 'Update Service' : 'Create Service')}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {deleteConfirmId && (
        <ConfirmModal
          title="Delete Service"
          message="Are you sure you want to delete this service? This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeleteServiceConfirm}
          onCancel={() => setDeleteConfirmId(null)}
          loading={loading}
        />
      )}

      {alertMessage && (
        <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}
    </section>
  );
}

