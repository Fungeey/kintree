// The .kintree file: the whole tree as readable JSON, for Save file / Open file.
//   { kintree: 1, saved, me, treeId?, tree: {version, root?, people, families, pets?}, photos: {} }
// Unlike the link it does not depend on the link's binary encoding. `photos` is empty for now; photo ids will map to
// data: URLs there, so later steps add to this format without changing what is written today. Unknown fields are ignored on open.
import { finish, isTreeId } from './format.ts';
import type { Snapshot } from './format.ts';
import { validateTree } from '../../engine/src/index.ts';
import type { Person, Family, Pet, Tree } from '../../engine/src/index.ts';

export const FILE_VERSION = 1;
export const FILE_EXTENSION = '.kintree';
export const FILE_MIME = 'application/json';

export function encodeFile(snap: Snapshot, now: Date = new Date()): string {
  const { tree, me, treeId } = snap;
  validateTree(tree);
  if (me !== null && !tree.people.some((p) => p.id === me)) throw new Error(`me "${me}" is not in the tree`);
  if (treeId !== undefined && !isTreeId(treeId)) throw new Error('bad tree id');
  return JSON.stringify({
    kintree: FILE_VERSION,
    saved: now.toISOString(),
    me,
    ...(treeId ? { treeId } : {}),
    tree: {
      version: 1,
      ...(tree.root ? { root: tree.root } : {}),
      people: tree.people,
      families: tree.families,
      ...(tree.pets?.length ? { pets: tree.pets } : {}),
    },
    photos: {},
  }, null, 1) + '\n';
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Read a .kintree file's text. Throws a readable error on anything that isn't one, or comes from a newer version. */
export function decodeFile(text: string): Snapshot {
  let j: unknown;
  try { j = JSON.parse(text); } catch { throw new Error('not a Kintree file'); }
  if (!isObj(j) || typeof j.kintree !== 'number') throw new Error('not a Kintree file');
  if (!Number.isInteger(j.kintree) || j.kintree < 1) throw new Error('not a Kintree file');
  if (j.kintree > FILE_VERSION) throw new Error('this file was saved by a newer version of Kintree');
  const t = j.tree;
  if (!isObj(t) || !Array.isArray(t.people) || !Array.isArray(t.families)) throw new Error('file is corrupt: no tree');
  if (j.me !== null && j.me !== undefined && typeof j.me !== 'string') throw new Error('file is corrupt: bad "me"');
  if (j.treeId !== undefined && !isTreeId(j.treeId)) throw new Error('file is corrupt: bad tree id');
  // Copy only the known fields, with the right types, so a hand-edited or foreign file can't smuggle in anything else.
  const str = (x: unknown, what: string): string => {
    if (typeof x !== 'string') throw new Error(`file is corrupt: bad ${what}`);
    return x;
  };
  const strs = (x: unknown, what: string): string[] => {
    if (!Array.isArray(x)) throw new Error(`file is corrupt: bad ${what}`);
    return x.map((v) => str(v, what));
  };
  const rec = (x: unknown, what: string): Record<string, unknown> => {
    if (!isObj(x)) throw new Error(`file is corrupt: bad ${what}`);
    return x;
  };
  const optName = (x: unknown): { name?: string } => (typeof x === 'string' && x ? { name: x } : {});
  const tree: Tree = {
    version: 1,
    people: t.people.map((v): Person => {
      const p = rec(v, 'person');
      return { id: str(p.id, 'person id'), sex: p.sex as Person['sex'], ...optName(p.name) };
    }),
    families: t.families.map((v): Family => {
      const f = rec(v, 'family');
      return { id: str(f.id, 'family id'), parents: strs(f.parents, 'parents'), children: strs(f.children, 'children') };
    }),
  };
  const pets = Array.isArray(t.pets)
    ? t.pets.map((v): Pet => {
      const a = rec(v, 'pet');
      return { id: str(a.id, 'pet id'), kind: a.kind as Pet['kind'], owner: str(a.owner, 'pet owner'), ...optName(a.name) };
    })
    : undefined;
  try {
    // finish() runs validateTree: duplicate ids, sexes, references and pet kinds.
    return finish(tree, (j.me as string | null | undefined) ?? null, typeof t.root === 'string' ? t.root : undefined, pets, j.treeId as string | undefined);
  } catch (e) {
    throw new Error(`file is corrupt: ${(e as Error).message}`);
  }
}
