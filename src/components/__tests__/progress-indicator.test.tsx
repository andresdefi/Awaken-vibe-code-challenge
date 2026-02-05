import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProgressIndicator } from "../progress-indicator";

afterEach(cleanup);

describe("ProgressIndicator", () => {
  it("renders nothing when status is idle", () => {
    const { container } = render(<ProgressIndicator status="idle" />);
    expect(container.firstChild).toBeNull();
  });

  it("shows default fetching message", () => {
    render(<ProgressIndicator status="fetching" />);
    expect(screen.getByText(/fetching transactions/i)).toBeInTheDocument();
  });

  it("shows default processing message", () => {
    render(<ProgressIndicator status="processing" />);
    expect(screen.getByText(/processing and normalizing/i)).toBeInTheDocument();
  });

  it("shows default complete message", () => {
    render(<ProgressIndicator status="complete" />);
    expect(screen.getByText(/loaded successfully/i)).toBeInTheDocument();
  });

  it("shows default error message", () => {
    render(<ProgressIndicator status="error" />);
    expect(screen.getByText(/an error occurred/i)).toBeInTheDocument();
  });

  it("shows custom message when provided", () => {
    render(<ProgressIndicator status="fetching" message="Loading chain data..." />);
    expect(screen.getByText("Loading chain data...")).toBeInTheDocument();
  });

  it("applies error styling", () => {
    render(<ProgressIndicator status="error" />);
    const container = screen.getByText(/an error occurred/i).closest("div");
    expect(container).toHaveClass("border");
  });
});
