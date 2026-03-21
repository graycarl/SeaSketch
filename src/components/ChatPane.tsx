import { useEffect, useMemo, useRef, useState } from "react";
import { useSeaSketchStore } from "../store";
import { SAMPLES_FOLDER_ID, samplesFolder } from "../samples";
import { ChatMessage } from "../types";
import { requestMermaidUpdate as requestOpenAI } from "../ai/openai";
import { requestMermaidUpdate as requestGemini } from "../ai/gemini";
import { nanoid } from "nanoid";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import { Paperclip, Send, ChevronDown, ChevronUp } from "lucide-react";
import "./ChatPane.css";

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["txt", "md", "json"];

export function ChatPane() {
  const {
    folders,
    currentFolderId,
    currentFileId,
    sampleContents,
    previewSnapshot,
    chatByFileId,
    attachmentsByFileId,
    isChatLoadingByFileId,
    updateFileContent,
    updateSampleContent,
    appendChatMessage,
    saveAttachment,
    settings,
    saveSettings,
    setChatLoading,
  } = useSeaSketchStore();

  const [draft, setDraft] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isSamples = currentFolderId === SAMPLES_FOLDER_ID;
  const currentFolder = useMemo(
    () => (isSamples ? samplesFolder : folders.find((folder) => folder.id === currentFolderId)),
    [folders, currentFolderId, isSamples],
  );
  const currentFile = useMemo(
    () => currentFolder?.files.find((file) => file.id === currentFileId),
    [currentFolder, currentFileId],
  );

  const currentFileIdSafe = currentFile?.id ?? "";
  const messages = chatByFileId[currentFileIdSafe] ?? [];
  const attachments = attachmentsByFileId[currentFileIdSafe] ?? [];
  const isLoading = isChatLoadingByFileId[currentFileIdSafe] ?? false;

  const editorValue = isSamples && currentFile
    ? (sampleContents[currentFile.id] ?? currentFile.content)
    : (currentFile?.content ?? "");

  useEffect(() => {
    setDraft("");
  }, [currentFileId]);

  useEffect(() => {
    if (isCollapsed) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isCollapsed]);

  const handleSend = async () => {
    if (!currentFile || !currentFolderId || !currentFileId) return;
    if (!draft.trim()) return;
    
    // Check authentication based on provider
    const isOpenAI = settings.aiProvider === "openai";
    const providerName = isOpenAI ? "OpenAI" : "Gemini";
    
    let isAuthenticated = false;
    if (isOpenAI) {
      isAuthenticated = !!settings.openaiApiKey;
    } else {
      // Gemini: check OAuth first, fall back to API key
      isAuthenticated = !!(settings.geminiOAuth || settings.geminiApiKey);
    }
    
    if (!isAuthenticated) {
      await appendChatMessage(currentFolderId, currentFileId, {
        id: nanoid(),
        role: "system",
        content: `${providerName} 未认证，请在 Settings 中${isOpenAI ? '设置 API Key' : '登录 Google 账号'}。`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const userMessage: ChatMessage = {
      id: nanoid(),
      role: "user",
      content: draft.trim(),
      timestamp: new Date().toISOString(),
      attachments: attachments.map((item) => item.filename),
    };

    setDraft("");
    setChatLoading(currentFileId, true);
    await appendChatMessage(currentFolderId, currentFileId, userMessage);

    try {
      const attachmentContents = await Promise.all(
        attachments.map(async (attachment) => {
          const content = await invoke<string>("read_attachment", {
            folderId: currentFolderId,
            fileId: currentFileId,
            filename: attachment.filename,
          });
          return { name: attachment.name, content };
        }),
      );

      const requestPayload = {
        settings,
        messages: [...messages, userMessage],
        mermaidSource: editorValue,
        previewSvg: previewSnapshot.svg,
        previewError: previewSnapshot.error,
        attachmentContents,
        userPrompt: userMessage.content,
        onTokenRefreshed: async (creds: any) => {
          await saveSettings({
            ...settings,
            geminiOAuth: creds,
          });
        }
      };

      const result = isOpenAI 
        ? await requestOpenAI(requestPayload)
        : await requestGemini(requestPayload);

      const normalizedCurrent = editorValue.replace(/\r\n/g, "\n").trimEnd();
      const normalizedNext = (result.mermaid ?? "").replace(/\r\n/g, "\n").trimEnd();
      const assistantText = result.assistantMessage.toLowerCase();
      const messageIndicatesNoChange =
        assistantText.includes("no change") ||
        assistantText.includes("no changes") ||
        assistantText.includes("no update") ||
        assistantText.includes("无需修改") ||
        assistantText.includes("未做修改") ||
        assistantText.includes("没有修改");
      const noChange = result.noChange || messageIndicatesNoChange || normalizedNext === normalizedCurrent;
      const shouldApply = !noChange && normalizedNext.length > 0;

      const assistantMessage: ChatMessage = {
        id: nanoid(),
        role: "assistant",
        content: result.assistantMessage,
        timestamp: new Date().toISOString(),
        appliedMermaid: shouldApply,
      };

      await appendChatMessage(currentFolderId, currentFileId, assistantMessage);

      if (shouldApply) {
        if (isSamples) {
          updateSampleContent(currentFileId, normalizedNext);
        } else {
          updateFileContent(currentFolderId, currentFileId, normalizedNext);
        }
      }
    } catch (error) {
      const message: ChatMessage = {
        id: nanoid(),
        role: "system",
        content: `AI 请求失败: ${(error as Error).message}`,
        timestamp: new Date().toISOString(),
      };
      await appendChatMessage(currentFolderId, currentFileId, message);
    } finally {
      setChatLoading(currentFileId, false);
    }
  };

  const handleAttach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentFolderId || !currentFileId || !event.target.files?.length) return;
    const file = event.target.files[0];
    event.target.value = "";

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      await appendChatMessage(currentFolderId, currentFileId, {
        id: nanoid(),
        role: "system",
        content: "仅支持 txt / md / json 附件。",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      await appendChatMessage(currentFolderId, currentFileId, {
        id: nanoid(),
        role: "system",
        content: "附件大小超过 5MB 限制。",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const text = await file.text();
    await saveAttachment(currentFolderId, currentFileId, file.name, text);
  };

  if (!currentFile) {
    return (
      <div className="chat-pane empty">
        <p>No diagram selected</p>
      </div>
    );
  }

  if (isSamples) {
    return (
      <div className="chat-pane disabled">
        <div className="chat-header">
          <h3>AI Assistant</h3>
        </div>
        <div className="chat-disabled">示例文件不支持 AI 与聊天。</div>
      </div>
    );
  }

  return (
    <div className={`chat-pane${isCollapsed ? " collapsed" : ""}`}>
      <div className="chat-header">
        <h3>AI Assistant</h3>
        <div className="chat-header-actions">
          <button
            className="collapse-button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            title={isCollapsed ? "展开" : "收起"}
          >
            {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <label className="attach-button">
            <Paperclip size={14} />
            <input type="file" accept=".txt,.md,.json" onChange={handleAttach} />
          </label>
        </div>
      </div>
      {!isCollapsed && (
        <>
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">描述你的需求，AI 会帮你改 Mermaid。</div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`chat-message ${message.role}`}>
                <div className="chat-meta">
                  <span className="chat-role">{message.role}</span>
                  <span className="chat-time">{new Date(message.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="chat-content">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-input">
            <textarea
              ref={inputRef}
              placeholder="描述你想要的修改..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
            />
            <button className="chat-send" onClick={handleSend} disabled={isLoading || !draft.trim()}>
              {isLoading ? "..." : <Send size={14} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
