// Small atoms reused across the messages design.
window.M5 = window.M5 || {};

// Channel chip — EMAIL / SMS
window.M5.ChannelChip = function ChannelChip({ channel, className = "" }) {
  const cls = channel === "EMAIL"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-violet-50 text-violet-700 border-violet-200";
  return (
    <span className={"inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border " + cls + " " + className}>
      {channel === "EMAIL" ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      )}
      {channel}
    </span>
  );
};

// Message status badge — reuses existing component visual
window.M5.MessageStatusBadge = function MessageStatusBadge({ status }) {
  const map = {
    QUEUED:    { label: "Kolejka",       cls: "bg-neutral-200 text-neutral-700" },
    SENT:      { label: "Wysłane",       cls: "bg-blue-100 text-blue-800" },
    DELIVERED: { label: "Doręczone",     cls: "bg-green-100 text-green-800" },
    READ:      { label: "Przeczytane",   cls: "bg-green-100 text-green-800" },
    FAILED:    { label: "Niedoręczone",  cls: "bg-red-50 text-red-700 ring-1 ring-red-200" },
  };
  const m = map[status] || map.SENT;
  return <span className={"inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded " + m.cls}>{m.label}</span>;
};

// Filter chip with count
window.M5.FilterChip = function FilterChip({ active, label, count }) {
  return (
    <button
      className={
        "h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium border transition-colors " +
        (active
          ? "bg-ink text-paper border-ink"
          : "bg-white text-ink border-admin-line hover:bg-admin-hover")
      }>
      {label}
      {typeof count === "number" && (
        <span className={
          "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold " +
          (active ? "bg-acid text-ink" : "bg-admin-line text-admin-mute")
        }>{count}</span>
      )}
    </button>
  );
};

// Avatar disc with initials
window.M5.Avatar = function Avatar({ name, raw, size = 32 }) {
  const initials = name
    ? name.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  return (
    <div
      className={
        (name ? "bg-ink text-paper" : "bg-pink-100 text-pink-700 ring-1 ring-pink-300")
        + " flex items-center justify-center rounded-full font-semibold shrink-0"
      }
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {name ? initials : (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
      )}
    </div>
  );
};

// Tiny icon-only button (Radix tooltip target in real impl)
window.M5.IconBtn = function IconBtn({ children, label, onClick, variant = "ghost" }) {
  const cls = variant === "ghost"
    ? "hover:bg-admin-hover text-admin-mute hover:text-ink"
    : "bg-white border border-admin-line hover:bg-admin-hover";
  return (
    <button title={label} className={"h-8 w-8 rounded-md inline-flex items-center justify-center " + cls}>
      {children}
    </button>
  );
};
