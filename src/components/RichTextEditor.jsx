import { useEditor, EditorContent } from '@tiptap/react'
import { useEffect } from 'react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    Heading2
} from 'lucide-react'

export default function RichTextEditor({ content, onChange, placeholder }) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
        ],
        content: content || '',
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
        editorProps: {
            attributes: {
                class: 'editor-content',
            },
        },
    })

    // Sync external content changes to the editor
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content || '')
        }
    }, [content, editor])

    if (!editor) {
        return null
    }

    const ToolbarButton = ({ onClick, isActive, children, title }) => (
        <button
            type="button"
            className={`editor-btn ${isActive ? 'active' : ''}`}
            onClick={onClick}
            title={title}
        >
            {children}
        </button>
    )

    return (
        <div className="editor-container">
            <div className="editor-toolbar">
                <div className="editor-toolbar-group">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive('bold')}
                        title="Bold"
                    >
                        <Bold size={16} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive('italic')}
                        title="Italic"
                    >
                        <Italic size={16} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        isActive={editor.isActive('underline')}
                        title="Underline"
                    >
                        <UnderlineIcon size={16} />
                    </ToolbarButton>
                </div>

                <div className="editor-toolbar-divider"></div>

                <div className="editor-toolbar-group">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive('bulletList')}
                        title="Bullet List"
                    >
                        <List size={16} />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        isActive={editor.isActive('orderedList')}
                        title="Numbered List"
                    >
                        <ListOrdered size={16} />
                    </ToolbarButton>
                </div>

                <div className="editor-toolbar-divider"></div>

                <div className="editor-toolbar-group">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        isActive={editor.isActive('heading', { level: 2 })}
                        title="Heading"
                    >
                        <Heading2 size={16} />
                    </ToolbarButton>
                </div>
            </div>

            <EditorContent editor={editor} />
        </div>
    )
}
