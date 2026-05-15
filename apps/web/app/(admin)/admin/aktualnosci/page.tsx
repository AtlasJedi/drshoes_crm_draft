import { PlaceholderCard } from "@/app/(admin)/admin/clients/_components/PlaceholderCard";
import { AktualnosciPageHeaderSetter } from "./_components/AktualnosciPageHeaderSetter";

export default function AktualnosciPage() {
  return (
    <>
      <AktualnosciPageHeaderSetter />
      <PlaceholderCard
        title="Aktualności"
        body="Do implementacji w przyszłości"
        note="Zarządzane poza panelem; w kolejnym wydaniu pojawi się tu pełna obsługa."
      />
    </>
  );
}
