export default function BookingDetailsRedesign() {
    const booking = {
      id: 207,
      createdAt: 'Apr 14, 2026 at 05:15 PM',
      status: 'Confirmed',
      invitee: {
        name: 'Kuldeep',
        email: 'er.kuldeepbhullar@gmail.com',
        phone: '9988274974',
      },
      eventType: '30mins-chat',
      duration: '30 mins',
      provider: 'Kuldeep Singh',
      hostPhone: 'N/A',
      start: 'Apr 17, 2026, 10:00 AM',
      end: 'Apr 17, 2026, 10:30 AM',
      customerNote: 'Hello\n\nI need to visit for regular health',
      adminNotice:
        'Client requested regular health consultation. Please verify documents before check-in and confirm if any reports are required.',
    };
  
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-5 md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                    Booking Details
                  </h1>
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                    {booking.status}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">
                    ID #{booking.id}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">Created on {booking.createdAt}</p>
              </div>
  
              <div className="flex flex-wrap gap-2">
                <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                  Print
                </button>
                <button className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-100">
                  Send Reminder
                </button>
                <button className="rounded-xl border border-indigo-200 bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700">
                  Schedule Follow-up
                </button>
                <button className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-500 transition hover:bg-slate-50">
                  ✕
                </button>
              </div>
            </div>
          </div>
  
          <div className="grid gap-6 p-6 md:grid-cols-3 md:p-8">
            <div className="space-y-6 md:col-span-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                    Invitee Information
                  </h2>
                  <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    Edit Invitee
                  </button>
                </div>
  
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoCard label="Name" value={booking.invitee.name} />
                  <InfoCard label="Phone" value={booking.invitee.phone} />
                  <div className="sm:col-span-2">
                    <InfoCard label="Email" value={booking.invitee.email} />
                  </div>
                </div>
              </section>
  
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                    Booking Information
                  </h2>
                  <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    Edit Booking
                  </button>
                </div>
  
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoCard label="Event Type" value={`${booking.eventType} (${booking.duration})`} />
                  <InfoCard label="Service Provider" value={booking.provider} />
                  <InfoCard label="Host Contact" value={booking.hostPhone} />
                  <InfoCard label="Status" value={booking.status} badge />
                </div>
              </section>
  
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                    Date & Time
                  </h2>
                  <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    Reschedule
                  </button>
                </div>
  
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoCard label="Start Date / Time" value={booking.start} />
                  <InfoCard label="End Date / Time" value={booking.end} />
                </div>
              </section>
  
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                  Notes & Additional Information
                </h2>
  
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700 whitespace-pre-line">
                  {booking.customerNote}
                </div>
              </section>
            </div>
  
            <div className="space-y-6">
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-amber-800">
                    Admin Notice
                  </h2>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    Internal Only
                  </span>
                </div>
  
                <textarea
                  defaultValue={booking.adminNotice}
                  className="min-h-[180px] w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:border-amber-400"
                  placeholder="Add internal remarks for admins or staff..."
                />
  
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600">
                    Save Notice
                  </button>
                  <button className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100">
                    Clear
                  </button>
                </div>
              </section>
  
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                  Quick Actions
                </h2>
  
                <div className="grid gap-3">
                  <button className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                    View Activity Log
                  </button>
                  <button className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                    Copy Booking Link
                  </button>
                  <button className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm font-medium text-emerald-700 transition hover:bg-emerald-100">
                    Mark as Completed
                  </button>
                  <button className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-left text-sm font-medium text-yellow-700 transition hover:bg-yellow-100">
                    Mark as No-show
                  </button>
                  <button className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-700 transition hover:bg-red-100">
                    Cancel Booking
                  </button>
                  <button className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                    Delete Booking
                  </button>
                </div>
              </section>
  
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                  Booking Summary
                </h2>
                <div className="space-y-3 text-sm text-slate-600">
                  <SummaryRow label="Booking ID" value={`#${booking.id}`} />
                  <SummaryRow label="Provider" value={booking.provider} />
                  <SummaryRow label="Duration" value={booking.duration} />
                  <SummaryRow label="Status" value={booking.status} />
                </div>
              </section>
            </div>
          </div>
  
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 md:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                Close
              </button>
              <button className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100">
                Edit Booking
              </button>
              <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  function InfoCard({
    label,
    value,
    badge = false,
  }: {
    label: string;
    value: string;
    badge?: boolean;
  }) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
        {badge ? (
          <div className="mt-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
            {value}
          </div>
        ) : (
          <p className="mt-2 text-base font-medium text-slate-800">{value}</p>
        )}
      </div>
    );
  }
  
  function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <span className="font-medium text-slate-500">{label}</span>
        <span className="text-right font-semibold text-slate-800">{value}</span>
      </div>
    );
  }
  