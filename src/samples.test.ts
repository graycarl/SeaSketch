import { beforeAll, describe, expect, it } from "vitest";
import { samplesFolder } from "./samples";

let mermaid: {
  initialize: (config: Record<string, unknown>) => void;
  parse: (text: string) => Promise<unknown>;
};

describe("Samples Mermaid syntax", () => {
  beforeAll(async () => {
    // mermaid 在测试环境中依赖 DOMPurify，这里提供最小实现用于语法校验
    (globalThis as unknown as { DOMPurify?: { sanitize: (v: string) => string } }).DOMPurify = {
      sanitize: (v: string) => v,
    };

    const mod = await import("mermaid");
    const instance = mod.default ?? mod;
    mermaid = instance as typeof mermaid;
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
  });

  it("should parse all sample diagrams without syntax errors", async () => {
    for (const file of samplesFolder.files) {
      await expect(mermaid.parse(file.content)).resolves.toBeTruthy();
    }
  });

  it("should not contain duplicate architecture edges that can cause duplicate-id rendering errors", () => {
    const architectureSample = samplesFolder.files.find((file) => file.id === "__sample_architecture__");
    expect(architectureSample).toBeDefined();

    const normalizeEndpoint = (raw: string) =>
      raw
        .replace(/^[A-Za-z]:/, "")
        .replace(/\{group\}/g, "")
        .trim();

    const edgeLines = architectureSample!.content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes("-->") || line.includes("<-->"));

    const seen = new Set<string>();

    for (const line of edgeLines) {
      const match = line.match(/^(.+?)\s*(<-->|-->)\s*(.+)$/);
      expect(match).not.toBeNull();
      const left = normalizeEndpoint(match![1]);
      const right = normalizeEndpoint(match![3]);
      const key = `${left}->${right}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
