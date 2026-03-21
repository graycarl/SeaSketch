/**
 * Google Gemini API client
 * Supports both API Key (deprecated) and OAuth authentication
 */

import type { AISettings, ChatMessage, GeminiOAuthCredentials } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";
const GEMINI_OAUTH_BASE = "https://cloudcode-pa.googleapis.com";
const GEMINI_MODEL = "gemini-3-flash-preview";
const DEFAULT_TIMEOUT_MS = 30000;

interface GeminiPart {
  text: string;
}

interface GeminiCandidate {
  content: {
    parts: GeminiPart[];
    role: string;
  };
  finishReason?: string;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
  };
}

interface GeminiResponsePayload {
  assistantMessage: string;
  mermaid: string;
  noChange?: boolean;
}

export interface GeminiRequestPayload {
  settings: AISettings;
  messages: ChatMessage[];
  mermaidSource: string;
  previewSvg: string;
  previewError: string | null;
  attachmentContents: { name: string; content: string }[];
  userPrompt: string;
  onTokenRefreshed?: (credentials: GeminiOAuthCredentials) => Promise<void>;
}

/**
 * Check if OAuth token is expired or needs refresh
 */
async function ensureValidToken(oauth: GeminiOAuthCredentials, onTokenRefreshed?: (creds: GeminiOAuthCredentials) => Promise<void>): Promise<string> {
  const now = Date.now();
  const buffer = 5 * 60 * 1000; // 5 minutes buffer
  
  if (oauth.expires_at > now + buffer) {
    return oauth.access_token;
  }
  
  // Token expired or about to expire, refresh it
  const refreshed = await invoke<GeminiOAuthCredentials>("refresh_gemini_token", {
    refreshToken: oauth.refresh_token,
    projectId: oauth.project_id,
  });
  
  // Update the oauth object
  const newCredentials = {
    ...oauth,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: refreshed.expires_at,
  };
  
  if (onTokenRefreshed) {
    await onTokenRefreshed(newCredentials);
  }
  
  return newCredentials.access_token;
}

/**
 * Request Mermaid diagram update from Gemini API
 */
export async function requestMermaidUpdate(payload: GeminiRequestPayload): Promise<GeminiResponsePayload> {
  const { settings, mermaidSource, previewSvg, previewError, attachmentContents, userPrompt, onTokenRefreshed } = payload;

  // Check authentication method
  const useOAuth = !!settings.geminiOAuth;
  
  if (!useOAuth && !settings.geminiApiKey) {
    throw new Error("Gemini authentication required. Please login with Google.");
  }

  // ... (rest of the prompt logic) ...
  const systemPrompt = `You are a Mermaid diagram assistant.\n\nRequirements:\n- Default to replying in Chinese.\n- Read the provided Mermaid source, rendered SVG, and render errors.\n- Update the Mermaid source to satisfy the user request.\n- If no changes are needed, set "noChange": true and return the original Mermaid source verbatim (including the first line).\n- Return ONLY valid JSON with keys: assistantMessage, mermaid, optional noChange.\n- assistantMessage should explain changes succinctly.\n- mermaid must be the full updated Mermaid source.\n\nJSON format example:\n{"assistantMessage":"...","mermaid":"graph TD\\n  A-->B","noChange":false}`;

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

  let url: string;
  let headers: Record<string, string>;
  let requestBody: any;

  if (useOAuth) {
    // Use OAuth endpoint (Cloud Code Assist)
    const accessToken = await ensureValidToken(settings.geminiOAuth!, onTokenRefreshed);
    
    url = `${GEMINI_OAUTH_BASE}/v1internal:streamGenerateContent?alt=sse`;
    headers = {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": "google-cloud-sdk vscode_cloudshelleditor/0.1",
      "X-Goog-Api-Client": "gl-node/22.17.0",
      "Client-Metadata": JSON.stringify({
        ideType: "IDE_UNSPECIFIED",
        platform: "PLATFORM_UNSPECIFIED",
        pluginType: "GEMINI",
      }),
    };
    
    requestBody = {
      project: settings.geminiOAuth!.project_id,
      model: settings.geminiModel || GEMINI_MODEL,
      request: {
        contents: [
          {
            role: "user",
            parts: [{ text: contextParts.join("\n\n") }],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      },
      userAgent: "seasketch",
      requestId: `seasketch-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    };
  } else {
    // Use API Key endpoint (deprecated)
    url = `${GEMINI_API_BASE}/v1beta/models/${settings.geminiModel || GEMINI_MODEL}:generateContent?key=${settings.geminiApiKey}`;
    headers = {
      "Content-Type": "application/json",
    };
    
    requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: contextParts.join("\n\n") }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal: controller.signal,
  }).catch((e) => {
    window.clearTimeout(timeout);
    console.error("Fetch threw an error:", e);
    throw new Error(`Fetch failed: ${e.message || String(e)}`);
  });

  window.clearTimeout(timeout);

  if (!response.ok) {
    let errorText = "";
    try {
      errorText = await response.text();
      console.error("API error text:", errorText);
    } catch (e) {
      console.error("Could not read error text:", e);
    }
    const errorMessage = `Gemini API error: ${response.status} ${response.statusText}. Details: ${errorText.slice(0, 200)}`;
    throw new Error(errorMessage);
  }

  let responseText = "";
  try {
    responseText = await response.text();
  } catch (e) {
    throw new Error("Failed to read response from Gemini");
  }

  let content = "";
  let blockReason = "";

  if (useOAuth && url.includes("streamGenerateContent")) {
    const lines = responseText.split("\n");
    for (const line of lines) {
      if (line.startsWith("data:")) {
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;
        try {
          const chunk = JSON.parse(jsonStr);
          const responseData = chunk.response;
          if (!responseData) continue;
          
          if (responseData.promptFeedback?.blockReason) {
            blockReason = responseData.promptFeedback.blockReason;
          }
          
          const candidate = responseData.candidates?.[0];
          if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
              if (part.text !== undefined) {
                content += part.text;
              }
            }
          }
          if (candidate?.finishReason && candidate.finishReason !== "STOP") {
            if (candidate.finishReason === "SAFETY") blockReason = "Safety violation";
          }
        } catch (e) {
          // ignore parse error on single line
        }
      }
    }
  } else {
    let data;
    try {
      data = JSON.parse(responseText) as GeminiResponse;
    } catch (e) {
      console.error("Failed to parse JSON response:", e);
      throw new Error("Failed to parse response from Gemini");
    }

    if (data.promptFeedback?.blockReason) {
      blockReason = data.promptFeedback.blockReason;
    }

    const candidate = data.candidates?.[0];
    if (candidate?.content?.parts?.[0]?.text) {
      content = candidate.content.parts[0].text;
    }
  }

  if (blockReason) {
    throw new Error(`Request blocked: ${blockReason}`);
  }

  if (!content) {
    throw new Error("No response from Gemini API");
  }

  // Parse JSON response
  let parsed: GeminiResponsePayload | null = null;
  try {
    const cleaned = content
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error("Failed to parse Gemini response JSON");
  }

  if (!parsed?.assistantMessage || !parsed?.mermaid) {
    throw new Error("Gemini response JSON missing fields");
  }

  return parsed;
}
