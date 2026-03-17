import React from "react";

export type HealthcheckIntegrationSummary = {
  id: string;
  providerType: string;
  displayName: string | null;
  status: string;
  verificationStatus: string | null;
  lastVerifiedAt: number | null;
  region: string | null;
};

export type HealthcheckEmbedReport = {
  workspaceId: string;
  generatedAt: number;
  projects: { id: string; name: string }[];
  integrations: HealthcheckIntegrationSummary[];
  policies: { total: number };
  models: { total: number; latestSourceVerifiedAt: number | null };
};

export type HealthcheckSummaryProps = {
  report: HealthcheckEmbedReport;
  title?: string;
};

function fmtDate(ts: number | null): string {
  if (ts == null) return "—";
  return new Date(ts).toLocaleString();
}

export function HealthcheckSummary(props: HealthcheckSummaryProps) {
  const { report, title = "Healthcheck" } = props;

  const verified = report.integrations.filter((i) => i.verificationStatus === "verified").length;
  const pending = report.integrations.filter((i) => i.verificationStatus === "pending").length;
  const unverified = report.integrations.length - verified;

  return (
    <section aria-label={title}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div style={{ opacity: 0.75, fontSize: 12 }}>Generated: {fmtDate(report.generatedAt)}</div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
        <div style={{ border: "1px solid #2a2a2e", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Integrations</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{report.integrations.length}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            verified {verified} · pending {pending} · unverified {unverified}
          </div>
        </div>
        <div style={{ border: "1px solid #2a2a2e", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Policies</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{report.policies.total}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>workspace policies</div>
        </div>
        <div style={{ border: "1px solid #2a2a2e", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Models</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{report.models.total}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>catalog verify {fmtDate(report.models.latestSourceVerifiedAt)}</div>
        </div>
      </div>

      <h3 style={{ marginTop: 16, marginBottom: 8 }}>Providers</h3>
      {report.integrations.length === 0 ? (
        <p style={{ opacity: 0.75 }}>No provider integrations configured.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {report.integrations.map((i) => (
            <li key={i.id} style={{ border: "1px solid #2a2a2e", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{i.displayName ?? i.providerType}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {i.providerType}
                    {i.region ? ` · ${i.region}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{i.verificationStatus ?? "unverified"}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>last verified {fmtDate(i.lastVerifiedAt)}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

