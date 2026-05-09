export type PhotoLabel = "BEFORE" | "IN_PROGRESS" | "AFTER" | "OTHER";

export interface Photo {
  id: string;
  orderId: string;
  orderItemId: string | null;
  uploadedBy: string;
  uploadedAt: string;          // ISO-8601
  mime: string;
  sizeBytes: number;
  label: PhotoLabel;
  originalFilename: string;
  fileUrl: string;             // /api/admin/photos/{id}/file
}

export const PHOTO_LABEL_PL: Record<PhotoLabel, string> = {
  BEFORE: "Przed",
  IN_PROGRESS: "W trakcie",
  AFTER: "Po",
  OTHER: "Inne",
};

export const PHOTO_LABELS: PhotoLabel[] = ["BEFORE", "IN_PROGRESS", "AFTER", "OTHER"];
