"use client";

import {
  DateTimePicker,
  type date_time_picker_props,
} from "@/src/components/molecules/DateTimePicker";

type EventTypeDateTimeFieldProps = Omit<
  date_time_picker_props,
  "date" | "time"
>;

export function EventTypeDateTimeField(props: EventTypeDateTimeFieldProps) {
  return <DateTimePicker {...props} date time />;
}
