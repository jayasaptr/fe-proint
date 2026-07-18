// The published `@ckeditor/ckeditor5-build-classic@41.x` package points its
// "types" field at ./build/ckeditor.d.ts, but that declaration file is not
// actually shipped in the package. This ambient module declaration provides
// the minimal typing so the build can be imported without a TS error.
declare module '@ckeditor/ckeditor5-build-classic' {
  const ClassicEditor: {
    create(...args: unknown[]): Promise<unknown>;
    // The CKEditor React component only needs the constructor/editor reference,
    // so it is typed loosely here to match the build's runtime export.
    [key: string]: unknown;
  };
  export default ClassicEditor;
}
