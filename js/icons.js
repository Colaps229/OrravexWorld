// ============================================================
//  icons.js — єдина система іконок: навички, роботи, потреби, категорії, дослідження
// ============================================================
(function () {
  'use strict';
  const RW = window.RW; const D = RW.D;
  const I = RW.ICO = {
    skill: { shooting: '🎯', melee: '⚔️', construction: '🔨', mining: '⛏️', cooking: '🍳', plants: '🌱', medicine: '⚕️', crafting: '🛠️', research: '🔬', social: '💬', animals: '🐾' },
    work: { firefight: '🔥', doctor: '⚕️', hunt: '🏹', construct: '🔨', mine: '⛏️', grow: '🌾', cook: '🍳', craft: '🛠️', research: '🔬', haul: '📦', animals: '🐾', warden: '⛓️' },
    need: { mood: '🙂', food: '🍖', rest: '😴', joy: '🎭', blood: '🩸', pain: '⚡', temp: '🌡️', beauty: '🌸' },
    bcat: { structure: '🧱', furniture: '🛏️', production: '⚙️', power: '⚡', light: '💡', security: '🛡️', joy: '🎲', misc: '📎' },
    icat: { resource: '🪵', chunk: '🪨', currency: '🪙', rawfood: '🥕', meal: '🍲', drink: '🍺', herb: '🌿', medicine: '💊', weapon: '🔫', apparel: '👕', corpse: '💀' },
    res: { stonecutting: '🪨', textiles: '🧵', agriculture: '🌾', metalwork: '⚒️', medicine: '⚕️', recreation: '🎲', electricity: '⚡', solar: '☀️', tv: '📺', machining: '⚙️', gunsmithing: '🔫', rifles: '🔫', armor: '🦺', turrets: '🗼', starflight: '🚀' },
    win: { colony: '🏕️', history: '📜', help: '❔', trade: '💱', work: '⚒️', research: '🔬', sched: '🕑', people: '👥', prison: '⛓️', world: '🌍', versions: '🧬', letter: '✉️' },
    plant: { rice: '🌾', potato: '🥔', corn: '🌽', cotton: '☁️', healroot: '🌿', berry: '🫐' }
  };
  const LET = [[/ворож|рейд|напад|облог|бій|піратськ|племін/i, '⚔️'], [/торгов|караван|купц/i, '🛒'], [/вантаж|впал|капсул|дар/i, '📦'], [/хвороб|спалах|епідем|захвор|чума|грип/i, '🤒'], [/пожеж|вогон/i, '🔥'], [/землетрус/i, '🌋'], [/метеор|зір/i, '☄️'], [/токсич/i, '☣️'], [/град|буря|дощ|сніг|холод|спека|погод/i, '⛈️'], [/зрив|істерик|берсерк|депрес/i, '🤯'], [/весілл|закох|стосунк|свято|вечірк/i, '💞'], [/загин|смерт|помер/i, '💀'], [/вмер|поховат/i, '⚰️'], [/дослідж|технолог/i, '🔬'], [/приручен|тварин|стадо|манхант/i, '🐾'], [/в.язн|полон|втеча/i, '⛓️'], [/колоніст|приєдн|мандрівн|біженц|новий/i, '🧑'], [/натхнен/i, '💡'], [/навич|рівень/i, '⭐'], [/оперц|протез|бионі/i, '🩺'], [/шедевр|створив/i, '🏆'], [/голод|їж/i, '🍖'], [/корабел|політ|перемог/i, '🚀']];
  I.letter = L => { const t = (L.title || '') + ' ' + (L.text || ''); for (const [re, ic] of LET) if (re.test(L.title || '')) return ic; for (const [re, ic] of LET) if (re.test(t)) return ic; return { bad: '⚠️', good: '✅', warn: '❗', info: '✉️' }[L.kind] || '✉️'; };
  I.tag = (kind, id) => (I[kind] && I[kind][id]) || '';
  const pre = (obj, map, key) => { for (const k in obj) { const ic = map[k]; if (!ic) continue; if (key) { if (obj[k][key] && !obj[k][key].startsWith(ic)) obj[k][key] = ic + ' ' + obj[k][key]; } else if (typeof obj[k] === 'string' && !obj[k].startsWith(ic)) obj[k] = ic + ' ' + obj[k]; } };
  D.skillIco = I.skill;
  D.workTypes.forEach(w => { const ic = I.work[w.id]; if (ic && !w.name.startsWith(ic)) w.name = ic + ' ' + w.name; });
  D.buildCats.forEach(c => { const ic = I.bcat[c.id]; if (ic && !c.name.startsWith(ic)) c.name = ic + ' ' + c.name; });
  pre(D.itemCats, I.icat); pre(D.research, I.res, 'name');
  // нові дослідження/категорії, додані пізніше (ледачо)
  I.refresh = () => { D.workTypes.forEach(w => { const ic = I.work[w.id]; if (ic && !w.name.startsWith(ic)) w.name = ic + ' ' + w.name; }); pre(D.itemCats, I.icat); };
  window.addEventListener('load', I.refresh);
})();
