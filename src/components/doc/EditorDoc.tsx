import { useEffect, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Code, Columns3, Heading1, Heading2, Heading3, Highlighter, Italic, Link2, List, ListChecks, ListOrdered,
  Minus, Quote, Redo2, Rows3, Strikethrough, Table as IconeTabela, Trash2, Underline as IconeSublinhado, Undo2,
} from "lucide-react";

interface Props {
  /** HTML inicial do documento */
  conteudo: string;
  /** A cada mudança: HTML e o texto puro (busca, prévia e IA) */
  mudar: (html: string, texto: string) => void;
  placeholder?: string;
  autoFoco?: boolean;
  /** Ctrl/Cmd + S */
  salvar?: () => void;
}

/** Editor de documentos estilo Google Docs / ClickUp Docs: títulos, listas, tarefas, tabelas, links e destaques. */
export function EditorDoc({ conteudo, mudar, placeholder = "Escreva aqui… use # para título, - para lista e [] para tarefa", autoFoco, salvar }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: conteudo,
    autofocus: autoFoco ? "end" : false,
    editorProps: {
      attributes: { class: "doc doc-editor min-h-[340px] outline-none" },
      handleKeyDown: (_v, e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          salvar?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => mudar(ed.getHTML(), ed.getText({ blockSeparator: "\n" })),
  });

  // Entrega o texto inicial para quem chamou (anotações antigas convertidas)
  useEffect(() => {
    if (editor) mudar(editor.getHTML(), editor.getText({ blockSeparator: "\n" }));
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return <div className="min-h-[340px]" />;
  return (
    <div className="flex flex-col rounded-xl border border-line bg-bg focus-within:border-accent/60">
      <Barra editor={editor} />
      <div className="px-4 py-3 sm:px-6 sm:py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Barra({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus();
  const naTabela = editor.isActive("table");
  const link = () => {
    const atual = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Endereço do link (deixe vazio para tirar)", atual ?? "https://");
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://") c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: /^(https?:|mailto:|tel:)/i.test(url) ? url.trim() : `https://${url.trim()}` }).run();
  };
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-line bg-surface/95 px-1.5 py-1 backdrop-blur">
      <B t="Desfazer (Ctrl+Z)" f={() => c().undo().run()} off={!editor.can().undo()}><Undo2 size={15} /></B>
      <B t="Refazer" f={() => c().redo().run()} off={!editor.can().redo()}><Redo2 size={15} /></B>
      <Sep />
      <B t="Título 1" a={editor.isActive("heading", { level: 1 })} f={() => c().toggleHeading({ level: 1 }).run()}><Heading1 size={16} /></B>
      <B t="Título 2" a={editor.isActive("heading", { level: 2 })} f={() => c().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></B>
      <B t="Título 3" a={editor.isActive("heading", { level: 3 })} f={() => c().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></B>
      <Sep />
      <B t="Negrito (Ctrl+B)" a={editor.isActive("bold")} f={() => c().toggleBold().run()}><Bold size={15} /></B>
      <B t="Itálico (Ctrl+I)" a={editor.isActive("italic")} f={() => c().toggleItalic().run()}><Italic size={15} /></B>
      <B t="Sublinhado (Ctrl+U)" a={editor.isActive("underline")} f={() => c().toggleUnderline().run()}><IconeSublinhado size={15} /></B>
      <B t="Riscado" a={editor.isActive("strike")} f={() => c().toggleStrike().run()}><Strikethrough size={15} /></B>
      <B t="Destacar" a={editor.isActive("highlight")} f={() => c().toggleHighlight().run()}><Highlighter size={15} /></B>
      <B t="Link" a={editor.isActive("link")} f={link}><Link2 size={15} /></B>
      <Sep />
      <B t="Lista" a={editor.isActive("bulletList")} f={() => c().toggleBulletList().run()}><List size={16} /></B>
      <B t="Lista numerada" a={editor.isActive("orderedList")} f={() => c().toggleOrderedList().run()}><ListOrdered size={16} /></B>
      <B t="Lista de tarefas" a={editor.isActive("taskList")} f={() => c().toggleTaskList().run()}><ListChecks size={16} /></B>
      <B t="Citação" a={editor.isActive("blockquote")} f={() => c().toggleBlockquote().run()}><Quote size={15} /></B>
      <B t="Código" a={editor.isActive("codeBlock")} f={() => c().toggleCodeBlock().run()}><Code size={15} /></B>
      <B t="Linha divisória" f={() => c().setHorizontalRule().run()}><Minus size={16} /></B>
      <Sep />
      <B t="Alinhar à esquerda" a={editor.isActive({ textAlign: "left" })} f={() => c().setTextAlign("left").run()}><AlignLeft size={15} /></B>
      <B t="Centralizar" a={editor.isActive({ textAlign: "center" })} f={() => c().setTextAlign("center").run()}><AlignCenter size={15} /></B>
      <B t="Alinhar à direita" a={editor.isActive({ textAlign: "right" })} f={() => c().setTextAlign("right").run()}><AlignRight size={15} /></B>
      <Sep />
      <B t="Inserir tabela" a={naTabela} f={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><IconeTabela size={15} /></B>
      {naTabela && (
        <>
          <B t="Adicionar linha abaixo" f={() => c().addRowAfter().run()}><Rows3 size={15} /></B>
          <B t="Adicionar coluna à direita" f={() => c().addColumnAfter().run()}><Columns3 size={15} /></B>
          <B t="Apagar linha" f={() => c().deleteRow().run()}><span className="text-[11px] font-semibold">−L</span></B>
          <B t="Apagar coluna" f={() => c().deleteColumn().run()}><span className="text-[11px] font-semibold">−C</span></B>
          <B t="Apagar tabela" f={() => c().deleteTable().run()}><Trash2 size={14} /></B>
        </>
      )}
    </div>
  );
}

function B({ t, a, off, f, children }: { t: string; a?: boolean; off?: boolean; f: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={t}
      aria-label={t}
      aria-pressed={a}
      disabled={off}
      onMouseDown={(e) => e.preventDefault()}
      onClick={f}
      className={`grid h-8 min-w-8 place-items-center rounded-md px-1 ${a ? "bg-accent-soft text-accent" : "text-muted hover:bg-raised hover:text-fg"} disabled:opacity-30`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-0.5 h-5 w-px bg-line" />;
