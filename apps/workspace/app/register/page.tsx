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
    redirect("/api/auth/google?signup=1&calendar=1");
  }

  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterForm />
    </Suspense>
  );
}