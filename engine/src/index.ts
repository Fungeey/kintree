// Public API (spec section 7).
export type { Sex, Person, Pet, PetKind, Family, Tree, Title, Spoken, Forms, TitleEntry, SpeakerForms, Generic, GenericForms, Resolution } from './model.ts';
export type { Table } from './table.ts';
export { validateTree, MIN_BORN, MAX_BORN } from './tree.ts';
export { PET_KINDS } from './model.ts';
export { kinPath } from './path.ts';
export { loadTable, matchPattern } from './table.ts';
export { resolve } from './resolve.ts';
export { emptyTree, addPerson, addParent, addChild, addSpouse, addSibling, removePerson, renamePerson, setBorn, setBirthOrder, addPet, renamePet, removePet } from './edit.ts';
export type { Edited } from './edit.ts';
export { sides, visible } from './sides.ts';
export type { Side, View, Sides } from './sides.ts';
export { rankTitle, RANK_YUE, RANK_CMN } from './rank.ts';
export type { RankData } from './rank.ts';
