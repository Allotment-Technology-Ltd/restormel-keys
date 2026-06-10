import { describe, expect, it, vi } from "vitest";
import {
  buildStickyCommentBody,
  findStickyComment,
  stickyMarker,
  upsertStickyComment,
} from "./sticky-comment.js";

const TABLE = [
  "# Restormel connect eval — baseline diff",
  "",
  "| Metric | Baseline | Current | Δ | Status |",
  "|---|---:|---:|---:|:--|",
  "| ok % | 97% | 93% | -4 | ❌ regression |",
  "",
  "**Summary:** REGRESSION — 1 finding(s)",
].join("\n");

describe("stickyMarker", () => {
  it("is an invisible HTML comment, with optional discriminator", () => {
    expect(stickyMarker()).toBe("<!-- restormel-connect-eval -->");
    expect(stickyMarker("philosophy-starter")).toBe(
      "<!-- restormel-connect-eval:philosophy-starter -->",
    );
  });

  it("discriminated markers do not match each other", () => {
    const a = stickyMarker("a");
    expect(findStickyComment([{ id: 1, body: `${stickyMarker("ab")}\nhello` }], a)).toBeNull();
  });
});

describe("buildStickyCommentBody", () => {
  it("starts with the marker and embeds the markdown table", () => {
    const body = buildStickyCommentBody({
      marker: stickyMarker(),
      verdict: "regression",
      markdown: TABLE,
      warnOnly: false,
      commitSha: "abcdef1234567890",
      runUrl: "https://github.com/o/r/actions/runs/1",
    });
    expect(body.startsWith("<!-- restormel-connect-eval -->")).toBe(true);
    expect(body).toContain("REGRESSION");
    expect(body).toContain("| ok % | 97% | 93% | -4 |");
    expect(body).toContain("`abcdef123456`");
    expect(body).toContain("[workflow run](https://github.com/o/r/actions/runs/1)");
  });

  it("flags warn mode on failing verdicts only", () => {
    const warn = buildStickyCommentBody({
      marker: stickyMarker(),
      verdict: "regression",
      markdown: TABLE,
      warnOnly: true,
    });
    expect(warn).toContain("non-blocking");
    const pass = buildStickyCommentBody({
      marker: stickyMarker(),
      verdict: "pass",
      markdown: TABLE,
      warnOnly: true,
    });
    expect(pass).not.toContain("non-blocking");
  });
});

describe("findStickyComment", () => {
  it("finds the marked comment among others", () => {
    const marker = stickyMarker();
    const comments = [
      { id: 1, body: "LGTM" },
      { id: 2, body: `${marker}\nold table` },
      { id: 3, body: null },
    ];
    expect(findStickyComment(comments, marker)?.id).toBe(2);
  });

  it("returns null when absent", () => {
    expect(findStickyComment([{ id: 1, body: "hi" }], stickyMarker())).toBeNull();
  });
});

describe("upsertStickyComment", () => {
  const base = {
    apiBase: "https://api.github.com",
    repository: "o/r",
    prNumber: 7,
    token: "t",
    marker: stickyMarker(),
    body: "new body",
  };

  it("PATCHes the existing marked comment (update-in-place, no spam)", async () => {
    const fetchImpl = vi.fn(async (url: any, init?: any) => {
      if (!init?.method) {
        return new Response(JSON.stringify([{ id: 11, body: `${stickyMarker()}\nold` }]), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    const result = await upsertStickyComment({ ...base, fetchImpl: fetchImpl as any });
    expect(result).toBe("updated");
    const patch = fetchImpl.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patch?.[0]).toBe("https://api.github.com/repos/o/r/issues/comments/11");
  });

  it("POSTs a new comment when no marker is found", async () => {
    const fetchImpl = vi.fn(async (url: any, init?: any) => {
      if (!init?.method) return new Response("[]", { status: 200 });
      return new Response("{}", { status: 201 });
    });
    const result = await upsertStickyComment({ ...base, fetchImpl: fetchImpl as any });
    expect(result).toBe("created");
    const post = fetchImpl.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[0]).toBe("https://api.github.com/repos/o/r/issues/7/comments");
  });

  it("throws on HTTP errors (caller treats commenting as best-effort)", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 403 }));
    await expect(upsertStickyComment({ ...base, fetchImpl: fetchImpl as any })).rejects.toThrow(
      /HTTP 403/,
    );
  });
});
