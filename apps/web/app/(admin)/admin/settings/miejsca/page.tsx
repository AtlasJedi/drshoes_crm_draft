"use client";

import { useEffect, useState } from "react";
import { listLocations, deactivateLocation } from "@/lib/locations";
import type { StorageLocation } from "@/lib/types";
import { LocationsList } from "./_components/LocationsList";
import { LocationFormModal } from "./_components/LocationFormModal";
import { createLogger } from "@/lib/log";
import { usePageHeader } from "../../_components/PageHeaderContext";

const log = createLogger("settings/miejsca");

export default function MiejscaPage() {
  usePageHeader({ title: "Miejsca", subtitle: "gdzie leżą zlecenia w pracowni" });
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [editing, setEditing] = useState<StorageLocation | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function reload() {
    log.debug("op=reload");
    setLocations(await listLocations({ includeInactive: true }));
  }

  useEffect(() => { reload(); }, []);

  async function handleDeactivate(l: StorageLocation) {
    if (!confirm(`Dezaktywować "${l.name}"?`)) return;
    await deactivateLocation(l.id);
    reload();
  }

  return (
    <div className="admin-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="t-display text-[22px]">Miejsca w pracowni</h2>
        <button className="btn-clean primary" onClick={() => setShowAdd(true)}>
          + dodaj miejsce
        </button>
      </div>
      <LocationsList
        locations={locations}
        onEdit={setEditing}
        onDeactivate={handleDeactivate}
      />
      {showAdd && (
        <LocationFormModal onClose={(saved) => { setShowAdd(false); if (saved) reload(); }} />
      )}
      {editing && (
        <LocationFormModal
          target={editing}
          onClose={(saved) => { setEditing(null); if (saved) reload(); }}
        />
      )}
    </div>
  );
}
