import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { mermaid } from "codemirror-lang-mermaid";
import { linter, Diagnostic } from "@codemirror/lint";
import mermaidApi from "mermaid";

const lintMermaid = linter(async (view) => {
  const text = view.state.doc.toString();

  if (!text.trim()) {
    return [];
  }

  try {
    await mermaidApi.parse(text);
    return [];
  } catch (error) {
    const message = (error as Error).message || "Mermaid parse error";
    const lineMatch = message.match(/line\s+(\d+)/i);
    const columnMatch = message.match(/column\s+(\d+)/i);
    const line = lineMatch ? Math.max(1, Number(lineMatch[1])) : 1;
    const column = columnMatch ? Math.max(1, Number(columnMatch[1])) : 1;
    const lineInfo = view.state.doc.line(line);
    const from = lineInfo.from + Math.max(0, column - 1);

    const diagnostics: Diagnostic[] = [
      {
        from,
        to: Math.min(lineInfo.to, from + 1),
        severity: "error",
        message,
      },
    ];

    return diagnostics;
  }
}, { delay: 500 });

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const startState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        oneDark,
        mermaid(),
        lintMermaid,
        keymap.of([indentWithTab, ...defaultKeymap]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": {
            height: "100%",
          },
          ".cm-scroller": {
            fontFamily:
              "\"JetBrains Mono\", \"SF Mono\", \"Fira Code\", Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
            fontSize: "12px",
            lineHeight: "1.5",
          },
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: hostRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (value !== currentValue) {
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value },
      });
    }
  }, [value]);

  return <div className="code-editor" ref={hostRef} />;
}
