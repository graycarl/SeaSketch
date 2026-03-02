import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { EditorPane } from "./components/EditorPane";
import { PreviewPane } from "./components/PreviewPane";
import { useSeaSketchStore } from "./store";
import "./App.css";

function App() {
  const { loadState, isLoading } = useSeaSketchStore();

  useEffect(() => {
    loadState();
  }, [loadState]);

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Loading SeaSketch...</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <EditorPane />
      <PreviewPane />
    </div>
  );
}

export default App;
