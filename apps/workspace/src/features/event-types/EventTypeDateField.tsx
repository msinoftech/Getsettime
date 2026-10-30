"use client";

import {
  DateTimePicker,
  type date_time_picker_props,
} from "@/src/components/molecules/DateTimePicker";

type EventTypeDateFieldProps = Omit<date_time_picker_props, "date" | "time">;

export function EventTypeDateField(props: EventTypeDateFieldProps) {
  return <DateTimePicker {...props} date time={false} />;
}
