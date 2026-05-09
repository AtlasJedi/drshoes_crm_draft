"use client";

// TODO(3-10): Full implementation — multi-file upload with label picker and progress list.
// This is a placeholder stub that satisfies imports from OrderDrawerPhotos.

interface Props {
  orderId: string;
  onUploaded: () => void;
}

export function PhotoUploader({ orderId: _orderId, onUploaded: _onUploaded }: Props) {
  return (
    <p className="text-xs text-admin-mute italic">Przesyłanie zdjęć — wkrótce dostępne.</p>
  );
}
