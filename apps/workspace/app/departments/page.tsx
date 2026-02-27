"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AlertModal } from "@/src/components/ui/AlertModal";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";

interface Service {
  id: string;
  name: string;
}

interface DepartmentService {
  id: string;
  name: string;
}

interface Department {
  id: number;
  workspace_id: number;
  name: string;
  description: string | null;
  meta_data: {
    services?: DepartmentService[];
  } | null;
  created_at: string;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentFormData, setDepartmentFormData] = useState({
    name: "",
    description: "",
  });
  const [selectedServices, setSelectedServices] = useState<DepartmentService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Fetch departments and services on mount
  useEffect(() => {
    fetchDepartments();
    fetchServices();
  }, []);

  const fetchDepartments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/departments', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchServices = async () => {
    try {
      setServicesLoading(true);
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
    } finally {
      setServicesLoading(false);
    }
  };

  const handleNewDepartment = () => {
    setEditingDepartment(null);
    setDepartmentFormData({ name: "", description: "" });
    setSelectedServices([]);
    setShowDepartmentForm(true);
  };

  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    setDepartmentFormData({
      name: department.name,
      description: department.description || "",
    });
    // Load services from meta_data
    const servicesFromMeta = department.meta_data?.services || [];
    setSelectedServices(servicesFromMeta);
    setShowDepartmentForm(true);
  };

  const handleDepartmentFormCancel = () => {
    setShowDepartmentForm(false);
    setEditingDepartment(null);
    setDepartmentFormData({ name: "", description: "" });
    setSelectedServices([]);
  };

  const handleAddService = (service: Service) => {
    // Prevent duplicates
    if (selectedServices.some(s => s.id === service.id)) {
      return;
    }
    setSelectedServices([...selectedServices, { id: service.id, name: service.name }]);
  };

  const handleRemoveService = (serviceId: string) => {
    setSelectedServices(selectedServices.filter(s => s.id !== serviceId));
  };

  const handleDepartmentFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAlertMessage('Not authenticated');
        return;
      }

      // Prepare meta_data with services
      // Always include services array, even if empty
      const meta_data: { services: DepartmentService[] } = {
        services: selectedServices,
      };

      const url = '/api/departments';
      const method = editingDepartment ? 'PUT' : 'POST';
      const body = editingDepartment
        ? { 
            id: editingDepartment.id, 
            name: departmentFormData.name,
            description: departmentFormData.description,
            meta_data 
          }
        : { 
            name: departmentFormData.name,
            description: departmentFormData.description,
            meta_data 
          };

      console.log('Saving department with meta_data:', meta_data);
      console.log('meta_data type:', typeof meta_data);
      console.log('Body being sent:', body);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await fetchDepartments();
        handleDepartmentFormCancel();
      } else {
        const errorData = await response.json();
        setAlertMessage(`Error: ${errorData.error || 'Failed to save department'}`);
      }
    } catch (error) {
      console.error('Error saving department:', error);
      setAlertMessage('An error occurred while saving the department');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDepartmentClick = (id: number) => setDeleteConfirmId(id);

  const handleDeleteDepartmentConfirm = async () => {
    if (!deleteConfirmId) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setDeleteConfirmId(null);
        setAlertMessage('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/departments?id=${deleteConfirmId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        await fetchDepartments();
        setDeleteConfirmId(null);
      } else {
        const errorData = await response.json();
        setDeleteConfirmId(null);
        setAlertMessage(`Error: ${errorData.error || 'Failed to delete department'}`);
      }
    } catch (error) {
      console.error('Error deleting department:', error);
      setDeleteConfirmId(null);
      setAlertMessage('An error occurred while deleting the department');
    } finally {
      setLoading(false);
    }
  };

  // Get available services (not already selected)
  const availableServices = services.filter(
    service => !selectedServices.some(selected => selected.id === service.id)
  );

  return (
    <section className="space-y-6 rounded-xl">
      <header className="flex flex-wrap justify-between relative gap-3">
        <div className="text-sm text-slate-500">
          <h3 className="text-xl font-semibold text-slate-800">Departments</h3>
          <p className="text-xs text-slate-500">Manage departments and assign services to them.</p>
        </div>
        <button onClick={handleNewDepartment} className="cursor-pointer text-sm font-bold text-indigo-600 transition hover:text-indigo-700">+ New Department</button>
      </header>

      {/* Departments List */}
      <div className="rounded-2xl bg-white shadow-md p-6">
        {departments.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-900">No departments</h3>
            <p className="mt-1 text-sm text-slate-500">Get started by creating your first department.</p>
            <div className="mt-6">
              <button
                onClick={handleNewDepartment}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Department
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {departments.map((department) => {
              const departmentServices = department.meta_data?.services || [];
              return (
                <div key={department.id} className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:shadow-sm transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-medium text-slate-800 truncate">{department.name}</h4>
                    </div>
                    {department.description && (
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{department.description}</p>
                    )}
                    {departmentServices.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {departmentServices.map((service) => (
                          <span
                            key={service.id}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                          >
                            {service.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-slate-400">
                      Created {new Date(department.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEditDepartment(department)}
                      className="inline-flex items-center rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteDepartmentClick(department.id)}
                      className="inline-flex items-center rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Department Form Modal */}
      {showDepartmentForm && (
        <div className={`fixed inset-0 z-40 flex m-0 justify-end transition-opacity duration-200 ${showDepartmentForm ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${showDepartmentForm ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" onClick={handleDepartmentFormCancel}/>
          <section className={`relative h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform duration-300 ${showDepartmentForm ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{editingDepartment ? "Edit Department" : "Create New Department"}</h2>
                <p className="text-xs text-slate-500 mt-1">Fill in the department details below</p>
              </div>
              <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100 transition" aria-label="Close form" onClick={handleDepartmentFormCancel}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-y-auto p-6">
              <form onSubmit={handleDepartmentFormSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Department Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={departmentFormData.name}
                    onChange={(e) => setDepartmentFormData({ ...departmentFormData, name: e.target.value })}
                    placeholder="e.g., Sales, Support, Engineering"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Description
                  </label>
                  <textarea
                    value={departmentFormData.description}
                    onChange={(e) => setDepartmentFormData({ ...departmentFormData, description: e.target.value })}
                    placeholder="Brief description of the department (optional)"
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none transition"
                  />
                  <p className="mt-1 text-xs text-slate-500">Provide details to help understand this department</p>
                </div>

                {/* Services Selector */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700">
                    Services
                  </label>
                  
                  {/* Selected Services Chips */}
                  {selectedServices.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedServices.map((service) => (
                        <span
                          key={service.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                        >
                          {service.name}
                          <button
                            type="button"
                            onClick={() => handleRemoveService(service.id)}
                            className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-indigo-200 transition"
                            aria-label={`Remove ${service.name}`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Services Dropdown/Selector */}
                  {servicesLoading ? (
                    <div className="text-sm text-slate-500">Loading services...</div>
                  ) : availableServices.length > 0 ? (
                    <div className="border border-slate-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                      <div className="space-y-2">
                        {availableServices.map((service) => (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => handleAddService(service)}
                            className="w-full text-left px-3 py-2 rounded-md text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                          >
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              {service.name}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : services.length === 0 ? (
                    <div className="text-sm text-slate-500 border border-slate-300 rounded-lg p-3">
                      No services available. Create services first to assign them to departments.
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 border border-slate-300 rounded-lg p-3">
                      All available services have been added.
                    </div>
                  )}
                  <p className="mt-1 text-xs text-slate-500">Select services to associate with this department</p>
                </div>

                <div className="flex gap-3 justify-end pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleDepartmentFormCancel}
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
                    {loading ? 'Saving...' : (editingDepartment ? 'Update Department' : 'Create Department')}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {deleteConfirmId && (
        <ConfirmModal
          title="Delete Department"
          message="Are you sure you want to delete this department? This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeleteDepartmentConfirm}
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

