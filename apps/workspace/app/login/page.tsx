import { Suspense } from "react";
import LoginForm from "./LoginForm";

function LoginFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="w-full max-w-md px-6 flex justify-center">
        <div className="animate-pulse w-full bg-white rounded-2xl shadow-xl p-8 space-y-5 border border-gray-100">
          <div className="h-10 bg-gray-200 rounded w-3/4 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
