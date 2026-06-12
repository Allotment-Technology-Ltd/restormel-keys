/**
 * Stage K4 — validating-family disclosure on the run quality report (K-P1-7).
 * Attribution data arrives with K5; until then the field is a graceful null.
 */
import { describe, it, expect } from "vitest";
import {
  buildRunQualityReport,
  buildValidationFamilyDisclosure,
} from "./run-quality-report";

const BASE_ARGS = {
  preset: "production" as const,
  executionMode: "full" as const,
  units: 10,
  relations: 4,
  embedded: 10,
  validation: { ok: 9, weak: 1, unsupported: 0, unvalidated: 0 },
};

describe("buildValidationFamilyDisclosure", () => {
  it("cross-family: anthropic validation vs openai extraction", () => {
    expect(
      buildValidationFamilyDisclosure({
        validationProvider: "anthropic",
        extractionProvider: "openai",
      }),
    ).toEqual({
      validation_provider: "anthropic",
      extraction_provider: "openai",
      cross_family: true,
    });
  });

  it("same family: openai vs openai", () => {
    expect(
      buildValidationFamilyDisclosure({
        validationProvider: "openai",
        extractionProvider: "openai",
      })?.cross_family,
    ).toBe(false);
  });

  it("family aliases normalize before comparison (google ≡ vertex)", () => {
    expect(
      buildValidationFamilyDisclosure({
        validationProvider: "google",
        extractionProvider: "vertex",
      })?.cross_family,
    ).toBe(false);
  });

  it("unknown extraction provider → cross_family null (unknowable, not false)", () => {
    expect(
      buildValidationFamilyDisclosure({
        validationProvider: "anthropic",
        extractionProvider: "mystery-llm",
      })?.cross_family,
    ).toBeNull();
  });

  it("no extraction provider → disclosure with null extraction", () => {
    expect(
      buildValidationFamilyDisclosure({ validationProvider: "anthropic" }),
    ).toEqual({
      validation_provider: "anthropic",
      extraction_provider: null,
      cross_family: null,
    });
  });

  it("no validation provider → null disclosure", () => {
    expect(buildValidationFamilyDisclosure({ extractionProvider: "openai" })).toBeNull();
    expect(buildValidationFamilyDisclosure({ validationProvider: "  " })).toBeNull();
  });
});

describe("buildRunQualityReport — validation_family field", () => {
  it("absent attribution (pre-K5 runs) → graceful null", () => {
    const report = buildRunQualityReport(BASE_ARGS);
    expect(report.validation_family).toBeNull();
  });

  it("attribution present → disclosure embedded in the report", () => {
    const report = buildRunQualityReport({
      ...BASE_ARGS,
      attribution: { validationProvider: "anthropic", extractionProvider: "openai" },
    });
    expect(report.validation_family).toEqual({
      validation_provider: "anthropic",
      extraction_provider: "openai",
      cross_family: true,
    });
  });
});
