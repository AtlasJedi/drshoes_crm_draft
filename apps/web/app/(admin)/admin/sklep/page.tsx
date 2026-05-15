import { PlaceholderCard } from "@/app/(admin)/admin/clients/_components/PlaceholderCard";
import { SklepPageHeaderSetter } from "./_components/SklepPageHeaderSetter";

export default function SklepPage() {
  return (
    <>
      <SklepPageHeaderSetter />
      <PlaceholderCard
        title="Sklep"
        body="Do implementacji w przyszłości"
        note="Zarządzane poza panelem; w kolejnym wydaniu pojawi się tu pełna obsługa."
      />
    </>
  );
}
