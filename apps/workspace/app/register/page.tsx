import { Suspense } from "react";
import { redirect } from "next/navigation";
import RegisterForm from "./RegisterForm";

function RegisterFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );
}

type RegisterPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const gSignup = params?.g_signup;
  const isGoogleSignup =
    gSignup === "1" || (Array.isArray(gSignup) && gSignup.includes("1"));

  if (isGoogleSignup) {
    const claimRaw = params?.claim_code;
    const claimCode =
      typeof claimRaw === "string"
        ? claimRaw
        : Array.isArray(claimRaw)
          ? claimRaw[0]
          : "";
    const googleUrl = new URL("/api/auth/google", "http://local");
    googleUrl.searchParams.set("signup", "1");
    googleUrl.searchParams.set("calendar", "1");
    if (claimCode?.trim()) {
      googleUrl.searchParams.set("claim_code", claimCode.trim());
    }
    redirect(googleUrl.pathname + googleUrl.search);
  }

  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterForm />
    </Suspense>
  );
}