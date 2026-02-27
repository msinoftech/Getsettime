"use client";

interface AlertMessageProps {
  type: "success" | "error" | "info";
  title?: string;
  message: string;
  description?: string;
}

export default function AlertMessage({ type, title, message, description }: AlertMessageProps) {
  const styles = {
    success: {
      container: "bg-green-50 border-green-200 text-green-700",
      icon: "text-green-600",
      iconPath: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
    },
    error: {
      container: "bg-red-50 border-red-200 text-red-700",
      icon: "text-red-600",
      iconPath: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z",
    },
    info: {
      container: "bg-blue-50 border-blue-200 text-blue-700",
      icon: "text-blue-600",
      iconPath: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z",
    },
  };

  const style = styles[type];

  return (
    <div className={`border px-4 py-3 rounded-lg flex items-start ${style.container}`}>
      <svg className={`w-5 h-5 mr-2 mt-0.5 flex-shrink-0 ${style.icon}`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d={style.iconPath} clipRule="evenodd" />
      </svg>
      <div className="flex-1">
        {title && <p className="font-medium">{title}</p>}
        <p className={title ? "text-sm" : "text-sm"}>{message}</p>
        {description && <p className="text-sm mt-1">{description}</p>}
      </div>
    </div>
  );
}
