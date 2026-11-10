"use client";

/** The last resort: the root layout itself crashed. No providers here, so plain English and inline styles. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fff8f1", color: "#3a2a1a", fontFamily: "system-ui, sans-serif" }}>
        <main role="alert" style={{ maxWidth: 420, margin: "0 auto", padding: "20vh 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Something broke on our side</h1>
          <p style={{ color: "#6b5a48", lineHeight: 1.5 }}>Your envelopes are safe on the chain. Reload to try again.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, minHeight: 52, padding: "0 28px", border: 0, borderRadius: 18, background: "#9b1c1c", color: "#fff", fontSize: 17, fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
