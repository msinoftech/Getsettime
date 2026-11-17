import Link from "next/link";
import Image from "next/image";

const ONBOARDING_STEPS = 4;

const STEP_COPY: Record<number, { title: string; description: string }> = {
  1: {
    title: "Profession & departments",
    description: "Loading your setup…",
  },
  2: {
    title: "Google Calendar Sync",
    description: "Loading calendar options…",
  },
  3: {
    title: "Working Hours",
    description: "Loading your availability…",
  },
  4: {
    title: "Meeting Options",
    description: "Loading meeting preferences…",
  },
};

function clampOnboardingStep(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : NaN;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(ONBOARDING_STEPS, Math.floor(n));
}

export function OnboardingBootstrapLoading({
  step,
}: {
  step?: string | number | null;
}) {
  const onboardingStep = clampOnboardingStep(step);
  const copy = STEP_COPY[onboardingStep] ?? STEP_COPY[1];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8">
      <div className="w-full max-w-7xl p-4 lg:px-6 relative z-10">
        <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <Image
              src="/getsettime-logo.svg"
              alt="GetSetTime Logo"
              width={200}
              height={50}
              className="mx-auto"
            />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Set up your workspace</h1>
          <p className="text-gray-600">
            Step {onboardingStep} of {ONBOARDING_STEPS}
          </p>
          <div className="flex justify-center gap-1 mt-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 max-w-[60px] rounded-full ${
                  s <= onboardingStep ? "bg-indigo-600" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>

        <div
          className="mx-auto max-w-xl rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-xl"
          role="status"
          aria-live="polite"
          aria-label={copy.description}
        >
          <div
            className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
            aria-hidden
          />
          <p className="text-lg font-semibold text-gray-800">{copy.title}</p>
          <p className="mt-2 text-sm text-gray-500">{copy.description}</p>
        </div>
      </div>
    </div>
  );
}
