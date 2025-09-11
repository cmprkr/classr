// lib/paths.ts
import path from "path";
export const DATA_DIR = process.env.DATA_DIR || "./data";
export const uploadsPath = (...p: string[]) => path.join(DATA_DIR, "uploads", ...p);
export const artifactsPath = (...p: string[]) => path.join(DATA_DIR, "artifacts", ...p);
