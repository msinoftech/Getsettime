"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Rule {
  id: number;
  condition: string;
  timezone: string;
  target: string;
}

interface Service {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  price: number | null;
  created_at: string;
  updated_at: string;
}

interface CustomField {
  id: string;
  label: string;
  field_type: 'text' | 'textarea' | 'number' | 'email' | 'tel' | 'url';
  required: boolean;
  placeholder?: string;
}

export default function RoutingForm({ dark = false }) {
  const [rules, setRules] = useState<Rule[]>([
    { id: 1, condition: "Consultation", timezone: "IST", target: "Deep/Consult" },
    { id: 2, condition: "Demo Call", timezone: "PST", target: "John/Demo" },
    { id: 3, condition: "Follow-up", timezone: "EST", target: "Amy/FollowUp" },
  ]);

  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [ruleFormData, setRuleFormData] = useState({
    condition: "",
    timezone: "",
    target: "",
  });

  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [intakeFormSettings, setIntakeFormSettings] = useState({
    name: true,
    email: true,
    phone: false,
    services: {
      enabled: false,
      allowed_service_ids: [] as string[],
    },
    additional_description: false,
    custom_fields: [] as CustomField[],
  });

  const [showCustomFieldForm, setShowCustomFieldForm] = useState(false);
  const [editingCustomField, setEditingCustomField] = useState<CustomField | null>(null);
  const [customFieldFormData, setCustomFieldFormData] = useState<CustomField>({
    id: '',
    label: '',
    field_type: 'text',
    required: false,
    placeholder: '',
  });

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");

  // Fetch services and settings on mount
  useEffect(() => {
    fetchServices();
    fetchIntakeFormSettings();
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

  const fetchIntakeFormSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.settings?.intake_form) {
          setIntakeFormSettings({
            name: data.settings.intake_form.name ?? true,
            email: data.settings.intake_form.email ?? true,
            phone: data.settings.intake_form.phone ?? false,
            services: data.settings.intake_form.services ?? {
              enabled: false,
              allowed_service_ids: [],
            },
            additional_description: data.settings.intake_form.additional_description ?? false,
            custom_fields: data.settings.intake_form.custom_fields ?? [],
          });
        }
      }
    } catch (error) {
      console.error('Error fetching intake form settings:', error);
    }
  };

  const handleNewRule = () => {
    setEditingRule(null);
    setRuleFormData({ condition: "", timezone: "", target: "" });
    setShowRuleForm(true);
  };

  const handleEditRule = (rule: Rule) => {
    setEditingRule(rule);
    setRuleFormData({
      condition: rule.condition,
      timezone: rule.timezone,
      target: rule.target,
    });
    setShowRuleForm(true);
  };

  const handleRuleFormCancel = () => {
    setShowRuleForm(false);
    setEditingRule(null);
    setRuleFormData({ condition: "", timezone: "", target: "" });
  };

  const handleRuleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      // Update existing rule
      setRules(rules.map((rule) => 
        rule.id === editingRule.id 
          ? { ...editingRule, ...ruleFormData }
          : rule
      ));
    } else {
      // Create new rule
      const newRule: Rule = {
        id: Math.max(...rules.map(r => r.id), 0) + 1,
        ...ruleFormData,
      };
      setRules([...rules, newRule]);
    }
    handleRuleFormCancel();
  };

  const handleOpenIntakeForm = () => {
    setShowIntakeForm(true);
  };

  const handleIntakeFormCancel = () => {
    setShowIntakeForm(false);
    setServiceSearch("");
  };

  const handleIntakeFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          settings: {
            intake_form: intakeFormSettings,
          },
        }),
      });

      if (response.ok) {
        alert('Intake form settings saved successfully!');
        handleIntakeFormCancel();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to save settings'}`);
      }
    } catch (error) {
      console.error('Error saving intake form settings:', error);
      alert('An error occurred while saving settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleService = (serviceId: string) => {
    const isSelected = intakeFormSettings.services.allowed_service_ids.includes(serviceId);
    const newServiceIds = isSelected
      ? intakeFormSettings.services.allowed_service_ids.filter((id) => id !== serviceId)
      : [...intakeFormSettings.services.allowed_service_ids, serviceId];

    setIntakeFormSettings({
      ...intakeFormSettings,
      services: {
        ...intakeFormSettings.services,
        allowed_service_ids: newServiceIds,
      },
    });
  };

  const handleDeleteRule = (id: number) => {
    if (confirm("Are you sure you want to delete this rule?")) {
      setRules(rules.filter((rule) => rule.id !== id));
    }
  };

  const handleOpenCustomFieldForm = () => {
    setEditingCustomField(null);
    setCustomFieldFormData({
      id: '',
      label: '',
      field_type: 'text',
      required: false,
      placeholder: '',
    });
    setShowCustomFieldForm(true);
  };

  const handleEditCustomField = (field: CustomField) => {
    setEditingCustomField(field);
    setCustomFieldFormData({
      id: field.id,
      label: field.label,
      field_type: field.field_type,
      required: field.required,
      placeholder: field.placeholder || '',
    });
    setShowCustomFieldForm(true);
  };

  const handleCustomFieldFormCancel = () => {
    setShowCustomFieldForm(false);
    setEditingCustomField(null);
    setCustomFieldFormData({
      id: '',
      label: '',
      field_type: 'text',
      required: false,
      placeholder: '',
    });
  };

  const handleCustomFieldFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomField) {
      // Update existing field
      setIntakeFormSettings({
        ...intakeFormSettings,
        custom_fields: intakeFormSettings.custom_fields.map((field) =>
          field.id === editingCustomField.id
            ? { ...customFieldFormData }
            : field
        ),
      });
    } else {
      // Create new field
      const newField: CustomField = {
        ...customFieldFormData,
        id: Date.now().toString(),
      };
      setIntakeFormSettings({
        ...intakeFormSettings,
        custom_fields: [...intakeFormSettings.custom_fields, newField],
      });
    }
    handleCustomFieldFormCancel();
  };

  const handleRemoveCustomField = (id: string) => {
    setIntakeFormSettings({
      ...intakeFormSettings,
      custom_fields: intakeFormSettings.custom_fields.filter(field => field.id !== id),
    });
  };

  return (
    <section className="space-y-6 rounded-xl mr-auto">
      <header className="flex flex-wrap justify-between relative gap-3">
        <div className="text-sm text-slate-500">
          <h3 className="text-xl font-semibold text-slate-800">Routing & Forms</h3>
          <p className="text-xs text-slate-500">Configure intake form for your booking events.</p>
        </div>
        <button onClick={handleNewRule} className="cursor-pointer text-sm font-bold text-indigo-600 transition">+ New Rule</button>
      </header>

      {/* Rule Form Modal */}
      {showRuleForm && (
        <div className={`fixed inset-0 z-40 flex m-0 justify-end transition-opacity duration-200 ${showRuleForm ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${showRuleForm ? 'opacity-100' : 'opacity-0'}`}  aria-hidden="true"  onClick={handleRuleFormCancel}/>
          <section className={`relative h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform duration-300 ${showRuleForm ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className={`flex items-center justify-between border-b border-gray-200 px-6 py-4`}>
              <div>
                <h2 className={`text-lg font-semibold text-gray-800`}>{editingRule ? "Edit Rule" : "Create New Rule"}</h2>
              </div>
              <button className={`rounded-full p-2 text-gray-500 hover:bg-gray-100 transition`} aria-label="Close form" onClick={handleRuleFormCancel}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-y-auto p-6">
              <form onSubmit={handleRuleFormSubmit} className="space-y-4 p-5 rounded-xl border border-slate-200 bg-gray-50/70">
                <div className={`grid md:grid-cols-2 gap-3`}>
                  <div>
                    <label className={`block text-sm font-medium mb-2 text-slate-700`}>Condition <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={ruleFormData.condition}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, condition: e.target.value })}
                      placeholder="e.g., Consultation, Demo Call"
                      className={`w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none`}
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 text-slate-700`}>Timezone <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={ruleFormData.timezone}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, timezone: e.target.value })}
                      placeholder="e.g., IST, PST, EST"
                      className={`w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none`}
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium mb-2 text-slate-700`}>Target <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={ruleFormData.target}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, target: e.target.value })}
                      placeholder="e.g., Deep/Consult, John/Demo"
                      className={`w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none`}
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button type="submit" className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition">{editingRule ? "Update Rule" : "Create Rule"}</button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {/* Intake Form Section */}
      <div className="rounded-2xl rounded-xl bg-white shadow-md p-6">
        <div className="space-y-4">
          <div className="font-medium text-base">Intake Form Settings</div>
          <p className={`text-sm ${dark ? "text-white/70" : "text-slate-600"}`}>Configure which fields to show in your booking intake form.</p>
          <button onClick={handleOpenIntakeForm} className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition">Configure Intake Form</button>
        </div>
      </div>

      {/* Intake Form Modal */}
      {showIntakeForm && (
        <div className={`fixed inset-0 z-40 flex m-0 justify-end transition-opacity duration-200 ${showIntakeForm ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${showIntakeForm ? 'opacity-100' : 'opacity-0'}`}  aria-hidden="true"  onClick={handleIntakeFormCancel}/>
          <section className={`relative h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform duration-300 ${showIntakeForm ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className={`flex items-center justify-between border-b border-gray-200 px-6 py-4`}>
              <div>
                <h2 className={`text-lg font-semibold text-gray-800`}>Intake Form Settings</h2>
                <p className="text-xs text-slate-500 mt-1">Configure which fields to collect from invitees</p>
              </div>
              <button className={`rounded-full p-2 text-gray-500 hover:bg-gray-100 transition`} aria-label="Close form" onClick={handleIntakeFormCancel}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-y-auto p-6">
              <form onSubmit={handleIntakeFormSubmit} className="space-y-4 p-5 rounded-xl border border-slate-200 bg-gray-50/70">
                <div className="space-y-3">
                  {/* Name Field Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Name</label>
                      <p className="text-xs text-slate-500">Collect invitee's full name</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={intakeFormSettings.name}
                        onChange={(e) => setIntakeFormSettings({ ...intakeFormSettings, name: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* Email Field Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Email</label>
                      <p className="text-xs text-slate-500">Collect invitee's email address</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={intakeFormSettings.email}
                        onChange={(e) => setIntakeFormSettings({ ...intakeFormSettings, email: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* Phone Field Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Phone</label>
                      <p className="text-xs text-slate-500">Collect invitee's phone number</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={intakeFormSettings.phone}
                        onChange={(e) => setIntakeFormSettings({ ...intakeFormSettings, phone: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* Services Field Toggle */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <label className="text-sm font-medium text-slate-700">Services</label>
                        <p className="text-xs text-slate-500">Allow invitees to select services</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={intakeFormSettings.services.enabled}
                          onChange={(e) => setIntakeFormSettings({
                            ...intakeFormSettings,
                            services: { ...intakeFormSettings.services, enabled: e.target.checked }
                          })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    {intakeFormSettings.services.enabled && (
                      <div className="mt-3 space-y-3">
                        {services.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">No services available. Create services first.</p>
                        ) : (
                          <>
                            {/* Selected Services */}
                            {intakeFormSettings.services.allowed_service_ids.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-medium text-slate-700">
                                    Selected Services ({intakeFormSettings.services.allowed_service_ids.length})
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setIntakeFormSettings({
                                      ...intakeFormSettings,
                                      services: {
                                        ...intakeFormSettings.services,
                                        allowed_service_ids: []
                                      }
                                    })}
                                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                                  >
                                    Clear All
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {services
                                    .filter(service => intakeFormSettings.services.allowed_service_ids.includes(service.id))
                                    .map((service) => (
                                      <div
                                        key={service.id}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300"
                                      >
                                        <span className="text-xs font-medium">{service.name}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleService(service.id)}
                                          className="hover:bg-indigo-200 rounded-full p-0.5 transition"
                                          title="Remove service"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Search and Available Services */}
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-slate-700">
                                Add Services
                              </p>
                              
                              {/* Search Input */}
                              <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                  type="text"
                                  value={serviceSearch}
                                  onChange={(e) => setServiceSearch(e.target.value)}
                                  placeholder="Search services..."
                                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                                {serviceSearch && (
                                  <button
                                    type="button"
                                    onClick={() => setServiceSearch("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>

                              {/* Available Services Chips */}
                              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-lg border border-slate-200 bg-slate-50">
                                {services
                                  .filter(service => 
                                    !intakeFormSettings.services.allowed_service_ids.includes(service.id) &&
                                    (serviceSearch === "" || service.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                                  )
                                  .map((service) => (
                                    <button
                                      key={service.id}
                                      type="button"
                                      onClick={() => handleToggleService(service.id)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-slate-700 border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition"
                                      title={service.description || undefined}
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                      </svg>
                                      <span className="text-xs font-medium">{service.name}</span>
                                    </button>
                                  ))}
                                {services.filter(service => 
                                  !intakeFormSettings.services.allowed_service_ids.includes(service.id) &&
                                  (serviceSearch === "" || service.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                                ).length === 0 && (
                                  <p className="text-xs text-slate-500 italic py-1">
                                    {serviceSearch ? 'No services found' : 'All services added'}
                                  </p>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Additional Description Field Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Additional Description</label>
                      <p className="text-xs text-slate-500">Collect additional notes from invitees</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={intakeFormSettings.additional_description}
                        onChange={(e) => setIntakeFormSettings({ ...intakeFormSettings, additional_description: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* Custom Fields Section */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <label className="text-sm font-medium text-slate-700">Custom Fields</label>
                        <p className="text-xs text-slate-500">Add custom fields to collect additional information</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenCustomFieldForm}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition"
                      >
                        + Add Field
                      </button>
                    </div>

                    {intakeFormSettings.custom_fields.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {intakeFormSettings.custom_fields.map((field) => (
                          <div
                            key={field.id}
                            className="flex items-start justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-700">{field.label}</span>
                                {field.required && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Required</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-500">Type: {field.field_type}</span>
                                {field.placeholder && (
                                  <span className="text-xs text-slate-400">• Placeholder: {field.placeholder}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditCustomField(field)}
                                className="ml-3 p-1.5 rounded-full text-indigo-600 hover:bg-indigo-100 transition"
                                title="Edit field"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomField(field.id)}
                                className="p-1.5 rounded-full text-red-600 hover:bg-red-100 transition"
                                title="Remove field"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {intakeFormSettings.custom_fields.length === 0 && (
                      <p className="text-xs text-slate-500 italic text-center py-3">No custom fields added yet</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={handleIntakeFormCancel}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-200 text-slate-700 hover:bg-slate-300 transition"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {/* Custom Field Form Modal */}
      {showCustomFieldForm && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${showCustomFieldForm ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${showCustomFieldForm ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" onClick={handleCustomFieldFormCancel}/>
          <section className={`relative w-full max-w-md transform bg-white rounded-2xl shadow-2xl transition-all duration-300 ${showCustomFieldForm ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            <div className={`flex items-center justify-between border-b border-gray-200 px-6 py-4`}>
              <div>
                <h2 className={`text-lg font-semibold text-gray-800`}>{editingCustomField ? "Edit Custom Field" : "Add Custom Field"}</h2>
                <p className="text-xs text-slate-500 mt-1">{editingCustomField ? "Update field details" : "Create a new field to collect from invitees"}</p>
              </div>
              <button className={`rounded-full p-2 text-gray-500 hover:bg-gray-100 transition`} aria-label="Close form" onClick={handleCustomFieldFormCancel}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleCustomFieldFormSubmit} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 text-slate-700`}>Field Label <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={customFieldFormData.label}
                    onChange={(e) => setCustomFieldFormData({ ...customFieldFormData, label: e.target.value })}
                    placeholder="e.g., Company Name, Job Title"
                    className={`w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none`}
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 text-slate-700`}>Field Type <span className="text-red-500">*</span></label>
                  <select
                    value={customFieldFormData.field_type}
                    onChange={(e) => setCustomFieldFormData({ ...customFieldFormData, field_type: e.target.value as CustomField['field_type'] })}
                    className={`w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none`}
                    required
                  >
                    <option value="text">Text (Single Line)</option>
                    <option value="textarea">Text Area (Multiple Lines)</option>
                    <option value="number">Number</option>
                    <option value="email">Email</option>
                    <option value="tel">Phone</option>
                    <option value="url">URL</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 text-slate-700`}>Placeholder (Optional)</label>
                  <input
                    type="text"
                    value={customFieldFormData.placeholder}
                    onChange={(e) => setCustomFieldFormData({ ...customFieldFormData, placeholder: e.target.value })}
                    placeholder="e.g., Enter your company name"
                    className={`w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none`}
                  />
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <input
                    type="checkbox"
                    id="customFieldRequired"
                    checked={customFieldFormData.required}
                    onChange={(e) => setCustomFieldFormData({ ...customFieldFormData, required: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="customFieldRequired" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Make this field required
                  </label>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={handleCustomFieldFormCancel}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-200 text-slate-700 hover:bg-slate-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition"
                  >
                    {editingCustomField ? "Update Field" : "Add Field"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
