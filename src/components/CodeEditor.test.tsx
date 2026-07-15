import { describe, it, expect, vi } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { CodeEditor } from "./CodeEditor";

function getEditorElement(container: HTMLElement) {
  return container.querySelector(".cm-editor") as HTMLElement | null;
}

function getSearchPanel() {
  return document.querySelector(".cm-panel.cm-search") as HTMLElement | null;
}

function getSearchInput() {
  const panel = getSearchPanel();
  if (!panel) return null;
  return panel.querySelector('.cm-textfield') as HTMLInputElement | null;
}

function getMatchCount() {
  return document.querySelectorAll(".cm-searchMatch").length;
}

describe("CodeEditor search", () => {
  it("opens the search panel when Ctrl+F is pressed", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <CodeEditor value="graph TD\n  A-->B\n  A-->C" onChange={onChange} />
    );

    const editor = getEditorElement(container);
    expect(editor).toBeTruthy();

    const content = editor!.querySelector(".cm-content") as HTMLElement;
    content.focus();

    fireEvent.keyDown(content, { key: "f", ctrlKey: true, code: "KeyF" });

    await waitFor(() => {
      expect(getSearchPanel()).toBeTruthy();
    });

    expect(getSearchInput()).toBeTruthy();
  });

  it("highlights all matches and moves to the first match when typing a query", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <CodeEditor value="graph TD\n  Alice-->Bob\n  Bob-->Alice" onChange={onChange} />
    );

    const editor = getEditorElement(container)!;
    const content = editor.querySelector(".cm-content") as HTMLElement;
    content.focus();

    fireEvent.keyDown(content, { key: "f", ctrlKey: true, code: "KeyF" });

    await waitFor(() => {
      expect(getSearchInput()).toBeTruthy();
    });

    const input = getSearchInput()!;
    fireEvent.change(input, { target: { value: "Alice" } });

    await waitFor(() => {
      expect(getMatchCount()).toBe(2);
    });

    const selected = document.querySelectorAll(".cm-searchMatch-selected");
    expect(selected.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the search panel at the top of the editor", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <CodeEditor value="graph TD\n  A-->B" onChange={onChange} />
    );

    const editor = getEditorElement(container)!;
    const content = editor.querySelector(".cm-content") as HTMLElement;
    content.focus();

    fireEvent.keyDown(content, { key: "f", ctrlKey: true, code: "KeyF" });

    await waitFor(() => {
      expect(getSearchPanel()).toBeTruthy();
    });

    const topPanels = editor.querySelector(".cm-panels-top");
    expect(topPanels).toContainElement(getSearchPanel());
  });
});
