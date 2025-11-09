// frontend/src/features/admin/__tests__/EscrowCard.test.tsx
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// 1) Mock the escrow API BEFORE importing the component (no outer vars in factory)
vi.mock("../../escrow/api", () => ({
  MIN_READY_MICROALGOS: 1_000_000n,
  getEscrowAddress: vi.fn(),
  getEscrowBalance: vi.fn(),
  formatAlgos: (micro: bigint) => (Number(micro) / 1_000_000).toFixed(4),
  networkExplorerUrl: vi.fn(() => null),
}));

// 2) Import mocked module and component AFTER the mock
import * as escrowApi from "../../escrow/api";
import { EscrowCard } from "../EscrowCard";

describe("EscrowCard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders not-configured state when no address", () => {
    (escrowApi.getEscrowAddress as unknown as vi.Mock).mockReturnValue(null);
    render(<EscrowCard />);

    expect(screen.getByText(/Escrow \(Compile & Fund\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Not configured/i)).toBeInTheDocument();
    expect(screen.getByText(/Generate escrow via/i)).toBeInTheDocument();
  });

  it("shows needs funding badge when balance is below threshold", async () => {
    (escrowApi.getEscrowAddress as unknown as vi.Mock).mockReturnValue("ADDR");
    (escrowApi.getEscrowBalance as unknown as vi.Mock).mockResolvedValue(0n);

    render(<EscrowCard />);
    await waitFor(() => expect(screen.getByText(/Needs funding/i)).toBeInTheDocument());
    expect(screen.getByText(/0\.0000 ALGO/)).toBeInTheDocument();
  });

  it("shows ready badge when balance meets threshold", async () => {
    (escrowApi.getEscrowAddress as unknown as vi.Mock).mockReturnValue("ADDR");
    (escrowApi.getEscrowBalance as unknown as vi.Mock).mockResolvedValue(2_000_000n);

    render(<EscrowCard />);
    await waitFor(() => expect(screen.getByText(/Ready/i)).toBeInTheDocument());
    expect(screen.getByText(/2\.0000 ALGO/)).toBeInTheDocument();
  });

  it("renders error + retry when indexer fails", async () => {
    (escrowApi.getEscrowAddress as unknown as vi.Mock).mockReturnValue("ADDR");
    (escrowApi.getEscrowBalance as unknown as vi.Mock)
      .mockRejectedValueOnce(new Error("Indexer offline"))
      .mockResolvedValueOnce(2_000_000n);

    render(<EscrowCard />);
    await waitFor(() =>
      expect(screen.getByText(/Unable to determine balance/i)).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() => expect(screen.getByText(/2\.0000 ALGO/)).toBeInTheDocument());
  });

  it("copies address when copy button clicked", async () => {
    (escrowApi.getEscrowAddress as unknown as vi.Mock).mockReturnValue("ADDR123");
    (escrowApi.getEscrowBalance as unknown as vi.Mock).mockResolvedValue(0n);

    render(<EscrowCard />);
    await waitFor(() => expect(screen.getByLabelText(/copy escrow address/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/copy escrow address/i));

    expect((navigator.clipboard.writeText as unknown as vi.Mock)).toHaveBeenCalledWith("ADDR123");
  });
});
