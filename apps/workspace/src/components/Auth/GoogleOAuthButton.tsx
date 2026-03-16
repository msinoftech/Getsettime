"use client";

interface GoogleOAuthButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}

export default function GoogleOAuthButton({
  onClick,
  disabled = false,
  loading = false,
  label = "Continue with Google",
}: GoogleOAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full bg-white text-gray-700 py-3 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="flex items-center justify-center gap-3">
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Connecting...
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.73 1.22 9.24 3.62l6.9-6.9C35.9 2.4 30.3 0 24 0 14.6 0 6.52 5.38 2.56 13.22l8.03 6.24C12.6 13.5 17.8 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.1 24.5c0-1.64-.15-3.22-.43-4.75H24v9h12.4c-.54 2.9-2.2 5.36-4.72 7.03l7.2 5.58C43.2 37.2 46.1 31.4 46.1 24.5z"
              />
              <path
                fill="#FBBC05"
                d="M10.6 28.54c-.5-1.5-.78-3.1-.78-4.74s.28-3.24.78-4.74l-8.03-6.24C.93 16.6 0 20.2 0 23.8s.93 7.2 2.56 10.02l8.03-6.28z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.3 0 11.6-2.08 15.46-5.64l-7.2-5.58c-2 1.35-4.56 2.15-8.26 2.15-6.2 0-11.4-4-13.3-9.6l-8.03 6.28C6.52 42.62 14.6 48 24 48z"
              />
            </svg>
            {label}
          </>
        )}
      </span>
    </button>
  );
}
