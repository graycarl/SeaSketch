/**
 * Utilities for parsing and writing YAML frontmatter in Mermaid diagram files.
 *
 * Supported format:
 * ```
 * ---
 * config:
 *   theme: forest
 *   look: handDrawn
 * ---
 * graph TD
 *     A --> B
 * ```
 */

export type MermaidTheme = "default" | "base" | "dark" | "forest" | "neutral" | "null";
export type MermaidLook = "classic" | "handDrawn";

export interface DiagramConfig {
  theme?: MermaidTheme;
  look?: MermaidLook;
}

export interface ParsedContent {
  config: DiagramConfig;
  body: string;
}

const DEFAULT_THEME: MermaidTheme = "dark";
const DEFAULT_LOOK: MermaidLook = "classic";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parse a content string and extract config + body.
 * Returns empty config if no frontmatter found.
 */
export function parseFrontmatter(content: string): ParsedContent {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return { config: {}, body: content };
  }

  const yaml = match[1];
  const body = content.slice(match[0].length);
  const config = parseYamlConfig(yaml);
  return { config, body };
}

/**
 * Parse a minimal YAML block for the `config:` section.
 * Only handles `theme` and `look` keys under `config:`.
 */
function parseYamlConfig(yaml: string): DiagramConfig {
  const config: DiagramConfig = {};

  // Look for `config:` section and its indented children
  const inConfigSection = /^config:\s*$([\s\S]*?)(?=^\S|\s*$)/m.exec(yaml);
  const section = inConfigSection ? inConfigSection[1] : yaml;

  const themeMatch = section.match(/^\s+theme:\s*(\S+)/m);
  if (themeMatch) {
    config.theme = themeMatch[1] as MermaidTheme;
  }

  const lookMatch = section.match(/^\s+look:\s*(\S+)/m);
  if (lookMatch) {
    config.look = lookMatch[1] as MermaidLook;
  }

  return config;
}

/**
 * Write (insert or update) frontmatter into content.
 *
 * - If both values equal their defaults and there's no existing frontmatter, do nothing (keep content clean).
 * - If all config values are removed/default and frontmatter exists, remove the frontmatter block.
 * - Otherwise, insert or overwrite the frontmatter block.
 */
export function writeFrontmatter(content: string, newConfig: DiagramConfig): string {
  const { body } = parseFrontmatter(content);
  const hasFrontmatter = FRONTMATTER_REGEX.test(content);

  const theme = newConfig.theme;
  const look = newConfig.look;

  // Determine which keys to write (skip if value is default and we can omit it)
  const isDefaultTheme = !theme || theme === DEFAULT_THEME;
  const isDefaultLook = !look || look === DEFAULT_LOOK;

  // If both are default and there's no existing frontmatter, keep content pristine
  if (isDefaultTheme && isDefaultLook && !hasFrontmatter) {
    return content;
  }

  // If both are default and there IS frontmatter, remove it
  if (isDefaultTheme && isDefaultLook && hasFrontmatter) {
    return body;
  }

  // Build the YAML lines
  const lines: string[] = ["---", "config:"];
  if (theme) lines.push(`  theme: ${theme}`);
  if (look) lines.push(`  look: ${look}`);
  lines.push("---");

  const frontmatter = lines.join("\n") + "\n";
  return frontmatter + body;
}

/**
 * Strip frontmatter and return only the Mermaid body.
 */
export function stripFrontmatter(content: string): string {
  return parseFrontmatter(content).body;
}

/**
 * Get effective theme for display (falls back to default).
 */
export function getEffectiveTheme(config: DiagramConfig): MermaidTheme {
  return config.theme ?? DEFAULT_THEME;
}

/**
 * Get effective look for display (falls back to default).
 */
export function getEffectiveLook(config: DiagramConfig): MermaidLook {
  return config.look ?? DEFAULT_LOOK;
}

export { DEFAULT_THEME, DEFAULT_LOOK };
