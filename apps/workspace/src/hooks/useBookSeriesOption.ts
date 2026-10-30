import { useEffect, useState } from 'react';
import type { EventType } from '@/src/types/bookingForm';
import { should_create_customer_series } from '@/src/features/booking-flow';

export function useBookSeriesOption(params: {
  selectedType: EventType | null;
  /** When false, hides the option (e.g. embed reschedule). Defaults to true. */
  enabled?: boolean;
}) {
  const [bookSeries, setBookSeries] = useState(false);
  const enabled = params.enabled ?? true;
  const showBookSeriesOption =
    enabled && should_create_customer_series(params.selectedType);

  useEffect(() => {
    setBookSeries(false);
  }, [params.selectedType?.id]);

  return {
    bookSeries,
    setBookSeries,
    showBookSeriesOption,
  };
}
