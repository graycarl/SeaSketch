import { useEffect, useState } from "react";
import { useSeaSketchStore } from "../store";
import { AIProvider, GeminiOAuthCredentials } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import "./SettingsModal.css";

export function SettingsModal() {
  const { isSettingsOpen, closeSettings, settings, updateAIProvider, saveSettings } = useSeaSketchStore();
  const [aiProvider, setAiProvider] = useState<AIProvider>(settings.aiProvider);
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.openaiApiKey);
  const [openaiApiHost, setOpenaiApiHost] = useState(settings.openaiApiHost);
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey);
  const [geminiModel, setGeminiModel] = useState(settings.geminiModel || "gemini-3-flash-preview");
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<AIProvider | null>(null);
  const [oauthInProgress, setOauthInProgress] = useState(false);
  const [oauthProgress, setOauthProgress] = useState("");

  useEffect(() => {
    if (isSettingsOpen) {
      setAiProvider(settings.aiProvider);
      setOpenaiApiKey(settings.openaiApiKey);
      setOpenaiApiHost(settings.openaiApiHost);
      setGeminiApiKey(settings.geminiApiKey);
      setGeminiModel(settings.geminiModel || "gemini-3-flash-preview");
    }
  }, [isSettingsOpen, settings]);

  if (!isSettingsOpen) return null;

  const handleProviderChange = (newProvider: AIProvider) => {
    if (newProvider === aiProvider) {
      return;
    }

    setPendingProvider(newProvider);
    setShowConfirm(true);
  };

  const confirmProviderChange = () => {
    if (!pendingProvider) return;

    const providerToApply = pendingProvider;

    setAiProvider(providerToApply);
    setShowConfirm(false);
    setPendingProvider(null);

    updateAIProvider(providerToApply)
      .catch((error) => {
        alert("切换 Provider 失败: " + error.message);
        setAiProvider(aiProvider);
      });
  };

  const cancelProviderChange = () => {
    setShowConfirm(false);
    setPendingProvider(null);
  };

  const handleGeminiOAuthLogin = async () => {
    setOauthInProgress(true);
    setOauthProgress("Initializing OAuth flow...");

    try {
      // Listen for OAuth events
      const unlisten1 = await listen<string>("oauth_url", async (event) => {
        await openUrl(event.payload);
        setOauthProgress("Opened browser, waiting for authorization...");
      });

      const unlisten2 = await listen<string>("oauth_progress", (event) => {
        setOauthProgress(event.payload);
      });

      // Start OAuth flow
      const invokePromise = invoke<GeminiOAuthCredentials>("start_gemini_oauth");
      
      // Add a client-side timeout of 5.5 minutes (backend has 5 min timeout)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Frontend timeout waiting for OAuth")), 330000);
      });
      
      const credentials = await Promise.race([invokePromise, timeoutPromise]);

      // Clean up listeners
      unlisten1();
      unlisten2();

      // Save credentials
      await saveSettings({
        ...settings,
        geminiOAuth: credentials,
      });

      setOauthProgress("Login successful!");
      setTimeout(() => {
        setOauthInProgress(false);
        setOauthProgress("");
      }, 1500);
    } catch (error: any) {
      console.error("OAuth error:", error);
      alert("OAuth login failed: " + (error.message || String(error)));
      setOauthInProgress(false);
      setOauthProgress("");
    }
  };

  const handleGeminiOAuthLogout = async () => {
    await saveSettings({
      ...settings,
      geminiOAuth: undefined,
    });
  };

  const handleSave = async () => {
    await saveSettings({ 
      aiProvider, 
      openaiApiKey, 
      openaiApiHost, 
      geminiApiKey,
      geminiModel,
      geminiOAuth: settings.geminiOAuth, // Preserve OAuth
    });
    closeSettings();
  };

  const isGeminiLoggedIn = !!settings.geminiOAuth;

  return (
    <>
      <div className="settings-modal-overlay">
        <div className="settings-modal">
          <h3>AI Settings</h3>
          
          <div className="setting-group">
            <label htmlFor="ai-provider">AI Provider</label>
            <select 
              id="ai-provider"
              value={aiProvider} 
              onChange={(event) => handleProviderChange(event.target.value as AIProvider)}
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>

        {aiProvider === "openai" && (
          <>
            <div className="setting-group">
              <label htmlFor="openai-api-key">OpenAI API Key</label>
              <input
                id="openai-api-key"
                type="password"
                value={openaiApiKey}
                onChange={(event) => setOpenaiApiKey(event.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div className="setting-group">
              <label htmlFor="openai-api-host">OpenAI API Host</label>
              <input
                id="openai-api-host"
                type="text"
                value={openaiApiHost}
                onChange={(event) => setOpenaiApiHost(event.target.value)}
                placeholder="https://api.openai.com"
              />
              <div className="hint">用于代理或自定义端点</div>
            </div>
          </>
        )}

        {aiProvider === "gemini" && (
          <>
            <div className="setting-group">
              <label htmlFor="gemini-model">Gemini Model Name</label>
              <input
                id="gemini-model"
                type="text"
                value={geminiModel}
                onChange={(event) => setGeminiModel(event.target.value)}
                placeholder="gemini-3-flash-preview"
              />
              <div className="hint">使用的 Google Gemini 模型版本</div>
            </div>
            {isGeminiLoggedIn ? (
              <div className="setting-group">
                <label>Google Account</label>
                <div className="oauth-status">
                  <span className="oauth-email">{settings.geminiOAuth?.email || "Logged in"}</span>
                  <button 
                    className="btn secondary small" 
                    onClick={handleGeminiOAuthLogout}
                  >
                    Logout
                  </button>
                </div>
                <div className="hint">Project: {settings.geminiOAuth?.project_id}</div>
              </div>
            ) : (
              <div className="setting-group">
                <label>Gemini Authentication</label>
                <button 
                  className="btn primary" 
                  onClick={handleGeminiOAuthLogin}
                  disabled={oauthInProgress}
                >
                  {oauthInProgress ? "Logging in..." : "Login with Google"}
                </button>
                {oauthProgress && <div className="hint">{oauthProgress}</div>}
                <div className="hint">使用 Google 账号登录以访问 Gemini API</div>
              </div>
            )}
          </>
        )}

        <div className="settings-actions">
          <button className="btn secondary" onClick={closeSettings}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="confirm-overlay" onClick={cancelProviderChange}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>确认切换</h4>
            <p>切换 AI Provider 将清空所有文件的 Chat 历史，是否继续？</p>
            <div className="confirm-actions">
              <button className="btn secondary" onClick={cancelProviderChange}>
                取消
              </button>
              <button className="btn primary" onClick={confirmProviderChange}>
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
