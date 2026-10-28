import { afterEach, describe, expect, test, vi } from "vitest";
import * as Sentry from "@sentry/react";

import initMonitoring, { reportError } from "../src/monitoring.js";

vi.mock("@sentry/react", () => ({ init: vi.fn(), captureException: vi.fn() }));

const DSN = "https://examplePublicKey@o0.ingest.bugsink.com/1";

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("initMonitoring", () => {
  test("initializes Sentry with the DSN from the environment", () => {
    vi.stubEnv("VITE_SENTRY_DSN", DSN);

    expect(initMonitoring()).toBe(true);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: DSN,
      environment: "test",
    });
  });

  test("warns and skips initialization without a DSN", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(initMonitoring()).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("VITE_SENTRY_DSN");
  });

  test("warns and skips initialization with a malformed DSN", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("VITE_SENTRY_DSN", "not-a-dsn");

    expect(initMonitoring()).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("valid DSN");
  });
});

describe("reportError", () => {
  test("captures the error through Sentry", () => {
    const error = new Error("bootstrap failed");

    reportError(error);

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
