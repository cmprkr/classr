// src/components/Uploader.tsx
"use client";

import { useState, useRef, useEffect } from "react";

type FileWithType = {
  file: File;
  kind: string;
};

export default function Uploader({
  classId,
  onChanged,
}: {
  classId: string;
  onChanged?: () => void;
}) {
  const [files, setFiles] = useState<FileWithType[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [spinner, setSpinner] = useState("|");
  const spinnerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resourceTypes = [
    "LECTURE",
    "SLIDESHOW",
    "NOTES",
    "HANDOUT",
    "GRADED_ASSIGNMENT",
    "UNGRADED_ASSIGNMENT",
    "GRADED_TEST",
    "OTHER",
  ];

  // ASCII spinner animation (matches RecorderPanel)
  useEffect(() => {
    if (isUploading) {
      const spinnerChars = ["|", "/", "-", "\\"];
      let index = 0;
      spinnerIntervalRef.current = setInterval(() => {
        setSpinner(spinnerChars[index]);
        index = (index + 1) % spinnerChars.length;
      }, 100);
    } else {
      if (spinnerIntervalRef.current) clearInterval(spinnerIntervalRef.current);
      setSpinner("|");
    }
    return () => {
      if (spinnerIntervalRef.current) clearInterval(spinnerIntervalRef.current);
    };
  }, [isUploading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file) => ({
        file,
        kind: "LECTURE", // Default type
      }));
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    if (isUploading) return;
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFileType = (index: number, kind: string) => {
    if (isUploading) return;
    setFiles((prev) =>
      prev.map((fileWithType, i) =>
        i === index ? { ...fileWithType, kind } : fileWithType
      )
    );
  };

  const handleUpload = async () => {
    if (files.length === 0 || isUploading) return;

    setIsUploading(true);
    try {
      for (const { file, kind } of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("classId", classId);
        formData.append(`kind_${file.name}`, kind);

        const response = await fetch("/api/classes/" + classId + "/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }
      }

      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onChanged?.();
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload files.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    if (isUploading) return;
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div>
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={isUploading}
          className="block w-full text-sm text-black file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:text-black file:bg-gray-50 file:hover:bg-gray-100 disabled:opacity-50"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileWithType, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 border border-gray-300 rounded-lg bg-gray-50"
            >
              <span className="flex-1 text-sm text-black truncate">
                {fileWithType.file.name}
              </span>
              <select
                value={fileWithType.kind}
                onChange={(e) => updateFileType(index, e.target.value)}
                disabled={isUploading}
                className="text-sm text-black border border-gray-300 rounded-lg px-2 py-1 disabled:opacity-50"
              >
                {resourceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type
                      .toLowerCase()
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeFile(index)}
                disabled={isUploading}
                className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                title="Remove file"
              >
                <img
                  src="/icons/trash.svg"
                  alt="Remove"
                  className="w-4 h-4"
                />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleUpload}
            className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-50"
            disabled={files.length === 0 || isUploading}
          >
            {isUploading
              ? "Uploading…"
              : `Upload ${files.length} File${files.length > 1 ? "s" : ""}`}
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 text-black hover:bg-gray-100 disabled:opacity-50"
            disabled={isUploading}
          >
            Cancel
          </button>

          {/* Inline uploading indicator (RecorderPanel-style) */}
          {isUploading && (
            <div
              className="text-sm text-gray-700 inline-flex items-center gap-2"
              aria-live="polite"
            >
              <span className="inline-block w-4 text-center font-mono">{spinner}</span>
              <span>Uploading files…</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
