import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <nav aria-label="Example site">
        <Link href="/about">About this demo</Link>
      </nav>
      <main>
        <h1>nextjs-playwright</h1>
        <p className="intro">
          Minimal Next.js App Router app for the Restormel / Testing quickstart. Run{" "}
          <code>pnpm dev</code> on port <strong>3040</strong>, then{" "}
          <code>testing run --suite web-critical --config restormel-testing.yaml</code> from this directory.
        </p>
      </main>
    </>
  );
}
