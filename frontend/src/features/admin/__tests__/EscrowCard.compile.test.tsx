import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToastProvider } from "../../../components/Toaster";

const TRUNCATED_LABEL = "[truncated] showing last 2000 lines";

vi.mock("../../escrow/api", () => ({
  MIN_READY_MICROALGOS: 1_000_000n,
  getEscrowAddress: vi.fn(() => "ADDR123"),
  getEscrowBalance: vi.fn(() => Promise.resolve(2_000_000n)),
  formatAlgos: (micro: bigint) => (Number(micro) / 1_000_000).toFixed(4),
  networkExplorerUrl: vi.fn(() => null),
}));

vi.mock("../../../lib/api/compileEscrowStream", () => ({
  compileEscrowStream: vi.fn(),
}));

import * as escrowApi from "../../escrow/api";
import { compileEscrowStream } from "../../../lib/api/compileEscrowStream";
import { EscrowCard } from "../EscrowCard";

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

const mockStream = (events: Array<string | { done: true; ok: boolean; escrow?: string }>) => {
  (compileEscrowStream as unknown as vi.Mock).mockImplementationOnce(async function* () {
    for (const event of events) {
      yield event;
    }
  });
};

describe("EscrowCard compile streaming", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (escrowApi.getEscrowAddress as unknown as vi.Mock).mockReturnValue("ADDR123");
    (escrowApi.getEscrowBalance as unknown as vi.Mock).mockResolvedValue(2_000_000n);
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("streams logs and reports success with escrow pill", async () => {
    const onCompiled = vi.fn();
    mockStream([
      "starting algokit compile",
      "step 2/3: linking...",
      { done: true, ok: true, escrow: "XPLQ...7S3" },
    ]);

    render(<EscrowCard onEscrowCompiled={onCompiled} />, { wrapper });
    const compileBtn = screen.getByRole("button", { name: /Compile Escrow/i });
    fireEvent.click(compileBtn);
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText(/starting algokit compile/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/\[done] compile succeeded/i)).toBeInTheDocument());
    expect(screen.getByText(/Escrow: XPLQ\.\.\.7S3/)).toBeInTheDocument();
    expect(onCompiled).toHaveBeenCalledWith("XPLQ...7S3");
    expect(compileEscrowStream).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Cancel/i })).not.toBeInTheDocument()
    );
    expect(compileBtn).not.toBeDisabled();
  });

  it("marks failure when stream ends with error", async () => {
    mockStream([
      "starting algokit compile",
      "error: pyteal compile failed",
      { done: true, ok: false },
    ]);
    render(<EscrowCard />, { wrapper });
    const compileBtn = screen.getByRole("button", { name: /Compile Escrow/i });
    fireEvent.click(compileBtn);

    await waitFor(() => expect(screen.getByText(/\[error] compile failed/)).toBeInTheDocument());
    expect(screen.getByText(/Failed/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Cancel/i })).not.toBeInTheDocument()
    );
    expect(compileBtn).not.toBeDisabled();
  });

  it("handles cancellation gracefully", async () => {
    (compileEscrowStream as unknown as vi.Mock).mockImplementationOnce(async function* (signal?: AbortSignal) {
      yield "starting";
      await new Promise((resolve, reject) => {
        if (!signal) return;
        signal.addEventListener(
          "abort",
          () => {
            reject(new Error("Aborted"));
          },
          { once: true }
        );
      });
    });
    render(<EscrowCard />, { wrapper });
    const compileBtn = screen.getByRole("button", { name: /Compile Escrow/i });
    fireEvent.click(compileBtn);
    await waitFor(() => expect(screen.getByText(/starting/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    await waitFor(() =>
      expect(screen.getByText(/\[canceled] compile aborted by user/)).toBeInTheDocument()
    );
    expect(screen.getByText(/Canceled/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel/i })).not.toBeInTheDocument();
    expect(compileBtn).not.toBeDisabled();
  });

  it("caps log buffer and shows truncated marker", async () => {
    const events: Array<string | { done: true; ok: boolean }> = [];
    for (let i = 0; i < 2050; i++) {
      events.push(`line ${i}`);
    }
    events.push({ done: true, ok: true });
    mockStream(events);
    render(<EscrowCard />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Compile Escrow/i }));

    await waitFor(() => expect(screen.getByText(/\[done] compile succeeded/)).toBeInTheDocument());
    const logContainer = screen.getByTestId("compile-log-container");
    expect(logContainer.textContent?.includes(TRUNCATED_LABEL)).toBe(true);
    const lineCount = logContainer.textContent?.split("\n").length ?? 0;
    expect(lineCount).toBeLessThanOrEqual(2000);
  });

  it("shows new output pill when user scrolls away from bottom", async () => {
    let resume!: () => void;
    (compileEscrowStream as unknown as vi.Mock).mockImplementationOnce(async function* () {
      yield "first chunk";
      await new Promise<void>((resolve) => {
        resume = resolve;
      });
      yield "second chunk";
      yield { done: true, ok: true };
    });

    render(<EscrowCard />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Compile Escrow/i }));
    const logContainer = await screen.findByTestId("compile-log-container");

    Object.defineProperty(logContainer, "scrollHeight", { configurable: true, value: 400 });
    Object.defineProperty(logContainer, "clientHeight", { configurable: true, value: 100 });
    let scrollTopValue = 0;
    Object.defineProperty(logContainer, "scrollTop", {
      configurable: true,
      get() {
        return scrollTopValue;
      },
      set(value: number) {
        scrollTopValue = value;
      },
    });

    fireEvent.scroll(logContainer);
    resume();

    await waitFor(() => expect(screen.getByText(/New output/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/New output/));
    await waitFor(() => expect(screen.queryByText(/New output/)).not.toBeInTheDocument());
  });

  it("prevents re-entrant compile clicks", async () => {
    mockStream([{ done: true, ok: true }]);
    render(<EscrowCard />, { wrapper });
    const compileBtn = screen.getByRole("button", { name: /Compile Escrow/i });
    fireEvent.click(compileBtn);
    fireEvent.click(compileBtn);
    await waitFor(() => expect(screen.getByText(/\[done] compile succeeded/)).toBeInTheDocument());
    expect(compileEscrowStream).toHaveBeenCalledTimes(1);
  });
});
