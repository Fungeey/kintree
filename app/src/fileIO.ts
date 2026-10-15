// Save file / Open file in the browser (PR 1). The format is in ../storage/src/file.ts.
import { FILE_EXTENSION } from '../../storage/src/index.ts';
import type { Tree } from '../../engine/src/index.ts';

/** Files bigger than this aren't opened: a tree with photos is a few MB, so this is far past any real file. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** "Mei family.kintree": the root's name, with characters that file systems reject removed. */
export function fileNameFor(tree: Tree): string {
  const root = tree.people.find(p => p.id === tree.root);
  const clean = (root?.name ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();
  return `${clean ? `${clean} family` : 'Family tree'}${FILE_EXTENSION}`;
}

/**
 * Download the file, on phones and desktop alike. (A share sheet was tried for phones, but it isn't a download:
 * it opens a menu instead, and where it isn't offered nothing happened.) The type is generic so no browser
 * tries to show the JSON in a tab instead of saving it.
 */
export function saveFile(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** The text of a file the person picked or dropped. */
export async function readFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error('that file is too big to be a Kintree file');
  return file.text();
}
