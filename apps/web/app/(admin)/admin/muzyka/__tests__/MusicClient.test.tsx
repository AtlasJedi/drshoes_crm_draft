import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MusicClient } from "../MusicClient";
import { MusicProvider } from "@/components/admin/music/MusicProvider";
import { PersistentMiniPlayer } from "@/components/admin/music/PersistentMiniPlayer";

// Capture the player ref methods + onEnd handler exposed by react-youtube.
const playerStub = {
  playVideo: vi.fn(),
  pauseVideo: vi.fn(),
  seekTo: vi.fn(),
  setVolume: vi.fn(),
  getCurrentTime: vi.fn(() => 0),
  getDuration: vi.fn(() => 0),
};
let capturedOnEnd: (() => void) | null = null;

vi.mock("react-youtube", () => ({
  default: (props: { videoId?: string; onEnd?: () => void; onReady?: (e: { target: typeof playerStub }) => void }) => {
    capturedOnEnd = props.onEnd ?? null;
    // simulate onReady so MusicProvider grabs the player ref synchronously
    setTimeout(() => props.onReady?.({ target: playerStub }), 0);
    return <div data-testid="yt-stub">{props.videoId}</div>;
  },
}));

const fetchMock = vi.fn();

// localStorage stub
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

beforeEach(() => {
  capturedOnEnd = null;
  Object.values(playerStub).forEach((m) => "mockClear" in m && (m as ReturnType<typeof vi.fn>).mockClear());
  fetchMock.mockReset();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.getItem.mockImplementation((key: string) => null); // default: empty
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("localStorage", localStorageMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllTimers();
});

function trackResponse(...ids: string[]) {
  return {
    ok: true,
    json: async () =>
      ids.map((id) => ({
        videoId: id,
        title: `Title ${id}`,
        channelTitle: "Chan",
        thumbnailUrl: `https://t/${id}.jpg`,
      })),
  } as Response;
}

/**
 * Render MusicClient + PersistentMiniPlayer (iframe host) wrapped in MusicProvider.
 * PersistentMiniPlayer must be in the tree so the yt-stub appears when a track is set.
 */
function renderWithProvider() {
  return render(
    <MusicProvider>
      <PersistentMiniPlayer />
      <MusicClient />
    </MusicProvider>
  );
}

describe("MusicClient", () => {
  it("debounces and calls searchMusic once after typing", async () => {
    fetchMock.mockResolvedValue(trackResponse("a"));
    renderWithProvider();
    const input = screen.getByLabelText("Szukaj muzyki");
    fireEvent.change(input, { target: { value: "lo" } });
    fireEvent.change(input, { target: { value: "lof" } });
    fireEvent.change(input, { target: { value: "lofi" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/music/search?q=lofi"),
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("clicking the first result with empty player sets it as current", async () => {
    fetchMock.mockResolvedValue(trackResponse("a", "b"));
    renderWithProvider();
    fireEvent.change(screen.getByLabelText("Szukaj muzyki"), { target: { value: "x" } });
    const row = await screen.findByRole("button", { name: /Title a/ });
    fireEvent.click(row);
    expect(await screen.findByTestId("yt-stub")).toHaveTextContent("a");
  });

  it("clicking a second result while playing appends to queue, does not replace", async () => {
    fetchMock.mockResolvedValue(trackResponse("a", "b"));
    renderWithProvider();
    fireEvent.change(screen.getByLabelText("Szukaj muzyki"), { target: { value: "x" } });
    fireEvent.click(await screen.findByRole("button", { name: /Title a/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Title b/ }));
    expect(screen.getByTestId("yt-stub")).toHaveTextContent("a");
    // queue chip exists
    expect(await screen.findByLabelText("Przejdź do: Title b")).toBeInTheDocument();
  });

  it("onEnd with queue advances; onEnd with empty queue clears", async () => {
    fetchMock.mockResolvedValue(trackResponse("a", "b"));
    renderWithProvider();
    fireEvent.change(screen.getByLabelText("Szukaj muzyki"), { target: { value: "x" } });
    fireEvent.click(await screen.findByRole("button", { name: /Title a/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Title b/ }));
    // simulate track A ending
    await waitFor(() => expect(capturedOnEnd).toBeTruthy());
    act(() => capturedOnEnd!());
    expect(screen.getByTestId("yt-stub")).toHaveTextContent("b");
    // simulate B ending (queue empty)
    act(() => capturedOnEnd!());
    expect(screen.queryByTestId("yt-stub")).toBeNull();
  });

  it("backend 503 shows the disabled banner", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "music_disabled" }),
    } as Response);
    renderWithProvider();
    fireEvent.change(screen.getByLabelText("Szukaj muzyki"), { target: { value: "x" } });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Klucz YouTube")
    );
  });

  // ── NEW: localStorage tests ──────────────────────────────────────────────

  it("localStorage hydration — provider mounts and restores current+queue from storage", async () => {
    const savedState = {
      current: { videoId: "saved1", title: "Saved Song", channelTitle: "SavedChan", thumbnailUrl: "https://t/saved1.jpg" },
      queue: [{ videoId: "saved2", title: "Queued Song", channelTitle: "SavedChan", thumbnailUrl: "https://t/saved2.jpg" }],
      volume: 65,
    };
    localStorageMock.getItem.mockImplementation((key: string) =>
      key === "drshoes.music.state" ? JSON.stringify(savedState) : null
    );

    renderWithProvider();

    // After mount, the current track from storage should be loaded
    expect(await screen.findByTestId("yt-stub")).toHaveTextContent("saved1");
    // The queued track should appear in the queue list
    expect(await screen.findByLabelText("Przejdź do: Queued Song")).toBeInTheDocument();
  });

  it("localStorage persistence — picking a track triggers a write to localStorage", async () => {
    fetchMock.mockResolvedValue(trackResponse("write1"));
    renderWithProvider();
    fireEvent.change(screen.getByLabelText("Szukaj muzyki"), { target: { value: "x" } });
    fireEvent.click(await screen.findByRole("button", { name: /Title write1/ }));
    // saveMusicState throttles at 1s; wait up to 2s for the write to land
    await waitFor(
      () =>
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          "drshoes.music.state",
          expect.stringContaining("write1")
        ),
      { timeout: 2000 }
    );
  });
});
