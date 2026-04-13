import { describe, expect, it } from "vitest";
import { sanitizeFilenameStem } from "./filename";

describe("sanitizeFilenameStem", () => {
  it("replaces invalid filename characters", () => {
    expect(sanitizeFilenameStem('a/b\\c:d*e?f"g<h>i|j')).toBe("a_b_c_d_e_f_g_h_i_j");
  });

  it("collapses repeated whitespace and trims", () => {
    expect(sanitizeFilenameStem("  release    plan   v1  ")).toBe("release plan v1");
  });

  it("removes leading and trailing dots", () => {
    expect(sanitizeFilenameStem("...draft...")) .toBe("draft");
  });

  it("keeps unicode characters", () => {
    expect(sanitizeFilenameStem("架构图-版本一")).toBe("架构图-版本一");
  });

  it("uses fallback when result is empty", () => {
    expect(sanitizeFilenameStem("   ")).toBe("diagram");
    expect(sanitizeFilenameStem("<>:*?", "fallback-name")).toBe("fallback-name");
  });
});
