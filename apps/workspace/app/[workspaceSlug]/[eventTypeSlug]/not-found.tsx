export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-8 px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Event Type Not Found</h1>
        <p className="text-gray-600 mb-6">
          The event type you're looking for doesn't exist or is no longer available.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Go to Homepage
        </a>
      </div>
    </div>
  );
}
