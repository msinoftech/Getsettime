"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AlertModal } from "@/src/components/ui/AlertModal";

/*
TEMP DISABLED: Services intake support
interface Service {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  price: number | null;
  created_at: string;
  updated_at: string;
}
*/

interface CustomField {
  id: string;
  label: string;
  field_type: 'text' | 'textarea' | 'number' | 'email' | 'tel' | 'url';
  type?: 'text' | 'textarea' | 'number' | 'email' | 'tel' | 'url';
  required: boolean;
  placeholder?: string;
}

type DefaultIntakeFieldKey = "name" | "email" | "phone" | "file_upload" | "additional_description";
type FieldIcon = "user" | "mail" | "phone" | "upload" | "message" | "file";

const DEFAULT_INTAKE_FIELD_META: Array<{
  key: DefaultIntakeFieldKey;
  label: string;
  description: string;
  icon: FieldIcon;
}> = [
  { key: "name", label: "Name", description: "Collect invitee's full name", icon: "user" },
  { key: "email", label: "Email", description: "Collect invitee's email address", icon: "mail" },
  { key: "phone", label: "Phone", description: "Collect invitee's phone number", icon: "phone" },
  { key: "file_upload", label: "File Upload", description: "Allow invitees to upload a file, PDF, or image", icon: "upload" },
  { key: "additional_description", label: "Additional Description", description: "Collect notes, symptoms, requests, or extra details", icon: "message" },
];

type IconName = FieldIcon | "search" | "plus" | "save" | "trash" | "edit" | "sparkles" | "grip" | "clipboard";

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24" as const,
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
  if (name === "mail") return <svg {...common}><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></svg>;
  if (name === "phone") return <svg {...common}><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.7 19.7 0 0 1 3.1 5.18 2 2 0 0 1 5.1 3h3a2 2 0 0 1 2 1.72c.12.9.32 1.77.6 2.6a2 2 0 0 1-.45 2.11L9 10.7a16 16 0 0 0 4.3 4.3l1.27-1.25a2 2 0 0 1 2.11-.45c.83.28 1.7.48 2.6.6A2 2 0 0 1 22 16.92Z" /></svg>;
  if (name === "upload") return <svg {...common}><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M20 16.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5" /></svg>;
  if (name === "message") return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8" /><path d="M8 13h5" /></svg>;
  if (name === "file") return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>;
  if (name === "save") return <svg {...common}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></svg>;
  if (name === "trash") return <svg {...common}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>;
  if (name === "edit") return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></svg>;
  if (name === "sparkles") return <svg {...common}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></svg>;
  if (name === "grip") return <svg {...common}><path d="M9 6h.01" /><path d="M15 6h.01" /><path d="M9 12h.01" /><path d="M15 12h.01" /><path d="M9 18h.01" /><path d="M15 18h.01" /></svg>;
  if (name === "clipboard") return <svg {...common}><path d="M9 4h6a2 2 0 0 1 2 2v1H7V6a2 2 0 0 1 2-2Z" /><path d="M7 6H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>;

  return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}

function fieldTypeLabel(fieldType: CustomField["field_type"]): string {
  const labels: Record<CustomField["field_type"], string> = {
    text: "Text",
    textarea: "Text area",
    number: "Number",
    email: "Email",
    tel: "Phone",
    url: "URL",
  };
  return labels[fieldType];
}

