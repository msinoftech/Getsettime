import type { IconType } from "react-icons";
import {
  FaAppleWhole,
  FaBaby,
  FaBone,
  FaBrain,
  FaBriefcase,
  FaBuilding,
  FaCalculator,
  FaComments,
  FaDroplet,
  FaDumbbell,
  FaEarListen,
  FaEye,
  FaGraduationCap,
  FaHandDots,
  FaHandHoldingMedical,
  FaHeartPulse,
  FaHospital,
  FaKitMedical,
  FaLaptopCode,
  FaLungs,
  FaPaw,
  FaPersonPregnant,
  FaPersonWalking,
  FaPills,
  FaRibbon,
  FaScaleBalanced,
  FaScissors,
  FaSpa,
  FaStethoscope,
  FaSyringe,
  FaTooth,
  FaUserDoctor,
  FaVial,
  FaVirus,
  FaWheelchair,
  FaXRay,
} from "react-icons/fa6";

export type department_icon_option = {
  id: string;
  label: string;
  Icon: IconType;
};

/** Ids are persisted (departments_list.icon, departments.meta_data.icon); never rename an existing id. */
export const DEPARTMENT_ICONS: department_icon_option[] = [
  { id: "building", label: "General", Icon: FaBuilding },
  { id: "hospital", label: "Hospital", Icon: FaHospital },
  { id: "stethoscope", label: "General medicine", Icon: FaStethoscope },
  { id: "doctor", label: "Doctor", Icon: FaUserDoctor },
  { id: "heart", label: "Cardiology", Icon: FaHeartPulse },
  { id: "brain", label: "Neurology", Icon: FaBrain },
  { id: "tooth", label: "Dental", Icon: FaTooth },
  { id: "eye", label: "Ophthalmology", Icon: FaEye },
  { id: "ear", label: "ENT", Icon: FaEarListen },
  { id: "lungs", label: "Pulmonology", Icon: FaLungs },
  { id: "bone", label: "Orthopedics", Icon: FaBone },
  { id: "skin", label: "Dermatology", Icon: FaHandDots },
  { id: "baby", label: "Pediatrics", Icon: FaBaby },
  { id: "pregnant", label: "Gynecology", Icon: FaPersonPregnant },
  { id: "droplet", label: "Hematology", Icon: FaDroplet },
  { id: "virus", label: "Infectious disease", Icon: FaVirus },
  { id: "ribbon", label: "Oncology", Icon: FaRibbon },
  { id: "xray", label: "Radiology", Icon: FaXRay },
  { id: "vial", label: "Laboratory", Icon: FaVial },
  { id: "syringe", label: "Vaccination", Icon: FaSyringe },
  { id: "pills", label: "Pharmacy", Icon: FaPills },
  { id: "first_aid", label: "Emergency", Icon: FaKitMedical },
  { id: "care", label: "Care", Icon: FaHandHoldingMedical },
  { id: "wheelchair", label: "Rehabilitation", Icon: FaWheelchair },
  { id: "physio", label: "Physiotherapy", Icon: FaPersonWalking },
  { id: "fitness", label: "Fitness", Icon: FaDumbbell },
  { id: "nutrition", label: "Nutrition", Icon: FaAppleWhole },
  { id: "spa", label: "Wellness", Icon: FaSpa },
  { id: "counseling", label: "Counseling", Icon: FaComments },
  { id: "veterinary", label: "Veterinary", Icon: FaPaw },
  { id: "salon", label: "Salon", Icon: FaScissors },
  { id: "education", label: "Education", Icon: FaGraduationCap },
  { id: "legal", label: "Legal", Icon: FaScaleBalanced },
  { id: "finance", label: "Finance", Icon: FaCalculator },
  { id: "business", label: "Business", Icon: FaBriefcase },
  { id: "tech", label: "Technology", Icon: FaLaptopCode },
];

export const DEFAULT_DEPARTMENT_ICON = "building";

const DEPARTMENT_ICON_BY_ID = new Map(DEPARTMENT_ICONS.map((o) => [o.id, o]));

export function parse_department_icon(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  return DEPARTMENT_ICON_BY_ID.has(id) ? id : null;
}

export function get_department_icon(raw: unknown): IconType {
  const id = parse_department_icon(raw) ?? DEFAULT_DEPARTMENT_ICON;
  return (DEPARTMENT_ICON_BY_ID.get(id) ?? DEPARTMENT_ICONS[0]).Icon;
}

export function DepartmentIcon({
  icon,
  className,
}: {
  icon: unknown;
  className?: string;
}) {
  const Icon = get_department_icon(icon);
  return <Icon className={className} aria-hidden />;
}

/** Grid picker shared by superadmin catalog and workspace department forms. */
export function DepartmentIconPicker({
  value,
  onChange,
  label = "Department icon",
}: {
  value: string | null;
  onChange: (next: string) => void;
  label?: string;
}) {
  const selectedId = parse_department_icon(value) ?? DEFAULT_DEPARTMENT_ICON;
  const selected = DEPARTMENT_ICON_BY_ID.get(selectedId);
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {selected ? <span className="text-xs text-slate-500">{selected.label}</span> : null}
      </div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
        {DEPARTMENT_ICONS.map(({ id, label: optionLabel, Icon }) => {
          const isSelected = id === selectedId;
          return (
            <button
              key={id}
              type="button"
              title={optionLabel}
              aria-label={optionLabel}
              aria-pressed={isSelected}
              onClick={() => onChange(id)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                isSelected
                  ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              <Icon className="h-4.5 w-4.5" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
