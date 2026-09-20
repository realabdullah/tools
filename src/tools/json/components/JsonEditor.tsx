import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { linter, lintGutter } from '@codemirror/lint';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
  placeholder,
} from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { parseJson } from '../lib/parse';
import { editorTheme } from './editor-theme';
import {
  matchOffset,
  searchHighlighting,
  setEditorSearch,
  type EditorSearch,
} from './search-extension';

type JsonEditorProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  search: EditorSearch;
};

/**
 * The document surface: line numbers, folding, highlighting and editing in the
 * same box.
 *
 * This is where CodeMirror finally earned its place. A textarea cannot show a
 * gutter, fold a subtree, underline the exact character that broke the parse,
 * or stay responsive on a megabyte of JSON — and all four are the point of a
 * JSON workspace. It is loaded only by this route.
 */

/** Reports our own diagnostics inline, rather than the engine's. */
const jsonDiagnostics = linter(
  (view) => {
    const text = view.state.doc.toString();
    if (text.trim() === '') return [];

    const result = parseJson(text);
    if (result.ok) return [];

    const from = Math.max(0, Math.min(result.error.offset, text.length));
    return [
      {
        from,
        to: Math.min(from + 1, text.length),
        severity: 'error' as const,
        message: result.error.message,
      },
    ];
  },
  { delay: 250 },
);

export const JsonEditor = ({ value, onChange, readOnly, search }: JsonEditorProps) => {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const editable = useRef(new Compartment());
  // Kept in a ref so changing the handler never rebuilds the editor, and
  // synchronised in an effect rather than during render, which would not be
  // safe if a render were thrown away.
  const emit = useRef(onChange);
  useEffect(() => {
    emit.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!host.current) return;

    const instance = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          placeholder('Paste JSON…'),
          foldGutter(),
          lintGutter(),
          history(),
          bracketMatching(),
          highlightActiveLine(),
          keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
          json(),
          jsonDiagnostics,
          searchHighlighting,
          editorTheme,
          editable.current.of(EditorView.editable.of(true)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) emit.current(update.state.doc.toString());
          }),
        ],
      }),
    });

    view.current = instance;
    return () => {
      instance.destroy();
      view.current = null;
    };
    // Built once; every prop below is synchronised by its own effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External changes to the document — formatting, sorting, clearing, a
  // filtered result — without clobbering the caret during ordinary typing.
  useEffect(() => {
    const instance = view.current;
    if (!instance || instance.state.doc.toString() === value) return;
    instance.dispatch({
      changes: { from: 0, to: instance.state.doc.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure(EditorView.editable.of(!readOnly)),
    });
  }, [readOnly]);

  useEffect(() => {
    const instance = view.current;
    if (!instance) return;

    const offset = matchOffset(instance.state.doc.toString(), search);
    instance.dispatch({
      effects: [
        setEditorSearch.of(search),
        ...(offset === null ? [] : [EditorView.scrollIntoView(offset, { y: 'center' })]),
      ],
    });
  }, [search]);

  return <div ref={host} className="scroll-thin h-full overflow-hidden" />;
};
