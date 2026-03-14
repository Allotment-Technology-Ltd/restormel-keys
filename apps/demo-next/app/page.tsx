import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: "2rem", maxWidth: "40rem" }}>
      <h1>Restormel Keys</h1>
      <p>Next.js App Router demo for BYOK key management and resolution.</p>
      <ul>
        <li>
          <Link href="/settings">Settings</Link> — KeyManager, ModelSelector (client)
        </li>
        <li>
          <a href="/api/keys">GET /api/keys</a> — list keys (add header <code>x-user-id</code>)
        </li>
        <li>
          <a href="/api/resolve?provider=openai">GET /api/resolve</a> — server-side resolution
        </li>
      </ul>
    </main>
  );
}
