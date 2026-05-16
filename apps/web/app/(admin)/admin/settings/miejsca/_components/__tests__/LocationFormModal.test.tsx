import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LocationFormModal } from "../LocationFormModal";

vi.mock("@/lib/locations", () => ({
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}));

import * as api from "@/lib/locations";

const TARGET = { id: 5, name: "półka 1", position: 0, active: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LocationFormModal", () => {
  it("add happy path — calls createLocation with bare string and closes", async () => {
    vi.mocked(api.createLocation).mockResolvedValue({
      id: 99,
      name: "nowa",
      position: 0,
      active: true,
    });
    const onClose = vi.fn();
    render(<LocationFormModal onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/nazwa/i), { target: { value: "nowa" } });
    fireEvent.click(screen.getByRole("button", { name: /zapisz/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(api.createLocation).toHaveBeenCalledWith("nowa");
  });

  it("409 conflict — shows Polish duplicate error message", async () => {
    const conflictErr = Object.assign(new Error("conflict"), {
      code: "location_name_conflict",
      status: 409,
    });
    vi.mocked(api.createLocation).mockRejectedValue(conflictErr);
    const onClose = vi.fn();
    render(<LocationFormModal onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/nazwa/i), { target: { value: "duplikat" } });
    fireEvent.click(screen.getByRole("button", { name: /zapisz/i }));

    await waitFor(() =>
      expect(screen.getByText(/już istnieje/i)).toBeInTheDocument(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("edit pre-fill — shows target name and calls updateLocation", async () => {
    vi.mocked(api.updateLocation).mockResolvedValue({
      id: 5,
      name: "renamed",
      position: 0,
      active: true,
    });
    const onClose = vi.fn();
    render(<LocationFormModal target={TARGET} onClose={onClose} />);

    const input = screen.getByLabelText(/nazwa/i);
    expect((input as HTMLInputElement).value).toBe("półka 1");

    fireEvent.change(input, { target: { value: "renamed" } });
    fireEvent.click(screen.getByRole("button", { name: /zapisz/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(api.updateLocation).toHaveBeenCalledWith(5, { name: "renamed" });
  });
});
