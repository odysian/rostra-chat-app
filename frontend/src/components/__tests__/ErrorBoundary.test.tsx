import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "../ErrorBoundary";

function ThrowingComponent() {
  throw new Error("Boom");
}

describe("ErrorBoundary", () => {
  it("renders fallback UI when a child throws", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText("An unexpected error interrupted the chat UI."),
    ).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("calls onReload when RELOAD is clicked", async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const onReload = vi.fn();

    render(
      <ErrorBoundary onReload={onReload}>
        <ThrowingComponent />
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole("button", { name: "RELOAD" }));
    expect(onReload).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
  });
});
