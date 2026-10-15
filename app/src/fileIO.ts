// Save file / Open file in the browser (PR 1). The format is in ../storage/src/file.ts.
import { FILE_EXTENSION, FILE_MIME } from '../../storage/src/index.ts';
import type { Tree } from '../../engine/src/index.ts';

/** Files bigger than this aren't opened: a tree with photos is a few MB, so this is far past any real file. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** "Mei family.kintree": the root's name, with characters that file systems reject removed. */
export function fileNameFor(tree: Tree): string {
  const root = tree.people.find(p => p.id === tree.root);
  const clean = (root?.name ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();
  return `${clean ? `${clean} family` : 'Family tree'}${FILE_EXTENSION}`;
}

export type Saved = 'shared' | 'downloaded' | 'cancelled';

/** Hand the file to the person: the share sheet on phones (so it can go straight to Messages or Files), a download elsewhere. */
export async function saveFile(text: string, name: string): Promise<Saved> {
  const file = new File([text], name, { type: FILE_MIME });
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const phone = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (phone && nav?.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file] }); return 'shared'; }
    catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // Any other failure falls through to a plain download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

/** The text of a file the person picked or dropped. */
export async function readFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error('that file is too big to be a Kintree file');
  return file.text();
}
