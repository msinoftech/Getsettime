"use client";

/**
 * @deprecated Use `toast` from `@/src/components/ui/toast` for transient feedback.
 * ConfirmModal remains the choice for destructive confirmations.
 */
interface AlertModalProps {
  message: string;
  onClose: () => void;
}

export function AlertModal({ message, onClose }: AlertModalProps) {
  return (
    <div
      className="fixed inset-0 z-100001 h-full flex items-center justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <p className="text-slate-700">{message}</p>
          <div className="flex justify-end mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
