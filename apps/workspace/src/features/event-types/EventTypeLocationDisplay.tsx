import { LuBriefcase, LuMapPin, LuPhoneCall } from "react-icons/lu";
import {
  label_for_event_type_location,
  parse_event_type_location_types,
  type event_type_location_value,
} from "@/src/types/event_type_location";

function GoogleMeetIcon() {
  return (
    <svg
      className="h-4 w-auto shrink-0"
      viewBox="0 0 87.5 72"
      fill="none"
      aria-hidden
    >
      <path
        fill="#00832d"
        d="M49.5 36l8.53 9.75 11.47 7.33 2-17.02-2-16.64-11.69 6.44z"
      />
      <path
        fill="#0066da"
        d="M0 51.5V66c0 3.315 2.685 6 6 6h14.5l3-10.96-3-9.54-9.95-3z"
      />
      <path fill="#e94235" d="M20.5 0L0 20.5l10.55 3 9.95-3 2.95-9.41z" />
      <path fill="#2684fc" d="M20.5 20.5H0v31h20.5z" />
      <path
        fill="#00ac47"
        d="M82.6 8.68L69.5 19.42v33.66l13.16 10.79c1.97 1.54 4.85.135 4.85-2.37V11c0-2.535-2.945-3.925-4.91-2.32zM49.5 36v15.5h-29V72h43c3.315 0 6-2.685 6-6V53.08z"
      />
      <path
        fill="#ffba00"
        d="M63.5 0h-43v20.5h29V36l20-16.57V6c0-3.315-2.685-6-6-6z"
      />
    </svg>
  );
}

export function EventTypeLocationIcon({
  type,
  className = "h-4 w-4",
}: {
  type: event_type_location_value;
  className?: string;
}) {
  switch (type) {
    case "video":
      return <GoogleMeetIcon />;
    case "phone":
      return <PhoneCall className={className} />;
    case "in_person":
      return <MapPin className={className} />;
    case "custom":
      return <Briefcase className={className} />;
    default:
      return <MapPin className={className} />;
  }
}

function PhoneCall({ className = "h-4 w-4" }: { className?: string }) {
  return <LuPhoneCall className={`shrink-0 ${className}`} strokeWidth={2} />;
}

function MapPin({ className = "h-4 w-4" }: { className?: string }) {
  return <LuMapPin className={`shrink-0 ${className}`} strokeWidth={2} />;
}

function Briefcase({ className = "h-4 w-4" }: { className?: string }) {
  return <LuBriefcase className={`shrink-0 ${className}`} strokeWidth={2} />;
}

export function format_event_type_location_display_label(
  types: event_type_location_value[]
): string {
  if (types.length === 0) return "Not set";
  return types.map(label_for_event_type_location).join(" / ");
}

export function EventTypeLocationCell({
  location_type,
}: {
  location_type: string | null;
}) {
  const types = parse_event_type_location_types(location_type);

  if (types.length === 0) {
    return <span className="text-sm text-slate-400">Not set</span>;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-slate-700">
      <div className="flex shrink-0 items-center gap-1 text-slate-700">
        {types.map((type) => (
          <EventTypeLocationIcon key={type} type={type} />
        ))}
      </div>
      <span>{format_event_type_location_display_label(types)}</span>
    </div>
  );
}
