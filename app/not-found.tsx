import Link from "next/link";
export default function NotFound() {
  return (
    <main className="recovery-box">
      <h1>Page not found</h1>
      <Link href="/dashboard">Return to dashboard</Link>
    </main>
  );
}
