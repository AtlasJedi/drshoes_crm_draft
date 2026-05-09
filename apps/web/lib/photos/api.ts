import { api } from "@/lib/api";
import { createLogger } from "@/lib/log";
import type { Photo, PhotoLabel } from "./types";

const log = createLogger("photos-api");

/** GET /admin/orders/{orderId}/photos — list all photos for an order. */
export async function listPhotos(orderId: string): Promise<Photo[]> {
  log.info("op=photos.list", { orderId });
  return api.get<Photo[]>(`/admin/orders/${orderId}/photos`);
}

/** POST /admin/orders/{orderId}/photos — upload a new photo (multipart). */
export async function uploadPhoto(
  orderId: string,
  file: File,
  label: PhotoLabel,
  orderItemId: string | null = null,
): Promise<Photo> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("label", label);
  if (orderItemId) fd.append("orderItemId", orderItemId);
  log.info("op=photos.upload.start", { orderId, name: file.name, sizeBytes: file.size, label });
  return api.postFormData<Photo>(`/admin/orders/${orderId}/photos`, fd);
}

/** PATCH /admin/photos/{photoId} — update the label of an existing photo. */
export async function relabelPhoto(photoId: string, label: PhotoLabel): Promise<Photo> {
  log.info("op=photos.relabel", { photoId, label });
  return api.patch<Photo>(`/admin/photos/${photoId}`, { label });
}

/** DELETE /admin/photos/{photoId} — permanently delete a photo. */
export async function deletePhoto(photoId: string): Promise<void> {
  log.info("op=photos.delete", { photoId });
  return api.delete<void>(`/admin/photos/${photoId}`);
}
