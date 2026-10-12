// Test family. "me" is a married man. Ids double as readable names.
import type { Tree, Sex } from '../src/index.ts';

const p = (id: string, sex: Sex) => ({ id, sex });
const fam = (id: string, parents: string[], children: string[]) => ({ id, parents, children });

export const tree: Tree = {
  version: 1,
  people: [
    p('me', 'm'), p('dad', 'm'), p('mum', 'f'), p('elderSis', 'f'), p('youngerBro', 'm'),
    p('yeye', 'm'), p('maama', 'f'), p('dadElderBro', 'm'), p('dadYoungerSis', 'f'),
    p('bomu', 'f'), p('cousinA', 'm'), p('cousinB', 'f'),
    p('guzheung', 'm'), p('cousinC', 'm'),
    p('mumYoungerSis', 'f'), p('mumYoungerBro', 'm'), p('jizheung', 'm'), p('cousinD', 'f'), p('cousinDHusband', 'm'),
    p('yeyeElderBro', 'm'), p('dadCousin', 'm'),
    p('wife', 'f'), p('son', 'm'), p('daughter', 'f'),
    p('wifeDad', 'm'), p('wifeMum', 'f'), p('wifeElderBro', 'm'), p('wifeYoungerSis', 'f'), p('webWife', 'f'),
    p('wifeGrandma', 'f'),
    p('sonWife', 'f'), p('grandson', 'm'), p('dauHusband', 'm'), p('dauSon', 'm'), p('greatGrandson', 'm'),
    p('esHusband', 'm'), p('esSon', 'm'),
    p('stranger', 'f'),
  ],
  families: [
    fam('f_me', ['dad', 'mum'], ['elderSis', 'me', 'youngerBro']),
    fam('f_dad', ['yeye', 'maama'], ['dadElderBro', 'dad', 'dadYoungerSis']),
    fam('f_mum', [], ['mum', 'mumYoungerSis', 'mumYoungerBro']),          // unknown parents
    fam('f_yeye', [], ['yeyeElderBro', 'yeye']),
    fam('f_yeb', ['yeyeElderBro'], ['dadCousin']),                       // one known parent
    fam('f_debro', ['dadElderBro', 'bomu'], ['cousinA', 'cousinB']),
    fam('f_dysis', ['guzheung', 'dadYoungerSis'], ['cousinC']),
    fam('f_mys', ['mumYoungerSis', 'jizheung'], ['cousinD']),
    fam('f_cd', ['cousinD', 'cousinDHusband'], []),
    fam('f_us', ['me', 'wife'], ['son', 'daughter']),
    fam('f_wife', ['wifeDad', 'wifeMum'], ['wifeElderBro', 'wife', 'wifeYoungerSis']),
    fam('f_wm', ['wifeGrandma'], ['wifeMum']),
    fam('f_web', ['wifeElderBro', 'webWife'], []),
    fam('f_yb', ['youngerBro', 'wifeYoungerSis'], []),                    // brother married wife's sister: tie-break case
    fam('f_son', ['son', 'sonWife'], ['grandson']),
    fam('f_grandson', ['grandson'], ['greatGrandson']),
    fam('f_dau', ['dauHusband', 'daughter'], ['dauSon']),
    fam('f_es', ['esHusband', 'elderSis'], ['esSon']),
  ],
};
