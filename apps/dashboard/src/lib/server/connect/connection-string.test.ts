import { describe, expect, it } from "vitest";
import { parseSurrealConnectionString } from "./connection-string";

describe("parseSurrealConnectionString", () => {
  it("parses a full wss string with credentials and ns/db", () => {
    const r = parseSurrealConnectionString("wss://ingest:s3cret@db.surreal.cloud/restormel/knowledge");
    expect(r.error).toBeUndefined();
    expect(r.endpoint).toBe("https://db.surreal.cloud");
    expect(r.namespace).toBe("restormel");
    expect(r.database).toBe("knowledge");
    expect(r.username).toBe("ingest");
    expect(r.secret).toBe("s3cret");
  });

  it("maps ws -> http and keeps the port", () => {
    const r = parseSurrealConnectionString("ws://localhost:8000/ns/db");
    expect(r.endpoint).toBe("http://localhost:8000");
    expect(r.namespace).toBe("ns");
    expect(r.database).toBe("db");
  });

  it("treats a schemeless host as https with no ns/db (Surreal Cloud style)", () => {
    const r = parseSurrealConnectionString("my-instance.surreal.cloud");
    expect(r.endpoint).toBe("https://my-instance.surreal.cloud");
    expect(r.namespace).toBeUndefined();
    expect(r.database).toBeUndefined();
  });

  it("accepts surrealdb:// scheme", () => {
    const r = parseSurrealConnectionString("surrealdb://host:8000/team/graph");
    expect(r.endpoint).toBe("https://host:8000");
    expect(r.namespace).toBe("team");
    expect(r.database).toBe("graph");
  });

  it("parses ADO-style .NET connection strings from Surreal Cloud / Surrealist", () => {
    const r = parseSurrealConnectionString(
      "Server=wss://abc123.aws-euw1.surreal.cloud;Namespace=production;Database=knowledge;Username=root;Password=s3cret",
    );
    expect(r.error).toBeUndefined();
    expect(r.endpoint).toBe("https://abc123.aws-euw1.surreal.cloud");
    expect(r.namespace).toBe("production");
    expect(r.database).toBe("knowledge");
    expect(r.username).toBe("root");
    expect(r.secret).toBe("s3cret");
  });

  it("parses ADO aliases (Endpoint, NS, DB, User, Pass)", () => {
    const r = parseSurrealConnectionString(
      "Endpoint=wss://cloud.example.surreal.cloud;NS=team;DB=graph;User=ingest;Pass=token",
    );
    expect(r.endpoint).toBe("https://cloud.example.surreal.cloud");
    expect(r.namespace).toBe("team");
    expect(r.database).toBe("graph");
    expect(r.username).toBe("ingest");
    expect(r.secret).toBe("token");
  });

  it("ignores /rpc path segment when extracting namespace/database", () => {
    const r = parseSurrealConnectionString("wss://instance.surreal.cloud/rpc");
    expect(r.endpoint).toBe("https://instance.surreal.cloud");
    expect(r.namespace).toBeUndefined();
    expect(r.database).toBeUndefined();
  });

  it("parses /rpc/ns/db paths", () => {
    const r = parseSurrealConnectionString("wss://instance.surreal.cloud/rpc/restormel/knowledge");
    expect(r.namespace).toBe("restormel");
    expect(r.database).toBe("knowledge");
  });

  it("parses passwords containing @ via manual URI parsing", () => {
    const r = parseSurrealConnectionString("wss://root:p@ss@word@host.surreal.cloud/ns/db");
    expect(r.username).toBe("root");
    expect(r.secret).toBe("p@ss@word");
    expect(r.endpoint).toBe("https://host.surreal.cloud");
    expect(r.namespace).toBe("ns");
    expect(r.database).toBe("db");
  });

  it("strips wrapping quotes", () => {
    const r = parseSurrealConnectionString('"wss://instance.surreal.cloud/restormel/knowledge"');
    expect(r.endpoint).toBe("https://instance.surreal.cloud");
    expect(r.namespace).toBe("restormel");
    expect(r.database).toBe("knowledge");
  });

  it("parses labelled multi-line paste", () => {
    const r = parseSurrealConnectionString(`Endpoint: wss://instance.surreal.cloud
Namespace: restormel
Database: knowledge
Username: root
Password: secret`);
    expect(r.endpoint).toBe("https://instance.surreal.cloud");
    expect(r.namespace).toBe("restormel");
    expect(r.database).toBe("knowledge");
    expect(r.username).toBe("root");
    expect(r.secret).toBe("secret");
  });

  it("parses surreal CLI snippets", () => {
    const r = parseSurrealConnectionString(
      'surreal sql --endpoint wss://instance.surreal.cloud --ns restormel --db knowledge --token eyJhbG',
    );
    expect(r.endpoint).toBe("https://instance.surreal.cloud");
    expect(r.namespace).toBe("restormel");
    expect(r.database).toBe("knowledge");
    expect(r.secret).toBe("eyJhbG");
  });

  it("parses Surreal Cloud CLI copy (endpoint + token only)", () => {
    const payload = Buffer.from(JSON.stringify({ NS: "sophia", DB: "production" })).toString("base64url");
    const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;
    const r = parseSurrealConnectionString(
      `surreal sql --endpoint wss://sophia-prod-06ejjp0ud1ql95k42iqg8esvhs.aws-euw1.surreal.cloud --token ${token}`,
    );
    expect(r.error).toBeUndefined();
    expect(r.endpoint).toBe("https://sophia-prod-06ejjp0ud1ql95k42iqg8esvhs.aws-euw1.surreal.cloud");
    expect(r.secret).toBe(token);
    expect(r.namespace).toBe("sophia");
    expect(r.database).toBe("production");
  });

  it("returns an error for empty input", () => {
    expect(parseSurrealConnectionString("   ").error).toBeTruthy();
  });
});
