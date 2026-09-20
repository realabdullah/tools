import { StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import { findMatches } from '../lib/matches';

export type EditorSearch = { query: string; active: number };

export const setEditorSearch = StateEffect.define<EditorSearch>();

const matchMark = Decoration.mark({ class: 'cm-searchMatch' });
const activeMark = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-active' });

const decorate = (text: string, search: EditorSearch): DecorationSet => {
  const offsets = findMatches(text, search.query);
  if (offsets.length === 0) return Decoration.none;

  return Decoration.set(
    offsets.map((from, index) =>
      (index === search.active ? activeMark : matchMark).range(from, from + search.query.length),
    ),
  );
};

/**
 * Highlights every occurrence of the toolbar's search term, with the current
 * one picked out.
 *
 * Hand-rolled rather than `@codemirror/search` because the search UI is the
 * workspace's own toolbar, not a panel the editor opens: this needs the
 * decorations and nothing else.
 */
export const searchHighlighting: Extension = StateField.define<{
  search: EditorSearch;
  decorations: DecorationSet;
}>({
  create: () => ({ search: { query: '', active: 0 }, decorations: Decoration.none }),
  update(value, transaction) {
    let search = value.search;
    for (const effect of transaction.effects) {
      if (effect.is(setEditorSearch)) search = effect.value;
    }
    if (search === value.search && !transaction.docChanged) return value;
    return { search, decorations: decorate(transaction.state.doc.toString(), search) };
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

/** Offset of the nth match, for scrolling it into view. */
export const matchOffset = (text: string, search: EditorSearch): number | null =>
  findMatches(text, search.query)[search.active] ?? null;
