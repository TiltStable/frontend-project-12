import * as Sentry from "@sentry/react";

// The DSN is deployment config, not code (12factor): Vite bakes VITE_*
// variables into the bundle at build time, so each environment wires its
// own collector without touching the source.
const DSN_PATTERN = /^https:\/\/\w+@[\w.-]+(:\d+)?\/\d+/;

const initMonitoring = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) {
    // A deploy without the variable must not ship silently unmonitored.
    console.warn("VITE_SENTRY_DSN is not set, error reporting is disabled");
    return false;
  }
  if (!DSN_PATTERN.test(dsn)) {
    // The SDK swallows an invalid DSN with a one-off internal console.error
    // and keeps running without a transport: fail named instead.
    console.warn(
      "VITE_SENTRY_DSN is set but does not look like a valid DSN, error reporting is disabled",
    );
    return false;
  }

  // Bugsink ingests error events only, so tracing stays at its default
  // (disabled): do not add tracesSampleRate here.
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
  });
  return true;
};

// Capture an handled error explicitly: a caught rejection never reaches
// the global handlers, so bootstrap failures must be reported by hand.
// Without an initialized SDK this is a safe no-op.
export const reportError = (error) => {
  Sentry.captureException(error);
};

export default initMonitoring;
