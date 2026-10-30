"use client";

import {
  DateTimePicker,
  type date_time_picker_props,
} from "@/src/components/molecules/DateTimePicker";

type EventTypeTimeFieldProps = Pick<
  date_time_picker_props,
  "value" | "onChange" | "invalid" | "error_id" | "focus_key"
>;

export function EventTypeTimeField(props: EventTypeTimeFieldProps) {
  return <DateTimePicker {...props} date={false} time />;
}
