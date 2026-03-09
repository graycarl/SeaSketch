import { useEffect, useState } from "react";
import { useSeaSketchStore } from "../store";
import "./SettingsModal.css";

export function SettingsModal() {
  const { isSettingsOpen, closeSettings, settings, saveSettings } = useSeaSketchStore();
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [apiHost, setApiHost] = useState(settings.apiHost);
  const [model, setModel] = useState(settings.model);

  useEffect(() => {
    if (isSettingsOpen) {
      setApiKey(settings.apiKey);
      setApiHost(settings.apiHost);
      setModel(settings.model);
    }
  }, [isSettingsOpen, settings]);

  if (!isSettingsOpen) return null;

  const handleSave = async () => {
    await saveSettings({ apiKey, apiHost, model });
    closeSettings();
  };

  return (
    <div className="settings-modal-overlay" onClick={closeSettings}>
      <div className="settings-modal" onClick={(event) => event.stopPropagation()}>
        <h3>AI Settings</h3>
        <label>
          <span>API Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-..."
          />
        </label>
        <label>
          <span>API Host</span>
          <input
            type="text"
            value={apiHost}
            onChange={(event) => setApiHost(event.target.value)}
            placeholder="https://api.openai.com"
          />
        </label>
        <label>
          <span>Model</span>
          <input
            type="text"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="gpt-4o-mini"
          />
        </label>
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
  );
}
