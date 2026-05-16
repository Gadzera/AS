'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

// ── Variable chips ──────────────────────────────────────────────────────────
const VARIABLES = [
  { label: 'Имя', value: '{{firstName}}' },
  { label: 'Фамилия', value: '{{lastName}}' },
  { label: 'Компания', value: '{{company}}' },
  { label: 'Должность', value: '{{title}}' },
  { label: 'Сайт', value: '{{website}}' },
  { label: 'Страна', value: '{{country}}' },
  { label: 'Город', value: '{{city}}' },
];

// ── Toolbar button ───────────────────────────────────────────────────────────
function ToolBtn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={clsx(
        'p-1.5 rounded text-sm transition-colors',
        active ? 'bg-brand-500/20 text-brand-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
      )}
    >
      {children}
    </button>
  );
}

// ── Preview modal ────────────────────────────────────────────────────────────
function PreviewModal({ html, onClose }: { html: string; onClose: () => void }) {
  const sample = {
    firstName: 'Александр', lastName: 'Иванов', company: 'TechCorp',
    title: 'VP Sales', website: 'techcorp.com', country: 'Россия', city: 'Москва',
  };
  const preview = html
    .replace(/\{\{firstName\}\}/g, sample.firstName)
    .replace(/\{\{lastName\}\}/g, sample.lastName)
    .replace(/\{\{company\}\}/g, sample.company)
    .replace(/\{\{title\}\}/g, sample.title)
    .replace(/\{\{website\}\}/g, sample.website)
    .replace(/\{\{country\}\}/g, sample.country)
    .replace(/\{\{city\}\}/g, sample.city);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <span className="text-xs text-gray-500 font-medium">Предпросмотр письма</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <div className="p-6 text-sm text-gray-800 leading-relaxed font-[Arial,sans-serif] max-h-96 overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: preview }} />
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-400 text-center">
          Пример с данными: {sample.firstName} {sample.lastName} · {sample.company}
        </div>
      </div>
    </div>
  );
}

// ── Main Editor ──────────────────────────────────────────────────────────────
interface EmailEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  showVariables?: boolean;
}

export default function EmailEditor({
  value,
  onChange,
  placeholder = 'Напишите текст письма...',
  minHeight = 200,
  showVariables = true,
}: EmailEditorProps) {
  const [showPreview, setShowPreview] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-brand-400 underline' } }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none px-4 py-3',
        style: `min-height: ${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value]);

  const insertVariable = (variable: string) => {
    editor?.chain().focus().insertContent(
      `<span class="variable-chip" style="background:#312e81;color:#a5b4fc;border-radius:4px;padding:1px 6px;font-size:12px;font-family:monospace">${variable}</span>&nbsp;`
    ).run();
  };

  if (!editor) return null;

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900 focus-within:border-brand-500/50 transition-colors">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-700/60 flex-wrap">
        {/* Text formatting */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Жирный (Ctrl+B)">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Курсив (Ctrl+I)">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Подчёркнутый (Ctrl+U)">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>
        </ToolBtn>

        <div className="w-px h-4 bg-gray-700 mx-1" />

        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Список">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>
        </ToolBtn>

        <div className="w-px h-4 bg-gray-700 mx-1" />

        {/* Link */}
        <ToolBtn
          onClick={() => {
            const url = window.prompt('URL ссылки:');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          active={editor.isActive('link')}
          title="Ссылка"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
        </ToolBtn>

        <div className="flex-1" />

        {/* Char count */}
        <span className="text-xs text-gray-600 mr-2">
          {editor.storage.characterCount.characters()} симв.
        </span>

        {/* Preview */}
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-400 transition-colors px-2 py-1 rounded border border-gray-700 hover:border-brand-500/50"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Превью
        </button>
      </div>

      {/* Variable chips */}
      {showVariables && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-700/40 flex-wrap bg-gray-800/30">
          <span className="text-xs text-gray-600 mr-1">Вставить:</span>
          {VARIABLES.map(v => (
            <button
              key={v.value}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertVariable(v.value); }}
              className="text-[11px] px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-800/50 hover:border-indigo-400/40 transition-colors font-mono"
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* Editor area */}
      <EditorContent editor={editor} />

      {/* Preview modal */}
      {showPreview && (
        <PreviewModal html={editor.getHTML()} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}
