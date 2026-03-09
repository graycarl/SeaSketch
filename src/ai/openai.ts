import type { AISettings, ChatMessage } from "../types";

const DEFAULT_TIMEOUT_MS = 30000;

interface OpenAIResponse {
  assistantMessage: string;
  mermaid: string;
  noChange?: boolean;
}

export interface OpenAIRequestPayload {
  settings: AISettings;
  messages: ChatMessage[];
  mermaidSource: string;
  previewSvg: string;
  previewError: string | null;
  attachmentContents: { name: string; content: string }[];
  userPrompt: string;
}

export async function requestMermaidUpdate(payload: OpenAIRequestPayload): Promise<OpenAIResponse> {
  const { settings, mermaidSource, previewSvg, previewError, attachmentContents, userPrompt } = payload;
  const host = settings.apiHost.replace(/\/$/, "");
  const url = `${host}/v1/chat/completions`;

  const systemPrompt = `You are a Mermaid diagram assistant.\n\nRequirements:\n- Default to replying in Chinese.\n- Read the provided Mermaid source, rendered SVG, and render errors.\n- Update the Mermaid source to satisfy the user request.\n- If no changes are needed, set \"noChange\": true and return the original Mermaid source verbatim (including the first line).\n- Return ONLY valid JSON with keys: assistantMessage, mermaid, optional noChange.\n- assistantMessage should explain changes succinctly.\n- mermaid must be the full updated Mermaid source.\n\nJSON format example:\n{"assistantMessage":"...","mermaid":"graph TD\\n  A-->B","noChange":false}`;

  const contextParts = [
    `Current Mermaid source:\n${mermaidSource}`,
    `Preview SVG (may be empty):\n${previewSvg || "<empty>"}`,
    `Preview error (if any):\n${previewError ?? "none"}`,
  ];

  if (attachmentContents.length > 0) {
    const attachmentText = attachmentContents
      .map((item) => `Attachment: ${item.name}\n${item.content}`)
      .join("\n\n");
    contextParts.push(`Attachments:\n${attachmentText}`);
  }

  if (payload.messages.length > 0) {
    const history = payload.messages
      .slice(-10)
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");
    contextParts.push(`Recent chat history:\n${history}`);
  }

  contextParts.push(`User request:\n${userPrompt}`);

  const body = {
    model: settings.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contextParts.join("\n\n") },
    ],
    temperature: 0.2,
  };

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeout));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `OpenAI request failed (${response.status})`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response missing content");
  }

  let parsed: OpenAIResponse | null = null;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error("Failed to parse OpenAI response JSON");
  }

  if (!parsed?.assistantMessage || !parsed?.mermaid) {
    throw new Error("OpenAI response JSON missing fields");
  }

  return parsed;
}
