//src/components/Uploader.tsx
"use client";

import { useState, useRef } from "react";

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
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFileType = (index: number, kind: string) => {
    setFiles((prev) =>
      prev.map((fileWithType, i) =>
        i === index ? { ...fileWithType, kind } : fileWithType
      )
    );
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

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

      setFiles([]); // Clear files after successful upload
      if (fileInputRef.current) fileInputRef.current.value = ""; // Reset input
      if (onChanged) onChanged(); // Trigger parent callback
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload files.");
    }
  };

  const handleCancel = () => {
    setFiles([]); // Clear selected files
    if (fileInputRef.current) fileInputRef.current.value = ""; // Reset input
  };

  return (
    <div className="space-y-4">
      <div>
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={handleFileChange}
          className="block w-full text-sm text-black file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:text-black file:bg-gray-50 file:hover:bg-gray-100"
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
                className="text-sm text-black border border-gray-300 rounded-lg px-2 py-1"
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
                className="text-sm text-red-600 hover:text-red-800"
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
        <div className="flex gap-2">
          <button
            onClick={handleUpload}
            className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-50"
            disabled={files.length === 0}
          >
            Upload {files.length} File{files.length > 1 ? "s" : ""}
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 text-black hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}