const CUSTOM_FIELD_TYPE_OPTIONS: Array<{ value: CustomField["field_type"]; label: string }> = [
  { value: "text", label: "Text (Single Line)" },
  { value: "textarea", label: "Text Area (Multiple Lines)" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Phone" },
  { value: "url", label: "URL" },
];

export default function RoutingForm({ dark = false }) {
  const [fieldSearch, setFieldSearch] = useState("");
  const [intakeFormSettings, setIntakeFormSettings] = useState({
    name: true,
    email: true,
    phone: false,
    /*
    TEMP DISABLED: Services intake support
    services: {
      enabled: false,
      allowed_service_ids: [] as string[],
    },
    */
    file_upload: false,
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

  const [newCustomLabel, setNewCustomLabel] = useState("");
  const [newCustomFieldType, setNewCustomFieldType] = useState<CustomField["field_type"]>("text");

  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    fetchIntakeFormSettings();
  }, []);

  /*
  TEMP DISABLED: Services intake support
  const [services, setServices] = useState<Service[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");

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
  */

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
            /*
            TEMP DISABLED: Services intake support
            services: data.settings.intake_form.services ?? {
              enabled: false,
              allowed_service_ids: [],
            },
            */
            file_upload: data.settings.intake_form.file_upload ?? false,
            additional_description: data.settings.intake_form.additional_description ?? false,
            custom_fields: data.settings.intake_form.custom_fields ?? [],
          });
        }
      }
    } catch (error) {
      console.error('Error fetching intake form settings:', error);
    }
  };

  const handleIntakeFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAlertMessage('Not authenticated');
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
        setAlertMessage('Intake form settings saved successfully!');
      } else {
        const errorData = await response.json();
        setAlertMessage(`Error: ${errorData.error || 'Failed to save settings'}`);
      }
    } catch (error) {
      console.error('Error saving intake form settings:', error);
      setAlertMessage('An error occurred while saving settings');
    } finally {
      setLoading(false);
    }
  };

  /*
  TEMP DISABLED: Services intake support
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
  */

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
    if (!editingCustomField) return;
    const updated: CustomField = {
      ...customFieldFormData,
      type: customFieldFormData.field_type,
    };
    setIntakeFormSettings((prev) => ({
      ...prev,
      custom_fields: prev.custom_fields.map((field) =>
        field.id === editingCustomField.id ? updated : field
      ),
    }));
    handleCustomFieldFormCancel();
  };

  const addCustomFieldInline = () => {
    const label = newCustomLabel.trim();
    if (!label) return;
    const newField: CustomField = {
      id: Date.now().toString(),
      label,
      field_type: newCustomFieldType,
      type: newCustomFieldType,
      required: false,
      placeholder: "",
    };
    setIntakeFormSettings((prev) => ({
      ...prev,
      custom_fields: [...prev.custom_fields, newField],
    }));
    setNewCustomLabel("");
    setNewCustomFieldType("text");
  };

  const toggleCustomFieldRequired = (id: string) => {
    setIntakeFormSettings((prev) => ({
      ...prev,
      custom_fields: prev.custom_fields.map((field) =>
        field.id === id ? { ...field, required: !field.required } : field
      ),
    }));
  };

  const handleRemoveCustomField = (id: string) => {
    setIntakeFormSettings({
      ...intakeFormSettings,
      custom_fields: intakeFormSettings.custom_fields.filter(field => field.id !== id),
    });
  };

  const filteredDefaultFieldMeta = useMemo(() => {
    const keyword = fieldSearch.trim().toLowerCase();
    if (!keyword) return DEFAULT_INTAKE_FIELD_META;
    return DEFAULT_INTAKE_FIELD_META.filter(
      (row) =>
        row.label.toLowerCase().includes(keyword) ||
        row.description.toLowerCase().includes(keyword)
    );
  }, [fieldSearch]);

  const enabledDefaultCount = useMemo(
    () =>
      [
        intakeFormSettings.name,
        intakeFormSettings.email,
        intakeFormSettings.phone,
        intakeFormSettings.file_upload,
        intakeFormSettings.additional_description,
      ].filter(Boolean).length,
    [
      intakeFormSettings.name,
      intakeFormSettings.email,
      intakeFormSettings.phone,
      intakeFormSettings.file_upload,
      intakeFormSettings.additional_description,
    ]
  );

  const enabledFieldsCount = enabledDefaultCount + intakeFormSettings.custom_fields.length;
  const requiredFieldsCount = useMemo(
    () => intakeFormSettings.custom_fields.filter((f) => f.required).length,
    [intakeFormSettings.custom_fields]
  );

  const toggleDefaultIntakeField = (key: DefaultIntakeFieldKey) => {
    setIntakeFormSettings((prev) => {
      switch (key) {
        case "name":
          return { ...prev, name: !prev.name };
        case "email":
          return { ...prev, email: !prev.email };
        case "phone":
          return { ...prev, phone: !prev.phone };
        case "file_upload":
          return { ...prev, file_upload: !prev.file_upload };
        case "additional_description":
          return { ...prev, additional_description: !prev.additional_description };
        default:
          return prev;
      }
    });
  };

  const defaultFieldEnabled = (key: DefaultIntakeFieldKey): boolean => {
    switch (key) {
      case "name":
        return intakeFormSettings.name;
      case "email":
        return intakeFormSettings.email;
      case "phone":
        return intakeFormSettings.phone;
      case "file_upload":
        return intakeFormSettings.file_upload;
      case "additional_description":
        return intakeFormSettings.additional_description;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="relative p-6 sm:p-7">
            <div className="absolute right-0 top-0 h-36 w-36 rounded-bl-full bg-blue-50" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  <Icon name="sparkles" className="h-3.5 w-3.5" />
                  Booking Flow Setup
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  Routing & Forms
                </h1>
                <p
                  className={`mt-2 max-w-2xl text-sm leading-6 ${dark ? "text-white/70" : "text-slate-500"}`}
                >
                  Configure intake questions, file collection, required fields, and booking form visibility for your workspace.
                </p>
              </div>

              <div className="relative w-full lg:w-80">
                <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={fieldSearch}
                  onChange={(event) => setFieldSearch(event.target.value)}
                  placeholder="Search fields..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  type="search"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
            <p className="text-sm font-bold text-blue-700">Active Fields</p>
            <p className="mt-2 text-3xl font-black text-blue-950">{enabledFieldsCount}</p>
          </div>
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
            <p className="text-sm font-bold text-emerald-700">Required Fields</p>
            <p className="mt-2 text-3xl font-black text-emerald-950">{requiredFieldsCount}</p>
          </div>
          <div className="rounded-3xl border border-violet-100 bg-violet-50 p-5">
            <p className="text-sm font-bold text-violet-700">Custom Fields</p>
            <p className="mt-2 text-3xl font-black text-violet-950">{intakeFormSettings.custom_fields.length}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form onSubmit={handleIntakeFormSubmit} className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200">
                  <Icon name="clipboard" className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Default Intake Fields</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Enable or disable the default fields shown during appointment booking.
                  </p>
                </div>
              </div>

              <div className="mt-7 space-y-3">
                {filteredDefaultFieldMeta.map((field) => {
                  const enabled = defaultFieldEnabled(field.key);
                  return (
                    <div
                      key={field.key}
                      className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                        <Icon name={field.icon} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-slate-800">{field.label}</h3>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{field.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleDefaultIntakeField(field.key)}
                        aria-label={`Toggle ${field.label}`}
                        aria-pressed={enabled}
                        className={`relative h-8 w-14 shrink-0 rounded-full transition ${enabled ? "bg-blue-600" : "bg-slate-300"}`}
                      >
                        <span
                          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${enabled ? "left-7" : "left-1"}`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Custom Fields</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Add extra questions such as patient ID, service notes, source, or preferred consultant.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-50"
                >
                  <Icon name="save" className="h-4 w-4" />
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_minmax(0,200px)_auto]">
                <input
                  type="text"
                  value={newCustomLabel}
                  onChange={(e) => setNewCustomLabel(e.target.value)}
                  placeholder="Field name e.g. Patient ID"
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
                <select
                  value={newCustomFieldType}
                  onChange={(e) => setNewCustomFieldType(e.target.value as CustomField["field_type"])}
                  className="h-12 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  {CUSTOM_FIELD_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addCustomFieldInline}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
                >
                  <Icon name="plus" className="h-4 w-4" />
                  Add Field
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {intakeFormSettings.custom_fields.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <p className="text-sm font-semibold italic text-slate-500">No custom fields added yet</p>
                  </div>
                ) : (
                  intakeFormSettings.custom_fields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <Icon name="grip" className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-800">{field.label}</h4>
                        <p className="text-xs text-slate-500">{fieldTypeLabel(field.field_type)} field</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCustomFieldRequired(field.id)}
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${field.required ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}
                        aria-label={
                          field.required ? "Mark optional" : "Mark required"
                        }
                      >
                        {field.required ? "Required" : "Optional"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditCustomField(field)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:text-blue-600"
                        title="Edit field"
                        aria-label="Edit custom field"
                      >
                        <Icon name="edit" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(field.id)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-500 transition hover:bg-red-100"
                        title="Remove field"
                        aria-label="Delete custom field"
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </form>

          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7 lg:sticky lg:top-6 lg:self-start">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Icon name="file" className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-950">Live Form Preview</h3>
                <p className="text-sm text-slate-500">Customer-visible fields</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {DEFAULT_INTAKE_FIELD_META.filter((row) => defaultFieldEnabled(row.key)).map((field) => (
                <div
                  key={field.key}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <Icon name={field.icon} className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="text-sm font-bold text-slate-700">{field.label}</span>
                </div>
              ))}

              {intakeFormSettings.custom_fields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <Icon name="file" className="h-4 w-4 shrink-0 text-violet-600" />
                  <span className="text-sm font-bold text-slate-700">{field.label}</span>
                  <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {field.required && (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">
                        Required
                      </span>
                    )}
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-bold text-slate-600">
                      {fieldTypeLabel(field.field_type)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-sm font-black text-blue-950">Booking form is ready</p>
              <p className="mt-1 text-sm leading-6 text-blue-700">
                These fields will appear before appointment confirmation and can be saved to booking details.
              </p>
            </div>
          </div>
        </div>

        {/* Edit Custom Field Modal */}
        {showCustomFieldForm && editingCustomField && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 transition-opacity duration-200 ${showCustomFieldForm ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${showCustomFieldForm ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" onClick={handleCustomFieldFormCancel}/>
          <section className={`relative w-full max-w-3xl transform bg-white rounded-2xl shadow-2xl transition-all duration-300 ${showCustomFieldForm ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            <div className={`flex items-center justify-between border-b border-gray-200 px-6 py-4`}>
              <div>
                <h2 className={`text-lg font-semibold text-gray-800`}>Edit Custom Field</h2>
                <p className="text-xs text-slate-500 mt-1">Update field details</p>
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
                    {CUSTOM_FIELD_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
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
                    Update Field
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {alertMessage && (
        <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}
      </div>
    </div>
  );
}
