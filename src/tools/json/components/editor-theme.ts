import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

/**
 * CodeMirror dressed in the app's own tokens.
 *
 * Every colour and metric here is a `var(--…)` so the editor follows the light
 * and dark appearance with the rest of the interface, rather than shipping a
 * second palette that drifts.
 */
const theme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--color-fg)',
    fontSize: 'var(--text-sm)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.55',
    overflow: 'auto',
  },
  '.cm-content': { padding: '6px 0', caretColor: 'var(--color-accent)' },
  '&.cm-focused': { outline: 'none' },

  // Gutter: present, quiet, and aligned to the content it numbers.
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--color-fg-subtle)',
    border: 'none',
    borderRight: '1px solid var(--color-border)',
    paddingRight: '2px',
    userSelect: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 12px',
    minWidth: '2.5rem',
    fontVariantNumeric: 'tabular-nums',
  },
  '.cm-foldGutter .cm-gutterElement': { padding: '0 4px', cursor: 'pointer' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-fg-muted)' },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in oklab, var(--color-elevated) 55%, transparent)',
  },

  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-accent)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in oklab, var(--color-accent) 28%, transparent)',
  },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'color-mix(in oklab, var(--color-accent) 22%, transparent)',
    outline: 'none',
  },

  // Search matches, styled here rather than in global CSS so the editor owns
  // everything that appears inside it.
  '.cm-searchMatch': {
    backgroundColor: 'color-mix(in oklab, var(--color-highlight) 30%, transparent)',
    borderRadius: '2px',
  },
  '.cm-searchMatch-active': {
    backgroundColor: 'color-mix(in oklab, var(--color-highlight) 65%, transparent)',
    color: 'oklch(0.2 0.02 92)',
  },

  '.cm-lintRange-error': {
    backgroundImage: 'none',
    borderBottom: '2px wavy var(--color-danger)',
    textDecoration: 'underline wavy var(--color-danger)',
    textUnderlineOffset: '3px',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--color-elevated)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-fg)',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-2xs)',
  },
  '.cm-tooltip .cm-diagnostic': { padding: '4px 8px' },
  '.cm-tooltip .cm-diagnostic-error': { borderLeft: 'none' },
});

const highlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--color-syntax-key)' },
  { tag: tags.string, color: 'var(--color-syntax-string)' },
  { tag: tags.number, color: 'var(--color-syntax-number)' },
  { tag: tags.bool, color: 'var(--color-syntax-boolean)' },
  { tag: tags.null, color: 'var(--color-syntax-null)' },
  {
    tag: [tags.punctuation, tags.separator, tags.brace, tags.bracket],
    color: 'var(--color-syntax-punctuation)',
  },
]);

export const editorTheme: Extension = [theme, syntaxHighlighting(highlightStyle)];
