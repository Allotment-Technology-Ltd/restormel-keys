import Link from "next/link";

export default function AboutPage() {
  return (
    <>
      <nav aria-label="Example site">
        <Link href="/">Home</Link>
      </nav>
      <main>
        <h1>about-nextjs-playwright</h1>
        <p>This route exercises multi-page goals against a dev server (no auth).</p>
      </main>
    </>
  );
}
