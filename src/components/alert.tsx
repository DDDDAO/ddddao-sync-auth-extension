import React from "react";

interface AlertProps {
  title: string;
  message: string;
  type: "confirm" | "info" | "error";
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose: () => void;
}

export function Alert({
  title,
  message,
  type,
  onConfirm,
  onCancel,
  onClose,
}: AlertProps) {
  const isConfirm = type === "confirm";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <h3
          className={`text-lg font-medium mb-2 ${
            type === "error"
              ? "text-red-600"
              : type === "info"
              ? "text-blue-600"
              : "text-gray-900"
          }`}
        >
          {title}
        </h3>
        <p className="text-gray-500 mb-4">{message}</p>
        <div className="flex justify-end space-x-2">
          {isConfirm && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
          )}
          <button
            onClick={isConfirm ? onConfirm : onClose}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
              type === "error"
                ? "bg-red-600 hover:bg-red-700"
                : type === "info"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {isConfirm ? "Confirm" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
