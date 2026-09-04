import ClassicEditor from "@ckeditor/ckeditor5-build-classic";
import { CKEditor } from "@ckeditor/ckeditor5-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Pembungkus CKEditor. Dipisah ke file sendiri agar bundel editor (~1 MB)
 * bisa dimuat lewat React.lazy hanya saat form yang memakainya dibuka.
 */
const RichTextEditor = ({ value, onChange }: RichTextEditorProps) => (
  <CKEditor
    editor={ClassicEditor as any}
    config={{
      toolbar: [
        "heading",
        "|",
        "bold",
        "italic",
        "bulletedList",
        "numberedList",
        "|",
        "outdent",
        "indent",
        "|",
        "insertTable",
        "|",
        "undo",
        "redo",
      ],
    }}
    data={value}
    onChange={(_event: any, editor: any) => {
      onChange(editor.getData());
    }}
  />
);

export default RichTextEditor;
