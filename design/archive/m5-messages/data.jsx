// Sample fixtures for the M5 Messages design mock.
window.M5 = window.M5 || {};

window.M5.SHOP_TS = "07.05 · 14:32";

window.M5.THREADS = [
  {
    id: "t-101",
    client: "Magdalena Kowalska",
    rawSender: null,
    channel: "EMAIL",
    lastPreview: "Dzień dobry, czy buty będą gotowe na czwartek? Zależy mi na…",
    lastTs: "14:18",
    lastDay: "dziś",
    unread: 2,
    unmatched: false,
    selected: true,
    orderRef: "DR-1042",
  },
  {
    id: "t-102",
    client: "Filip Nowak",
    rawSender: null,
    channel: "SMS",
    lastPreview: "ok, super dzięki!",
    lastTs: "13:51",
    lastDay: "dziś",
    unread: 1,
    unmatched: false,
  },
  {
    id: "t-103",
    client: null,
    rawSender: "+48 506 220 119",
    channel: "SMS",
    lastPreview: "Dzień dobry, czy mogę przynieść kurtkę jutro o 15?",
    lastTs: "11:02",
    lastDay: "dziś",
    unread: 1,
    unmatched: true,
  },
  {
    id: "t-104",
    client: "Aleksandra Zając",
    rawSender: null,
    channel: "EMAIL",
    lastPreview: "Re: DR-1040 — przesyłam zdjęcia szczegółów, jak rozmawialiśmy.",
    lastTs: "wczoraj",
    lastDay: "wczoraj",
    unread: 0,
    unmatched: false,
  },
  {
    id: "t-105",
    client: null,
    rawSender: "kontakt@retro-buty.pl",
    channel: "EMAIL",
    lastPreview: "Współpraca B2B — zainteresowani usługą napraw hurtowych…",
    lastTs: "wczoraj",
    lastDay: "wczoraj",
    unread: 1,
    unmatched: true,
  },
  {
    id: "t-106",
    client: "Bartek Wiśniewski",
    rawSender: null,
    channel: "SMS",
    lastPreview: "Dzięki, do zobaczenia w piątek.",
    lastTs: "06.05",
    lastDay: "06.05",
    unread: 0,
    unmatched: false,
  },
  {
    id: "t-107",
    client: "Klaudia Lewandowska",
    rawSender: null,
    channel: "EMAIL",
    lastPreview: "Faktura — proszę o wystawienie na firmę…",
    lastTs: "05.05",
    lastDay: "05.05",
    unread: 0,
    unmatched: false,
  },
];

window.M5.SELECTED_LOG = [
  { id: "m1", dir: "INBOUND",  ts: "06.05 · 09:14", body: "Dzień dobry, oddałam u Państwa swoje dr martensy do wymiany podeszwy. Czy mogę dopytać o status?" },
  { id: "m2", dir: "OUTBOUND", ts: "06.05 · 11:02", status: "DELIVERED", body: "Cześć Magda! Buty są w realizacji — Tomek dziś rano kleił podeszwę. Powinno być gotowe na 10–12.05. Damy znać." },
  { id: "m3", dir: "INBOUND",  ts: "06.05 · 11:48", body: "Super, dzięki!" },
  { id: "m4", dir: "OUTBOUND", ts: "07.05 · 10:22", status: "FAILED", error: "Postmark: HardBounce — adres nieistniejący", body: "Hej, podeszwa już sklejona — wpadnij na czyszczenie głębokie po południu." },
  { id: "m5", dir: "INBOUND",  ts: "07.05 · 14:18", body: "Dzień dobry, czy buty będą gotowe na czwartek? Zależy mi na nich na wesele w sobotę. Pozdrawiam, Magda" },
];

window.M5.SELECTED_CLIENT = {
  name: "Magdalena Kowalska",
  email: "magdalena.kowalska@gmail.com",
  phone: "+48 602 113 224",
  channelDefault: "EMAIL",
  ordersTotal: 4,
  spent: "2 140 zł",
  recentOrder: { id: "DR-1042", status: "w realizacji", title: "DM 1460 — Vibram + czyszczenie" },
};
