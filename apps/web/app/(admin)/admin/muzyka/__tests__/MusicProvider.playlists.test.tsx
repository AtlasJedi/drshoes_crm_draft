import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MusicProvider, useMusicContext } from "@/components/admin/music/MusicProvider";

// ── stub react-youtube so MusicProvider can mount ──────────────
vi.mock("react-youtube", () => ({
  default: () => <div data-testid="yt-stub" />,
}));

// ── localStorage stub ─────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  localStorageMock.getItem.mockImplementation(() => null);
  Object.values(localStorageMock).forEach((m) => (m as ReturnType<typeof vi.fn>).mockClear?.());
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("localStorage", localStorageMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllTimers();
});

// ── helper to consume context in a test component ─────────────

function PlaylistConsumer({ onSnapshot }: { onSnapshot: (s: unknown) => void }) {
  const ctx = useMusicContext();
  onSnapshot({ playlists: ctx.playlists, playlistsLoading: ctx.playlistsLoading });
  return (
    <div>
      <div data-testid="count">{ctx.playlists.length}</div>
      <button
        type="button"
        onClick={() => void ctx.createPlaylist("Test")}
        data-testid="btn-create"
      >
        Utwórz
      </button>
      <button
        type="button"
        onClick={() => void ctx.deletePlaylist("pl1")}
        data-testid="btn-delete"
      >
        Usuń
      </button>
    </div>
  );
}

function mockPlaylistsResponse(playlists: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => playlists,
  } as Response;
}

const SAMPLE_PLAYLISTS = [
  { id: "pl1", name: "Lo-fi", trackCount: 3, updatedAt: "2026-05-18T10:00:00Z" },
  { id: "pl2", name: "Klasyka", trackCount: 10, updatedAt: "2026-05-18T09:00:00Z" },
];

describe("MusicProvider — playlist actions", () => {
  it("reloadPlaylists fetches and populates state on mount", async () => {
    fetchMock.mockResolvedValueOnce(mockPlaylistsResponse(SAMPLE_PLAYLISTS));
    const snapshots: unknown[] = [];
    render(
      <MusicProvider>
        <PlaylistConsumer onSnapshot={(s) => snapshots.push(s)} />
      </MusicProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("2");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/music/playlists"),
      expect.objectContaining({ method: "GET" })
    );
  });

  it("createPlaylist posts and adds to state", async () => {
    // initial load returns empty
    fetchMock.mockResolvedValueOnce(mockPlaylistsResponse([]));
    // createPlaylist POST
    const newPl = { id: "pl-new", name: "Test", trackCount: 0, updatedAt: "2026-05-18T12:00:00Z" };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => newPl } as Response);

    render(
      <MusicProvider>
        <PlaylistConsumer onSnapshot={() => {}} />
      </MusicProvider>
    );
    // wait for initial load
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-create"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });
  });

  it("deletePlaylist removes playlist from state", async () => {
    // initial load returns two playlists
    fetchMock.mockResolvedValueOnce(mockPlaylistsResponse(SAMPLE_PLAYLISTS));
    // DELETE returns 204
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined } as Response);

    render(
      <MusicProvider>
        <PlaylistConsumer onSnapshot={() => {}} />
      </MusicProvider>
    );
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("2"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-delete"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });
  });
});
