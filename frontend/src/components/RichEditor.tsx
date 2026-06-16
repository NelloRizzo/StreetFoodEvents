import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { useCallback } from 'react'
import styles from './RichEditor.module.scss'

type RichEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  maxLength?: number
}

export function RichEditor({ value, onChange, placeholder, maxLength }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'nofollow', target: '_blank' },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      if (maxLength && html.length > maxLength) return
      onChange(html)
    },
    editorProps: {
      attributes: {
        class: styles.editor,
        placeholder: placeholder ?? '',
      },
    },
  })

  const setLink = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  if (!editor) return null

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={`${styles.toolBtn} ${editor.isActive('bold') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Grassetto"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${editor.isActive('italic') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Corsivo"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${editor.isActive('underline') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Sottolineato"
        >
          <span style={{ textDecoration: 'underline' }}>U</span>
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${editor.isActive('strike') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Barrato"
        >
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </button>

        <span className={styles.separator} />

        <button
          type="button"
          className={`${styles.toolBtn} ${editor.isActive('heading', { level: 2 }) ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Titolo"
        >
          H2
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${editor.isActive('heading', { level: 3 }) ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Sottotitolo"
        >
          H3
        </button>

        <span className={styles.separator} />

        <button
          type="button"
          className={`${styles.toolBtn} ${editor.isActive('bulletList') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Elenco puntato"
        >
          • list
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${editor.isActive('orderedList') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Elenco numerato"
        >
          1. list
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${editor.isActive('blockquote') ? styles.toolBtnActive : ''}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Citazione"
        >
          &ldquo;
        </button>

        <span className={styles.separator} />

        <button
          type="button"
          className={`${styles.toolBtn} ${editor.isActive('link') ? styles.toolBtnActive : ''}`}
          onClick={setLink}
          title="Link"
        >
          🔗
        </button>
      </div>

      <EditorContent editor={editor} />

      {maxLength && (
        <div className={styles.counter}>
          {value.length}/{maxLength}
        </div>
      )}
    </div>
  )
}
