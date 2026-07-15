import { useEffect, useRef } from "react";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { search, searchKeymap, setSearchQuery } from "@codemirror/search";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { mermaid } from "codemirror-lang-mermaid";
import { linter, Diagnostic } from "@codemirror/lint";
import mermaidApi from "mermaid";
import "./CodeEditor.css";

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

const autoFindFirstMatch = ViewPlugin.fromClass(
  class {
    private lastSearch = "";

    update(update: ViewUpdate) {
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(setSearchQuery)) {
            const query = effect.value;
            if (!query.valid || !query.search || query.search === this.lastSearch) {
              continue;
            }
            this.lastSearch = query.search;

            // Defer until after the search highlighter has updated with the new query.
            setTimeout(() => {
              const view = update.view;
              if (!view.dom.isConnected) return;

              const cursor = query.getCursor(view.state.doc);
              const match = cursor.next();
              if (!match.done) {
                view.dispatch({
                  selection: { anchor: match.value.from, head: match.value.to },
                  scrollIntoView: true,
                });
              }
            }, 0);
          }
        }
      }
    }
  }
);

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
        history(),
        search({ top: true }),
        autoFindFirstMatch,
        keymap.of([indentWithTab, ...historyKeymap, ...defaultKeymap, ...searchKeymap]),
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
        annotations: Transaction.addToHistory.of(false),
      });
    }
  }, [value]);

  return <div className="code-editor" ref={hostRef} />;
}
