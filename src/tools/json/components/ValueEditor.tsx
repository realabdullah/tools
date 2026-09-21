import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { editableText, parseEdited } from '../lib/edit';
import { kindOf, type JsonValue } from '../lib/types';

const KIND_CLASS = {
  string: 'text-syntax-string',
  number: 'text-syntax-number',
  boolean: 'text-syntax-boolean',
  null: 'text-syntax-null',
  object: 'text-fg-subtle',
  array: 'text-fg-subtle',
} as const;

type ValueEditorProps = {
  value: JsonValue;
  onCommit: (value: JsonValue) => void;
  onCancel: () => void;
};

/**
 * Editing one value in place.
 *
 * The field is sized to its content so the row does not jump when editing
 * starts, and it commits on Enter or blur — losing an edit because you clicked
 * elsewhere is the sort of thing that makes people stop trusting a tool.
 */
export const ValueEditor = ({ value, onCommit, onCancel }: ValueEditorProps) => {
  const [text, setText] = useState(() => editableText(value));
  const input = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    input.current?.select();
  }, []);

  const commit = () => {
    if (cancelled.current) return;
    onCommit(parseEdited(text, value));
  };

  return (
    <input
      ref={input}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          cancelled.current = true;
          onCancel();
        }
        event.stopPropagation();
      }}
      onClick={(event) => event.stopPropagation()}
      spellCheck={false}
      aria-label="Edit value"
      size={Math.max(text.length + 1, 3)}
      className={cn(
        'border-accent/60 bg-bg min-w-0 rounded-xs border px-1 py-0 font-mono text-sm outline-none',
        KIND_CLASS[kindOf(value)],
      )}
    />
  );
};

type KeyEditorProps = {
  name: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
};

/** Editing a property name. Same behaviour, but it is always text. */
export const KeyEditor = ({ name, onCommit, onCancel }: KeyEditorProps) => {
  const [text, setText] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    input.current?.select();
  }, []);

  return (
    <input
      ref={input}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (!cancelled.current) onCommit(text);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onCommit(text);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          cancelled.current = true;
          onCancel();
        }
        event.stopPropagation();
      }}
      onClick={(event) => event.stopPropagation()}
      spellCheck={false}
      aria-label="Edit property name"
      size={Math.max(text.length + 1, 3)}
      className="border-accent/60 bg-bg text-syntax-key min-w-0 rounded-xs border px-1 py-0 font-mono text-sm outline-none"
    />
  );
};
