import { describe, expect, it } from "vitest";
import {
  classifyNoteTheme,
  deriveVerdictDelta,
  redactReviewNote,
} from "./review-signal-redact";

describe("review-signal-redact", () => {
  it("redacts urls and long quotes", () => {
    const out = redactReviewNote('See https://example.com/doc and "this is a very long quoted passage that should be redacted because it exceeds the maximum allowed length for a single quoted span in operator notes"');
    expect(out).toContain("[url]");
    expect(out).toContain("[redacted quote]");
  });

  it("classifies paraphrase theme", () => {
    expect(classifyNoteTheme("Faithful paraphrase of the source")).toBe("paraphrase_ok");
  });

  it("derives weak_to_ok delta", () => {
    expect(deriveVerdictDelta("weak", "ok")).toBe("weak_to_ok");
    expect(deriveVerdictDelta("weak", "ok", true)).toBe("removed_after_weak");
  });
});
