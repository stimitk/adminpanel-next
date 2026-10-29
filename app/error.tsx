"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="recovery-box">
      <h1>Unable to display this page</h1>
      <p>Try loading the page again.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
