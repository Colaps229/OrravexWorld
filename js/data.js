'use strict';
// ============================================================
//  data.js — усі дані гри: терени, предмети, будівлі, рецепти,
//  дослідження, риси, біографії, сценарії, біоми
// ============================================================
(function () {
  const D = RW.D = {};

  // ---- Час ----
  D.DAY = 7200;       // тіків у добі
  D.HOUR = 300;       // тіків у годині
  D.SEASON_DAYS = 15;
  D.YEAR_DAYS = 60;
  D.SEASONS = ['Весна', 'Літо', 'Осінь', 'Зима'];
  D.TILE = 32;

  // ---- Терени ----
  D.terrain = [
    { id: 0, key: 'deep', name: 'Глибока вода', fert: 0, build: false, walk: 0 },
    { id: 1, key: 'shallow', name: 'Мілка вода', fert: 0, build: false, walk: 3.2 },
    { id: 2, key: 'sand', name: 'Пісок', fert: 0.25, build: true, walk: 1.25 },
    { id: 3, key: 'gravel', name: 'Гравій', fert: 0.55, build: true, walk: 1 },
    { id: 4, key: 'soil', name: 'Ґрунт', fert: 1.0, build: true, walk: 1 },
    { id: 5, key: 'rich', name: 'Родючий ґрунт', fert: 1.4, build: true, walk: 1 },
    { id: 6, key: 'snow', name: 'Сніг', fert: 0.15, build: true, walk: 1.35 },
    { id: 7, key: 'rock', name: 'Кам\'яна підлога', fert: 0, build: true, walk: 1 }
  ];

  // Природні блоки (map.blk)
  D.blocks = {
    5: { name: 'Кристалічна жила', hp: 900, drop: 'crystal', n: 3, color: '#9a7aff' },
    1: { name: 'Скеля', hp: 500 },
    2: { name: 'Сталева руда', hp: 600, drop: 'steel', n: 35, color: '#8fb6d8' },
    3: { name: 'Срібна руда', hp: 600, drop: 'silver', n: 40, color: '#e3e3ea' },
    4: { name: 'Золота руда', hp: 700, drop: 'gold', n: 20, color: '#f0c43a' }
  };

  // ---- Предмети ----
  D.items = {};
  function item(id, o) { o.id = id; o.stack = o.stack || 75; o.value = o.value || 0; D.items[id] = o; return o; }
  item('wood', { name: 'Деревина', cat: 'resource', stack: 75, value: 1.2, color: '#9a6a3a', flam: 1 });
  item('stone_chunk', { name: 'Кам\'яна брила', cat: 'chunk', stack: 25, value: 0.4, color: '#8d8d8d' });
  item('stone_block', { name: 'Кам\'яні блоки', cat: 'resource', stack: 75, value: 1.0, color: '#a6a6a6' });
  item('steel', { name: 'Сталь', cat: 'resource', stack: 75, value: 2.5, color: '#9eb4c8' });
  item('silver', { name: 'Срібло', cat: 'currency', stack: 1000, value: 1, color: '#e6e6ee' });
  item('gold', { name: 'Золото', cat: 'resource', stack: 50, value: 12, color: '#f0c43a' });
  item('components', { name: 'Компоненти', cat: 'resource', stack: 50, value: 30, color: '#c07a3a' });
  item('cloth', { name: 'Тканина', cat: 'resource', stack: 75, value: 1.8, color: '#d9d2c0', flam: 1 });
  item('leather', { name: 'Шкіра', cat: 'resource', stack: 75, value: 3, color: '#a86f3f', flam: 0.6 });
  item('cotton', { name: 'Бавовна', cat: 'resource', stack: 75, value: 1.5, color: '#f2f2f2', flam: 1 });
  // їжа (nutr — частка шкали ситості)
  item('berries', { name: 'Ягоди', cat: 'rawfood', kind: 'veg', nutr: 0.06, stack: 75, value: 1.2, color: '#c2305a', rot: 8 * 7200, flam: 0.3 });
  item('rice', { name: 'Рис', cat: 'rawfood', kind: 'veg', nutr: 0.08, stack: 75, value: 1.3, color: '#e7dcae', rot: 20 * 7200, flam: 0.5 });
  item('potato', { name: 'Картопля', cat: 'rawfood', kind: 'veg', nutr: 0.10, stack: 75, value: 1.5, color: '#b78f55', rot: 20 * 7200, flam: 0.3 });
  item('corn', { name: 'Кукурудза', cat: 'rawfood', kind: 'veg', nutr: 0.09, stack: 75, value: 1.4, color: '#e8c23a', rot: 20 * 7200, flam: 0.4 });
  item('meat', { name: 'Сире м\'ясо', cat: 'rawfood', kind: 'meat', nutr: 0.06, stack: 75, value: 1.8, color: '#b33a3a', rot: 3.5 * 7200, flam: 0.1 });
  item('meal_simple', { name: 'Простий обід', cat: 'meal', nutr: 0.55, stack: 10, value: 7, color: '#c99a5a', rot: 5 * 7200 });
  item('meal_fine', { name: 'Вишуканий обід', cat: 'meal', nutr: 0.70, stack: 10, value: 12, color: '#d9733a', rot: 5 * 7200 });
  item('healroot', { name: 'Цілющий корінь', cat: 'herb', stack: 75, value: 8, color: '#5aa84a', rot: 25 * 7200, flam: 0.7 });
  item('herbal', { name: 'Трав\'яні ліки', cat: 'medicine', potency: 0.6, stack: 25, value: 12, color: '#6fc060', rot: 40 * 7200 });
  item('medicine', { name: 'Ліки', cat: 'medicine', potency: 1.0, stack: 25, value: 32, color: '#4aa8d8' });
  // зброя
  item('bow', { name: 'Лук', cat: 'weapon', stack: 1, value: 40, color: '#9a6a3a', w: { kind: 'ranged', dmg: 12, range: 22, warmup: 50, cd: 62, burst: 1, acc: 0.78, proj: 'arrow', dtype: 'stab' } });
  item('revolver', { name: 'Револьвер', cat: 'weapon', stack: 1, value: 120, color: '#555a60', w: { kind: 'ranged', dmg: 12, range: 22, warmup: 26, cd: 52, burst: 1, acc: 0.8, proj: 'bullet', dtype: 'bullet' } });
  item('rifle', { name: 'Автоматична гвинтівка', cat: 'weapon', stack: 1, value: 220, color: '#444a50', w: { kind: 'ranged', dmg: 11, range: 30, warmup: 36, cd: 84, burst: 3, acc: 0.86, proj: 'bullet', dtype: 'bullet' } });
  item('knife', { name: 'Ніж', cat: 'weapon', stack: 1, value: 25, color: '#c0c8d0', w: { kind: 'melee', dmg: 9, cd: 40, dtype: 'cut', acc: 0.8 } });
  item('spear', { name: 'Списа', cat: 'weapon', stack: 1, value: 22, color: '#8a6a3a', w: { kind: 'melee', dmg: 14, cd: 50, dtype: 'stab', acc: 0.78 } });
  item('stone_knife', { name: 'Кам\'яний ніж', cat: 'weapon', stack: 1, value: 10, color: '#9a9a90', w: { kind: 'melee', dmg: 8, cd: 38, dtype: 'cut', acc: 0.76 } });
  item('crystal', { name: 'Кристал', cat: 'resource', stack: 25, value: 55, color: '#9a7aff' });
  item('club', { name: 'Кийок', cat: 'weapon', stack: 1, value: 18, color: '#7a5230', w: { kind: 'melee', dmg: 11, cd: 52, dtype: 'blunt', acc: 0.75 } });
  // одяг
  item('parka', { name: 'Парка', cat: 'apparel', stack: 1, value: 90, color: '#4a6aa8', ap: { insul: 26, sharp: 0.1, blunt: 0.05 } });
  item('flak_vest', { name: 'Бронежилет', cat: 'apparel', stack: 1, value: 160, color: '#5a6a4a', ap: { insul: 4, sharp: 0.55, blunt: 0.3 } });
  item('tribal_wear', { name: 'Племінний одяг', cat: 'apparel', stack: 1, value: 30, color: '#8a6a3a', ap: { insul: 8, sharp: 0.05, blunt: 0.02 } });
  // трупи
  item('corpse', { name: 'Труп', cat: 'corpse', stack: 1, value: 0, color: '#6a3a3a' });
  item('corpse_animal', { name: 'Туша', cat: 'corpse', stack: 1, value: 0, color: '#7a4a3a' });

  D.itemCats = {
    resource: 'Ресурси', chunk: 'Брили', currency: 'Валюта', rawfood: 'Сира їжа', meal: 'Страви', herb: 'Трави',
    medicine: 'Медицина', weapon: 'Зброя', apparel: 'Одяг', corpse: 'Трупи'
  };

  // ---- Рослини ----
  D.plants = {
    tree_oak: { name: 'Дуб', tree: true, wood: 26, work: 200, hp: 80, flam: 0.8, size: 1.15 },
    tree_pine: { name: 'Ялина', tree: true, wood: 22, work: 180, hp: 70, flam: 0.9, size: 1.0 },
    tree_palm: { name: 'Пальма', tree: true, wood: 16, work: 150, hp: 50, flam: 0.6, size: 0.95 },
    tree_birch: { name: 'Береза', tree: true, wood: 20, work: 160, hp: 60, flam: 0.8, size: 1.0 },
    bush_berry: { name: 'Ягідний кущ', wild: true, item: 'berries', n: 6, work: 90, regrow: 2.5 * 7200, hp: 15, flam: 0.7 },
    wild_healroot: { name: 'Цілющий корінь (дикий)', wild: true, item: 'healroot', n: 2, work: 110, regrow: 8 * 7200, hp: 10, flam: 0.7 },
    rice: { name: 'Рис', crop: true, item: 'rice', n: 8, grow: 3.0 * 7200, work: 110, hp: 12, minT: 6, flam: 0.9, research: null },
    potato: { name: 'Картопля', crop: true, item: 'potato', n: 8, grow: 3.8 * 7200, work: 120, hp: 12, minT: 5, flam: 0.7, research: null },
    corn: { name: 'Кукурудза', crop: true, item: 'corn', n: 12, grow: 5 * 7200, work: 130, hp: 14, minT: 8, flam: 0.7, research: 'agriculture' },
    healroot: { name: 'Цілющий корінь', crop: true, item: 'healroot', n: 3, grow: 5 * 7200, work: 130, hp: 10, minT: 6, flam: 0.7, research: 'medicine' },
    cotton: { name: 'Бавовна', crop: true, item: 'cotton', n: 7, grow: 4 * 7200, work: 130, hp: 12, minT: 7, flam: 0.9, research: 'textiles' }
  };

  // ---- Тварини ----
  D.animals = {
    deer: { name: 'Олень', hp: 55, speed: 0.07, flee: true, meat: 40, leather: 14, color: '#b98a5a', size: 1.1, herd: true, dmg: 0 },
    boar: { name: 'Дикий кабан', hp: 70, speed: 0.06, flee: false, meat: 45, leather: 12, color: '#6a4a38', size: 0.95, herd: true, dmg: 11, defend: true },
    rabbit: { name: 'Кролик', hp: 12, speed: 0.08, flee: true, meat: 8, leather: 2, color: '#b8a58a', size: 0.5, herd: false, dmg: 0 },
    wolf: { name: 'Вовк', hp: 50, speed: 0.085, flee: false, meat: 28, leather: 8, color: '#6e747c', size: 0.95, herd: true, dmg: 9, predator: true },
    dog: { name: 'Пес', hp: 45, speed: 0.08, meat: 20, leather: 6, color: '#a47a4a', size: 0.8, dmg: 7, pet: true },
    cat: { name: 'Кіт', hp: 22, speed: 0.08, meat: 6, leather: 2, color: '#8a8a8a', size: 0.55, dmg: 3, pet: true }
  };

  // ---- Навички та робота ----
  D.skills = ['shooting', 'melee', 'construction', 'mining', 'cooking', 'plants', 'medicine', 'crafting', 'research', 'social'];
  D.skillNames = { shooting: 'Стрільба', melee: 'Ближній бій', construction: 'Будівництво', mining: 'Видобуток', cooking: 'Кулінарія', plants: 'Рослинництво', medicine: 'Медицина', crafting: 'Ремесло', research: 'Дослідження', social: 'Спілкування' };
  D.passionNames = ['', 'Цікавиться', 'Палко захоплений'];

  D.workTypes = [
    { id: 'firefight', name: 'Гасіння', skill: null },
    { id: 'doctor', name: 'Лікування', skill: 'medicine' },
    { id: 'hunt', name: 'Полювання', skill: 'shooting', violent: true },
    { id: 'construct', name: 'Будівництво', skill: 'construction' },
    { id: 'mine', name: 'Видобуток', skill: 'mining' },
    { id: 'grow', name: 'Рослинництво', skill: 'plants' },
    { id: 'cook', name: 'Кулінарія', skill: 'cooking' },
    { id: 'craft', name: 'Ремесло', skill: 'crafting' },
    { id: 'research', name: 'Дослідження', skill: 'research' },
    { id: 'haul', name: 'Перенесення', skill: null }
  ];

  // ---- Біографії ----
  D.backstories = {
    child: [
      { id: 'tribal_kid', title: 'Дитина племені', desc: 'Виросла серед кочівників, вчилася у старійшин.', skills: { plants: 3, melee: 2, crafting: 2, research: -3 } },
      { id: 'med_apprentice', title: 'Учень лікаря', desc: 'З дитинства допомагав у лікарні колонії.', skills: { medicine: 4, social: 1, melee: -2 } },
      { id: 'street_kid', title: 'Безпритульний', desc: 'Вижив на вулицях орбітальної станції.', skills: { shooting: 2, melee: 2, social: 1, research: -2 } },
      { id: 'farm_kid', title: 'Фермерське дитинство', desc: 'Змалку працював на полях.', skills: { plants: 4, construction: 1, cooking: 1, shooting: -1 } },
      { id: 'prodigy', title: 'Вундеркінд', desc: 'Складав рівняння раніше, ніж навчився бігати.', skills: { research: 5, crafting: 2, melee: -2, mining: -2 } },
      { id: 'soldier_brat', title: 'Дитина військового', desc: 'Дисципліна й стрільбище з п\'яти років.', skills: { shooting: 3, melee: 2, social: -1 } },
      { id: 'cargo_kid', title: 'Юнга на вантажнику', desc: 'Виріс між контейнерами та двигунами.', skills: { construction: 3, crafting: 2, mining: 1, plants: -2 } }
    ],
    adult: [
      { id: 'soldier', title: 'Солдат', desc: 'Багато років служив у наймах.', skills: { shooting: 6, melee: 4, social: -2 }, },
      { id: 'doctor', title: 'Лікар', desc: 'Рятував життя в польових госпіталях.', skills: { medicine: 8, social: 2, melee: -3 } },
      { id: 'engineer', title: 'Інженер', desc: 'Будував станції та лагодив реактори.', skills: { construction: 6, crafting: 5, research: 3, plants: -3 } },
      { id: 'farmer', title: 'Фермер', desc: 'Вирощував культури на сотнях акрів.', skills: { plants: 8, cooking: 2, construction: 2, shooting: -2 } },
      { id: 'cook', title: 'Кухар', desc: 'Годував екіпажі великих кораблів.', skills: { cooking: 8, plants: 2, social: 1, mining: -2 } },
      { id: 'miner', title: 'Шахтар', desc: 'Двадцять років у рудниках.', skills: { mining: 8, construction: 3, melee: 2, research: -3 } },
      { id: 'scientist', title: 'Науковець', desc: 'Працював у лабораторії великого концерну.', skills: { research: 8, medicine: 2, crafting: 1, melee: -3, mining: -2 } },
      { id: 'monk', title: 'Чернець-пацифіст', desc: 'Присягнув ніколи не підіймати зброї.', skills: { social: 4, plants: 3, medicine: 2, shooting: 0, melee: 0 }, disable: ['violent', 'hunt'] },
      { id: 'trader', title: 'Торговець', desc: 'Знає ціну всьому в галактиці.', skills: { social: 8, shooting: 2, construction: -2, mining: -3 } },
      { id: 'outlaw', title: 'Розбійник', desc: 'Втікач із кількох систем.', skills: { shooting: 5, melee: 5, social: -4, medicine: -3 }, disable: ['doctor'] },
      { id: 'artisan', title: 'Ремісник', desc: 'Створював речі, що пережили покоління.', skills: { crafting: 8, construction: 3, cooking: 1, shooting: -2 } },
      { id: 'drifter', title: 'Мандрівник', desc: 'Скрізь трохи, ніде довго.', skills: { shooting: 1, melee: 1, plants: 1, construction: 1, social: 1 } }
    ]
  };

  // ---- Риси ----
  D.traits = [
    { id: 'industrious', name: 'Працьовитий', desc: 'Швидкість роботи +35%.', work: 1.35, excl: 'work' },
    { id: 'hard_worker', name: 'Старанний', desc: 'Швидкість роботи +20%.', work: 1.2, excl: 'work' },
    { id: 'lazy', name: 'Лінивий', desc: 'Швидкість роботи −20%.', work: 0.8, excl: 'work' },
    { id: 'slothful', name: 'Ледар', desc: 'Швидкість роботи −35%.', work: 0.65, excl: 'work' },
    { id: 'tough', name: 'Витривалий', desc: 'Отримує на 30% менше шкоди.', dmg: 0.7, excl: 'body' },
    { id: 'delicate', name: 'Тендітний', desc: 'Отримує на 30% більше шкоди.', dmg: 1.3, excl: 'body' },
    { id: 'nimble', name: 'Моторний', desc: 'Краще ухиляється в бою (+15%).', dodge: 0.15, excl: 'agility' },
    { id: 'clumsy', name: 'Незграбний', desc: 'Гірше ухиляється (−15%).', dodge: -0.15, excl: 'agility' },
    { id: 'fast', name: 'Швидконогий', desc: 'Рухається на 25% швидше.', move: 1.25, excl: 'move' },
    { id: 'slow', name: 'Повільний', desc: 'Рухається на 20% повільніше.', move: 0.8, excl: 'move' },
    { id: 'sanguine', name: 'Життєрадісний', desc: 'Настрій +12.', mood: 12, excl: 'mood' },
    { id: 'optimist', name: 'Оптиміст', desc: 'Настрій +6.', mood: 6, excl: 'mood' },
    { id: 'pessimist', name: 'Песиміст', desc: 'Настрій −6.', mood: -6, excl: 'mood' },
    { id: 'depressive', name: 'Депресивний', desc: 'Настрій −12.', mood: -12, excl: 'mood' },
    { id: 'brawler', name: 'Забіяка', desc: 'Ближній бій +25%, але погано стріляє.', melee: 1.25, shoot: 0.85, excl: 'style' },
    { id: 'careful', name: 'Обережний стрілець', desc: 'Точність +15%, повільніше цілиться.', acc: 0.15, warmup: 1.3, excl: 'style' },
    { id: 'trigger', name: 'Швидкий на руку', desc: 'Стріляє на 25% частіше, але менш точно.', cd: 0.75, acc: -0.1, excl: 'style' },
    { id: 'kind', name: 'Добрий', desc: 'Рідко ображає, співрозмовники його люблять.', kind: 1, excl: 'social' },
    { id: 'abrasive', name: 'Грубіян', desc: 'Часто ображає інших.', abrasive: 1, excl: 'social' },
    { id: 'psychopath', name: 'Психопат', desc: 'Не страждає від смертей, але небезпечний.', psycho: 1, excl: 'empathy' },
    { id: 'bloodlust', name: 'Кровожерний', desc: 'Радіє бійкам і смертям ворогів.', blood: 1, excl: 'empathy' },
    { id: 'pyromaniac', name: 'Піроман', desc: 'При зриві може підпалювати.', pyro: 1, excl: 'fire' },
    { id: 'gourmand', name: 'Ненажера', desc: 'Їсть більше, але вишукана їжа дає більший настрій.', gourmand: 1, excl: 'food' },
    { id: 'iron_will', name: 'Залізна воля', desc: 'Витримує менший настрій без зриву.', breakMod: -8, excl: 'will' },
    { id: 'nervous', name: 'Нервовий', desc: 'Зривається раніше.', breakMod: 8, excl: 'will' },
    { id: 'night_owl', name: 'Нічна пташка', desc: 'Добре почувається вночі, погано вранці.', night: 1, excl: 'rhythm' }
  ];

  // ---- Думки (пам'ять настрою) ----
  const HR = 300, DY = 7200;
  D.thoughts = {
    ate_raw: { l: 'Їв сиру їжу', v: -6, dur: 1.5 * DY },
    ate_simple: { l: 'Їв простий обід', v: 1, dur: 0.6 * DY },
    ate_fine: { l: 'Їв вишуканий обід', v: 6, dur: 1.2 * DY },
    ate_nodesk: { l: 'Їв без стола', v: -3, dur: 0.8 * DY },
    ate_table: { l: 'Їв за столом', v: 3, dur: 0.8 * DY },
    slept_ground: { l: 'Спав на землі', v: -5, dur: 1 * DY },
    slept_spot: { l: 'Спав на спальному місці', v: -2, dur: 1 * DY },
    slept_bed: { l: 'Спав у ліжку', v: 3, dur: 1 * DY },
    slept_hosp: { l: 'Спав у лікарняному ліжку', v: 5, dur: 1 * DY },
    slept_cold: { l: 'Спав на морозі', v: -8, dur: 1 * DY },
    saw_corpse: { l: 'Бачив труп', v: -6, dur: 1.2 * DY },
    friend_died: { l: 'Помер друг', v: -14, dur: 8 * DY, stack: 3 },
    colonist_died: { l: 'Помер колоніст', v: -5, dur: 4 * DY, stack: 4 },
    rival_died: { l: 'Помер ворог', v: 6, dur: 3 * DY },
    killed_enemy: { l: 'Вбив ворога', v: 8, dur: 1.5 * DY, stack: 3, blood: 1 },
    insulted: { l: 'Мене образили', v: -6, dur: 2 * DY, stack: 3 },
    chitchat: { l: 'Приємна розмова', v: 2, dur: 1.5 * DY, stack: 3 },
    deep_talk: { l: 'Глибока розмова', v: 5, dur: 2.5 * DY, stack: 2 },
    in_love: { l: 'Кохання', v: 8, dur: 6 * DY },
    heartbreak: { l: 'Розбите серце', v: -10, dur: 5 * DY },
    catharsis: { l: 'Катарсис', v: 40, dur: 1.2 * DY },
    played: { l: 'Гарно розважився', v: 3, dur: 1 * DY, stack: 2 },
    petted: { l: 'Погладив тварину', v: 3, dur: 1 * DY },
    wet: { l: 'Змок під дощем', v: -3, dur: 0.4 * DY },
    wounded_fought: { l: 'Бій: поранення', v: -4, dur: 1 * DY },
    pod_landing: { l: 'Аварійна посадка', v: -6, dur: 1.5 * DY },
    new_world: { l: 'Нова планета: надія', v: 5, dur: 3 * DY },
    cured: { l: 'Одужав', v: 4, dur: 1.5 * DY },
    missing_limb: { l: 'Втрата кінцівки', v: -8, dur: 30 * DY },
    ate_corpse_nope: { l: 'Огидний запах', v: -3, dur: 0.5 * DY },
    fire_nearby: { l: 'Пожежа поруч', v: -4, dur: 0.5 * DY }
  };

  // ---- Типи поранень і хвороб ----
  D.injuryTypes = {
    cut: { l: 'Поріз', bleed: 1.0, pain: 1.0, heal: 1.0 },
    stab: { l: 'Колота рана', bleed: 1.0, pain: 1.1, heal: 0.9 },
    bullet: { l: 'Вогнепальне', bleed: 0.9, pain: 1.2, heal: 0.8 },
    blunt: { l: 'Забій', bleed: 0.2, pain: 1.3, heal: 1.3 },
    bite: { l: 'Укус', bleed: 0.85, pain: 1.1, heal: 0.9 },
    burn: { l: 'Опік', bleed: 0, pain: 1.5, heal: 0.7 },
    scratch: { l: 'Подряпина', bleed: 0.4, pain: 0.5, heal: 1.8 }
  };
  D.illnesses = {
    infection: { l: 'Інфекція', sev: 0.00009, imm: 0.00005, lethal: true, cons: 0.4, pain: 0.1 },
    flu: { l: 'Грип', sev: 0.00006, imm: 0.00005, lethal: false, cons: 0.35, move: 0.2, pain: 0.0 },
    food_poison: { l: 'Харчове отруєння', sev: 0.00009, imm: 0.00012, lethal: false, cons: 0.3, pain: 0.2, move: 0.3 },
    malaria: { l: 'Малярія', sev: 0.00007, imm: 0.00005, lethal: true, cons: 0.4, move: 0.2 },
    plague: { l: 'Чума', sev: 0.00011, imm: 0.00005, lethal: true, cons: 0.5, move: 0.35, pain: 0.1 },
    hypothermia: { l: 'Переохолодження', sev: 0, imm: 0, lethal: true, cons: 0.5, move: 0.4, env: true },
    heatstroke: { l: 'Тепловий удар', sev: 0, imm: 0, lethal: true, cons: 0.5, move: 0.3, env: true },
    malnutrition: { l: 'Виснаження', sev: 0, imm: 0, lethal: true, cons: 0.3, move: 0.3, env: true }
  };

  D.bodyParts = [
    { id: 'head', name: 'Голова', hp: 30, vital: true, w: 0.08, cons: 1 },
    { id: 'torso', name: 'Тулуб', hp: 50, vital: true, w: 0.42 },
    { id: 'larm', name: 'Ліва рука', hp: 28, w: 0.13, manip: 1 },
    { id: 'rarm', name: 'Права рука', hp: 28, w: 0.13, manip: 1 },
    { id: 'lleg', name: 'Ліва нога', hp: 32, w: 0.12, move: 1 },
    { id: 'rleg', name: 'Права нога', hp: 32, w: 0.12, move: 1 }
  ];

  // ---- Будівлі ----
  D.buildCats = [
    { id: 'structure', name: 'Структури' },
    { id: 'furniture', name: 'Меблі' },
    { id: 'production', name: 'Виробництво' },
    { id: 'power', name: 'Енергія' },
    { id: 'light', name: 'Світло й тепло' },
    { id: 'security', name: 'Безпека' },
    { id: 'joy', name: 'Дозвілля' },
    { id: 'misc', name: 'Інше' }
  ];
  D.bld = {};
  function bld(id, o) {
    o.id = id; o.w = o.w || 1; o.h = o.h || 1; o.cost = o.cost || {}; o.work = o.work == null ? 100 : o.work;
    o.hp = o.hp || 100; if (o.pass == null) o.pass = 1; o.flam = o.flam || 0; o.beauty = o.beauty || 0;
    D.bld[id] = o; return o;
  }
  // структури
  bld('wall_wood', { cat: 'structure', name: 'Дерев\'яна стіна', desc: 'Дешева, але горюча.', cost: { wood: 5 }, work: 90, hp: 140, pass: 0, flam: 0.8, wall: true, color: '#8a5a30' });
  bld('wall_stone', { cat: 'structure', name: 'Кам\'яна стіна', desc: 'Міцна й негорюча.', cost: { stone_block: 5 }, work: 170, hp: 320, pass: 0, wall: true, research: 'stonecutting', color: '#8c8c8c' });
  bld('wall_steel', { cat: 'structure', name: 'Сталева стіна', desc: 'Дуже міцна.', cost: { steel: 5 }, work: 200, hp: 450, pass: 0, wall: true, research: 'metalwork', color: '#7f93a6' });
  bld('door_wood', { cat: 'structure', name: 'Дерев\'яні двері', desc: 'Ділять кімнати, тримають тепло.', cost: { wood: 20 }, work: 120, hp: 100, pass: 1, door: true, flam: 0.8, color: '#7a4a24' });
  bld('door_steel', { cat: 'structure', name: 'Сталеві двері', desc: 'Міцні двері.', cost: { steel: 20 }, work: 200, hp: 300, pass: 1, door: true, research: 'metalwork', color: '#6f8294' });
  bld('floor_wood', { cat: 'structure', name: 'Дерев\'яна підлога', desc: 'Приємна на вигляд.', cost: { wood: 4 }, work: 40, hp: 40, floor: true, beauty: 1, flam: 0.7, color: '#a8794a' });
  bld('floor_stone', { cat: 'structure', name: 'Кам\'яна підлога', desc: 'Гарна й міцна.', cost: { stone_block: 4 }, work: 60, hp: 80, floor: true, beauty: 2, research: 'stonecutting', color: '#9a9a9a' });
  bld('floor_steel', { cat: 'structure', name: 'Металева підлога', desc: 'Практична.', cost: { steel: 4 }, work: 60, hp: 100, floor: true, beauty: 0.5, research: 'metalwork', color: '#7d8a96' });
  // меблі
  bld('sleeping_spot', { cat: 'furniture', name: 'Спальне місце', desc: 'Просто місце для сну на землі.', cost: {}, work: 40, hp: 20, bed: { rest: 0.75, comfort: 0.1, q: 0 }, color: '#8a7a5a' });
  bld('bed', { cat: 'furniture', name: 'Ліжко', desc: 'Комфортний сон.', w: 1, h: 1, cost: { wood: 45, cloth: 10 }, work: 300, hp: 60, bed: { rest: 1.0, comfort: 0.6, q: 1 }, flam: 0.8, beauty: 1, color: '#7a5a3a' });
  bld('hospital_bed', { cat: 'furniture', name: 'Лікарняне ліжко', desc: 'Покращує лікування й відновлення.', w: 1, h: 1, cost: { steel: 40, cloth: 12 }, work: 380, hp: 70, bed: { rest: 1.05, comfort: 0.5, q: 2, med: true }, research: 'medicine', color: '#6a8a9a' });
  bld('table', { cat: 'furniture', name: 'Обідній стіл', desc: 'Їсти за столом приємніше.', w: 2, h: 1, cost: { wood: 30 }, work: 160, hp: 70, pass: 2, table: true, flam: 0.8, beauty: 0.5, color: '#8a5a30' });
  bld('chair', { cat: 'furniture', name: 'Стілець', desc: 'Комфортно сидіти.', cost: { wood: 12 }, work: 80, hp: 40, pass: 2, chair: 0.55, flam: 0.8, color: '#7a4a24' });
  // виробництво
  bld('workbench', { cat: 'production', name: 'Верстак', desc: 'Лук, ніж, кийок, трав\'яні ліки.', w: 2, h: 1, cost: { wood: 50, steel: 20 }, work: 280, hp: 90, pass: 2, bench: true, color: '#7a5a3a' });
  bld('crafting_spot', { cat: 'production', name: 'Місце ремесла', desc: 'Примітивне: кийок, спис, кам\'яний ніж, лук. Без досліджень.', w: 2, h: 1, cost: { wood: 12 }, work: 90, hp: 50, pass: 2, bench: true, color: '#8a6a44' });
  bld('crystal_array', { cat: 'production', name: 'Кристалічний масив', desc: '+15% до швидкості досліджень (до 2 масивів).', w: 1, h: 1, cost: { crystal: 4, steel: 40 }, work: 360, hp: 90, pass: 0, crystal: true, color: '#9a7aff' });
  bld('stove', { cat: 'production', name: 'Кухонна плита', desc: 'Готує обіди.', w: 2, h: 1, cost: { steel: 30, wood: 20 }, work: 260, hp: 90, pass: 2, bench: true, heat: 0.4, color: '#6a6a6a' });
  bld('stonecutter', { cat: 'production', name: 'Каменерізний стіл', desc: 'Перетворює брили на блоки.', w: 2, h: 1, cost: { wood: 35, steel: 15 }, work: 250, hp: 90, pass: 2, bench: true, research: 'stonecutting', color: '#8a8a8a' });
  bld('tailor_bench', { cat: 'production', name: 'Швацький стіл', desc: 'Тканина й одяг.', w: 2, h: 1, cost: { wood: 40, steel: 15 }, work: 260, hp: 80, pass: 2, bench: true, research: 'textiles', color: '#9a6a7a' });
  bld('machining', { cat: 'production', name: 'Механічний верстат', desc: 'Компоненти, зброя, ліки, броня.', w: 2, h: 1, cost: { steel: 100 }, work: 420, hp: 120, pass: 2, bench: true, research: 'machining', power: -120, color: '#5a6a7a' });
  bld('research_bench', { cat: 'production', name: 'Дослідницький стіл', desc: 'Тут дослідники вивчають технології.', w: 2, h: 1, cost: { wood: 40, steel: 30 }, work: 320, hp: 90, pass: 2, research_bench: true, color: '#5a7a9a' });
  // енергія
  bld('conduit', { cat: 'power', name: 'Провід', desc: 'З\'єднує енергомережу.', cost: { steel: 1 }, work: 20, hp: 30, pass: 1, conduit: true, research: 'electricity', color: '#a06a30' });
  bld('solar', { cat: 'power', name: 'Сонячна панель', desc: '+170 Вт вдень.', w: 2, h: 2, cost: { steel: 30, components: 3 }, work: 400, hp: 80, pass: 0, power: 170, solar: true, research: 'solar', color: '#2a4a8a' });
  bld('wood_gen', { cat: 'power', name: 'Дров\'яний генератор', desc: '+420 Вт, спалює деревину.', w: 1, h: 2, cost: { steel: 40, components: 1 }, work: 350, hp: 90, pass: 0, power: 420, fuel: { item: 'wood', cap: 12, burn: 1 / 700 }, research: 'electricity', heat: 0.5, light: { r: 3, c: '#ff9a40', a: 0.5 }, color: '#7a5a3a' });
  bld('battery', { cat: 'power', name: 'Акумулятор', desc: 'Накопичує енергію.', cost: { steel: 20, components: 1 }, work: 200, hp: 60, pass: 0, battery: 800, research: 'electricity', color: '#4a6a4a' });
  // світло/тепло
  bld('campfire', { cat: 'light', name: 'Вогнище', desc: 'Світло, тепло, місце для розмов. Потребує дров.', cost: { wood: 20 }, work: 80, hp: 30, pass: 1, fuel: { item: 'wood', cap: 8, burn: 1 / 900 }, light: { r: 8, c: '#ff9030', a: 0.8 }, warm: 7, flam: 0.6, social: true, color: '#c05020' });
  bld('torch', { cat: 'light', name: 'Смолоскип', desc: 'Світло. Потребує дров.', cost: { wood: 6 }, work: 40, hp: 20, pass: 0, fuel: { item: 'wood', cap: 4, burn: 1 / 1800 }, light: { r: 6, c: '#ffa850', a: 0.7 }, flam: 0.9, color: '#a05a20' });
  bld('lamp', { cat: 'light', name: 'Торшер', desc: 'Електричне світло.', cost: { steel: 8 }, work: 60, hp: 30, pass: 0, power: -30, light: { r: 10, c: '#fff0c8', a: 0.9 }, research: 'electricity', color: '#e8d8a0' });
  bld('heater', { cat: 'light', name: 'Обігрівач', desc: 'Підігріває кімнату.', cost: { steel: 30, components: 1 }, work: 160, hp: 60, pass: 0, power: -150, heat: 1.8, research: 'electricity', color: '#a03a2a' });
  bld('cooler', { cat: 'light', name: 'Охолоджувач', desc: 'Охолоджує кімнату.', cost: { steel: 30, components: 1 }, work: 160, hp: 60, pass: 0, power: -150, heat: -1.8, research: 'electricity', color: '#3a6aa0' });
  // безпека
  bld('sandbag', { cat: 'security', name: 'Мішки з піском', desc: 'Укриття від куль.', cost: { cloth: 4 }, work: 50, hp: 60, pass: 2, cover: 0.55, color: '#b8a070' });
  bld('turret', { cat: 'security', name: 'Автотурель', desc: 'Стріляє по ворогах. Потребує живлення.', cost: { steel: 60, components: 3 }, work: 450, hp: 110, pass: 0, power: -90, turret: true, research: 'turrets', color: '#4a5a6a' });
  // дозвілля
  bld('horseshoes', { cat: 'joy', name: 'Підкови', desc: 'Метання підков.', cost: { wood: 15 }, work: 80, hp: 30, pass: 1, joy: { kind: 'horseshoes', rate: 0.0030, outdoor: true }, color: '#7a7a7a' });
  bld('chess', { cat: 'joy', name: 'Шаховий стіл', desc: 'Гра для розуму.', w: 1, h: 1, cost: { wood: 35 }, work: 120, hp: 40, pass: 2, joy: { kind: 'chess', rate: 0.0034 }, research: 'recreation', color: '#4a3a2a' });
  bld('tv', { cat: 'joy', name: 'Телевізор', desc: 'Розважає. Потребує живлення.', w: 2, h: 1, cost: { steel: 25, components: 2 }, work: 220, hp: 50, pass: 0, power: -200, joy: { kind: 'tv', rate: 0.0045 }, research: 'tv', color: '#222a30' });
  // різне
  bld('grave', { cat: 'misc', name: 'Могила', desc: 'Місце поховання. Прибирає трупи з очей.', w: 1, h: 2, cost: { wood: 20 }, work: 100, hp: 40, pass: 1, grave: true, color: '#7a6a50' });
  bld('ship_engine', { cat: 'misc', name: 'Двигун корабля', desc: 'Дозволяє залишити планету. Перемога!', w: 2, h: 2, cost: { steel: 400, components: 30, gold: 30 }, work: 3000, hp: 400, pass: 0, ship: true, research: 'starflight', color: '#9aa8b8' });
  bld('pod_wreck', { cat: 'hidden', name: 'Уламки капсули', desc: 'Залишки посадкової капсули. Можна розібрати на сталь.', w: 1, h: 1, cost: {}, work: 0, hp: 160, pass: 0, wreck: true, color: '#6a6a70', refund: { steel: 22 } });
  bld('ship_wreck', { cat: 'hidden', name: 'Уламки корабля', desc: 'Розбитий корпус вашого корабля. Можна розібрати на сталь і компоненти.', w: 5, h: 3, cost: {}, work: 0, hp: 900, pass: 0, wreck: true, color: '#6a6a70', refund: { steel: 140, components: 4 } });

  // ---- Рецепти ----
  D.recipes = {
    simple_meal: { name: 'Простий обід', bench: ['stove'], skill: 'cooking', work: 320, ing: [{ group: 'rawfood', n: 4 }], out: 'meal_simple', n: 1 },
    fine_meal: { name: 'Вишуканий обід', bench: ['stove'], skill: 'cooking', work: 460, ing: [{ group: 'meat', n: 2 }, { group: 'veg', n: 2 }], out: 'meal_fine', n: 1 },
    bow: { name: 'Лук', bench: ['crafting_spot', 'workbench'], skill: 'crafting', work: 560, ing: [{ item: 'wood', n: 28 }], out: 'bow', n: 1 },
    club: { name: 'Кийок', bench: ['crafting_spot', 'workbench'], skill: 'crafting', work: 260, ing: [{ item: 'wood', n: 12 }], out: 'club', n: 1 },
    spear: { name: 'Спис', bench: ['crafting_spot', 'workbench'], skill: 'crafting', work: 340, ing: [{ item: 'wood', n: 14 }, { item: 'stone_chunk', n: 1 }], out: 'spear', n: 1 },
    stone_knife: { name: 'Кам\'яний ніж', bench: ['crafting_spot', 'workbench'], skill: 'crafting', work: 220, ing: [{ item: 'stone_chunk', n: 2 }, { item: 'wood', n: 3 }], out: 'stone_knife', n: 1 },
    knife: { name: 'Ніж', bench: ['workbench'], skill: 'crafting', work: 420, ing: [{ item: 'steel', n: 12 }], out: 'knife', n: 1 },
    herbal: { name: 'Трав\'яні ліки', bench: ['workbench'], skill: 'crafting', work: 280, ing: [{ item: 'healroot', n: 2 }], out: 'herbal', n: 1, research: 'medicine' },
    stone_block: { name: 'Кам\'яні блоки', bench: ['stonecutter'], skill: 'crafting', work: 260, ing: [{ item: 'stone_chunk', n: 1 }], out: 'stone_block', n: 2 },
    cloth: { name: 'Тканина з бавовни', bench: ['tailor_bench'], skill: 'crafting', work: 220, ing: [{ item: 'cotton', n: 4 }], out: 'cloth', n: 4 },
    parka: { name: 'Парка', bench: ['tailor_bench'], skill: 'crafting', work: 900, ing: [{ item: 'cloth', n: 35 }], out: 'parka', n: 1 },
    tribal_wear: { name: 'Племінний одяг', bench: ['tailor_bench'], skill: 'crafting', work: 450, ing: [{ item: 'leather', n: 8 }], out: 'tribal_wear', n: 1 },
    components: { name: 'Компоненти', bench: ['machining'], skill: 'crafting', work: 900, ing: [{ item: 'steel', n: 18 }], out: 'components', n: 1 },
    medicine: { name: 'Ліки', bench: ['machining'], skill: 'crafting', work: 600, ing: [{ item: 'herbal', n: 2 }, { item: 'components', n: 1 }], out: 'medicine', n: 1, research: 'medicine' },
    revolver: { name: 'Револьвер', bench: ['machining'], skill: 'crafting', work: 1100, ing: [{ item: 'steel', n: 40 }, { item: 'components', n: 1 }], out: 'revolver', n: 1, research: 'gunsmithing' },
    rifle: { name: 'Автоматична гвинтівка', bench: ['machining'], skill: 'crafting', work: 1700, ing: [{ item: 'steel', n: 60 }, { item: 'components', n: 3 }], out: 'rifle', n: 1, research: 'rifles' },
    flak_vest: { name: 'Бронежилет', bench: ['machining'], skill: 'crafting', work: 1300, ing: [{ item: 'steel', n: 30 }, { item: 'cloth', n: 15 }, { item: 'components', n: 1 }], out: 'flak_vest', n: 1, research: 'armor' }
  };

  // ---- Дослідження ----
  D.research = {
    stonecutting: { name: 'Різьблення по каменю', cost: 250, req: [], desc: 'Каменерізний стіл, кам\'яні стіни й підлога.' },
    textiles: { name: 'Текстиль', cost: 220, req: [], desc: 'Швацький стіл, бавовна, парки.' },
    agriculture: { name: 'Розвинене землеробство', cost: 260, req: [], desc: 'Кукурудза.' },
    metalwork: { name: 'Металообробка', cost: 380, req: [], desc: 'Сталеві стіни, двері й підлога.' },
    medicine: { name: 'Медицина', cost: 330, req: [], desc: 'Цілющий корінь, трав\'яні ліки, лікарняне ліжко, ліки.' },
    recreation: { name: 'Дозвілля', cost: 250, req: [], desc: 'Шаховий стіл.' },
    electricity: { name: 'Електрика', cost: 520, req: ['metalwork'], desc: 'Дроти, генератор, акумулятор, лампи, обігрівач, охолоджувач.' },
    solar: { name: 'Сонячна енергія', cost: 720, req: ['electricity'], desc: 'Сонячні панелі.' },
    tv: { name: 'Телебачення', cost: 450, req: ['electricity', 'recreation'], desc: 'Телевізор.' },
    machining: { name: 'Механічна обробка', cost: 820, req: ['electricity'], desc: 'Механічний верстат, компоненти.' },
    gunsmithing: { name: 'Зброярство', cost: 650, req: ['machining'], desc: 'Револьвер.' },
    rifles: { name: 'Автоматична зброя', cost: 1000, req: ['gunsmithing'], desc: 'Автоматична гвинтівка.' },
    armor: { name: 'Бронежилети', cost: 750, req: ['machining', 'textiles'], desc: 'Бронежилет.' },
    turrets: { name: 'Автотурелі', cost: 950, req: ['machining'], desc: 'Автоматичні турелі.' },
    starflight: { name: 'Міжзоряний політ', cost: 3600, req: ['solar', 'rifles', 'machining'], desc: 'Двигун корабля — шлях додому.' }
  };

  // ---- Біоми ----
  D.biomes = {
    temperate: {
      name: 'Помірний ліс', desc: 'Лісисті пагорби, річки та родючі землі.',
      temp: 13, swing: 15, daily: 5, trees: ['tree_oak', 'tree_birch', 'tree_pine'], treeDens: 0.30,
      ground: { soil: ['#4f7a3a', '#5b8742', '#46703a'], rich: ['#3e5f2e', '#456a32'], gravel: ['#7d7a70', '#8a867a'], sand: ['#c9b87e', '#d3c28a'], rock: ['#6e6e6e'], snow: ['#e8eef2'] },
      animals: [['deer', 7], ['rabbit', 6], ['boar', 4], ['wolf', 0]], bushes: 0.012, fert: 0.55, rainy: 0.35
    },
    arid: {
      name: 'Посушливий степ', desc: 'Спека, пісок і рідкісні оази.',
      temp: 27, swing: 7, daily: 10, trees: ['tree_palm', 'tree_birch'], treeDens: 0.045,
      ground: { soil: ['#a69552', '#9c8b4a', '#b0a05c'], rich: ['#7d8a3a', '#6e7c34'], gravel: ['#9a8a70', '#a89878'], sand: ['#d8c27a', '#e0cc88'], rock: ['#8a7a60'], snow: ['#e8eef2'] },
      animals: [['rabbit', 8], ['deer', 3], ['boar', 3]], bushes: 0.004, fert: 0.2, rainy: 0.05
    },
    tundra: {
      name: 'Бореальна тундра', desc: 'Холодні рівнини під снігом, довга зима.',
      temp: -4, swing: 16, daily: 4, trees: ['tree_pine', 'tree_pine', 'tree_birch'], treeDens: 0.12,
      ground: { soil: ['#6f7f62', '#76866a'], rich: ['#586a4a', '#5f7050'], gravel: ['#8a8a88', '#94948f'], sand: ['#bdb59a', '#c6bea4'], rock: ['#6a6e72'], snow: ['#e6edf2', '#dde6ee', '#eef3f6'] },
      animals: [['deer', 5], ['rabbit', 6], ['wolf', 4], ['boar', 2]], bushes: 0.004, fert: 0.25, rainy: 0.3, snowy: true
    },
    tropical: {
      name: 'Тропічні джунглі', desc: 'Волога спека, густа рослинність.',
      temp: 25, swing: 4, daily: 5, trees: ['tree_palm', 'tree_oak', 'tree_palm'], treeDens: 0.42,
      ground: { soil: ['#3f7a38', '#47853e'], rich: ['#2f5f2a', '#356a2f'], gravel: ['#7a7a68', '#868672'], sand: ['#d2c284', '#dccd92'], rock: ['#6a6a66'], snow: ['#e8eef2'] },
      animals: [['deer', 5], ['rabbit', 4], ['boar', 6], ['wolf', 1]], bushes: 0.02, fert: 0.75, rainy: 0.55
    }
  };
  D.stoneNames = { temperate: 'граніт', arid: 'пісковик', tundra: 'сланець', tropical: 'базальт' };

  // ---- Складності й оповідачі ----
  D.difficulties = [
    { id: 'peaceful', name: 'Мирна', desc: 'Жодних рейдів. Лише виживання й будівництво.', threat: 0, grace: 999, mood: 1.15, harm: 0.6 },
    { id: 'easy', name: 'Легка', desc: 'Рідкісні нечисленні рейди. Колоністи витривалі.', threat: 0.5, grace: 10, mood: 1.05, harm: 0.8 },
    { id: 'normal', name: 'Звичайна', desc: 'Збалансований досвід.', threat: 1.0, grace: 6, mood: 1.0, harm: 1.0 },
    { id: 'hard', name: 'Складна', desc: 'Ранні й великі рейди.', threat: 1.6, grace: 4, mood: 0.95, harm: 1.2 },
    { id: 'extreme', name: 'Екстремальна', desc: 'Жодної пощади. Хто не встиг — той загинув.', threat: 2.3, grace: 3, mood: 0.9, harm: 1.4 }
  ];
  D.storytellers = [
    { id: 'orest', name: 'Орест Залізний Ритм', title: 'Старий капітан', quote: '«Кожна буря має кінець. Але кожен спокій — лише передишка».', desc: 'Класичні хвилі: загрози наростають, потім дають перепочинок. Розмірений, передбачуваний ритм.', rate: 1.0, raid: 1.0, tags: ['Хвилі загроз', 'Збалансований'] },
    { id: 'lilea', name: 'Лілея Тихі Ріки', title: 'Мудра травниця', quote: '«Дай землі час — і вона віддячить. Не кожен гість приходить зі зброєю».', desc: 'Довгі спокійні періоди та рідкісні, але вагомі події. Для тих, хто любить будувати й розвиватися.', rate: 0.65, raid: 0.9, tags: ['Спокійний темп', 'Рідкісні рейди'] },
    { id: 'vykhor', name: 'Вихор Безумний Мандрівник', title: 'Хаос у масці', quote: '«Порядок — це просто хаос, який ще не встиг повеселитися!»', desc: 'Повний хаос: події можуть статися будь-коли й будь-в якій комбінації. Ризиковано й непередбачувано.', rate: 1.3, raid: 1.1, tags: ['Хаос', 'Непередбачуваний'] }
  ];

  // ---- Сценарії ----
  D.scenarios = [
    {
      id: 'crash', name: 'Остання шлюпка', desc: 'Три вцілілі з «Зорі-7» вирвались на шлюпці й упали на чужу планету. Є ліки й трохи запчастин, але ні грама зброї — доведеться вигадувати оборону.',
      count: 3, research: [], items: { steel: 180, wood: 200, silver: 500, components: 8, meal_simple: 24, herbal: 8, medicine: 4, cloth: 50 },
      pet: 'dog', win: true, points: 14
    },
    {
      id: 'tribe', name: 'Діти Попелу', desc: 'Плем\'я, що пережило спалення рідного лісу. П\'ятеро мисливців із двома луками, списами й вірою в вогонь. Жодної електроніки — тільки дерево, шкіри й кмітливість.',
      count: 5, research: [], items: { wood: 260, steel: 30, silver: 80, meal_simple: 14, herbal: 8, cloth: 30, tribal_wear: 3, bow: 2, spear: 2 },
      pet: 'dog', tribal: true, win: true, points: 10
    },
    {
      id: 'rich', name: 'Картографи Півночі', desc: 'Двоє картографів із дорогим обладнанням: скеля навколо стоянки «прозора» — жили руди в радіусі 16 клітинок видно одразу. Але вдвох важко тримати оборону.',
      count: 2, research: ['metalwork'], items: { steel: 220, wood: 180, silver: 1100, components: 10, gold: 15, meal_fine: 8, medicine: 4, cloth: 60, parka: 2 },
      pet: 'cat', win: true, points: 20, reveal: 16
    },
    {
      id: 'naked', name: 'Самотній вогонь', desc: 'Один колоніст, що вижив сам. У кишенях лише трохи їжі, поліно й вірний пес. Усе — з нуля.',
      count: 1, research: [], items: { meal_simple: 4, wood: 40, cloth: 10, herbal: 2 }, pet: 'dog', win: true, points: 14
    }
  ];

  // ---- Світові налаштування за замовчуванням ----
  D.worldSizes = [{ id: 'small', name: 'Мала (70×70)', n: 70 }, { id: 'medium', name: 'Середня (100×100)', n: 100 }, { id: 'large', name: 'Велика (140×140)', n: 140 }];

  // ---- Зовнішність ----
  D.skinTones = ['#f3d2b3', '#e3b98f', '#c99467', '#a56f45', '#7b4c2c', '#523220'];
  D.hairColors = ['#1a1410', '#3a2515', '#6a4220', '#a06a30', '#d6a850', '#c9c9c9', '#8a2f1f', '#2a3a5a'];
  D.hairStyles = [{ id: 0, name: 'Лисий' }, { id: 1, name: 'Короткий' }, { id: 2, name: 'Довге' }, { id: 3, name: 'Іроке' }, { id: 4, name: 'Хвостик' }, { id: 5, name: 'Пучок' }];
  D.clothColors = ['#4a6a8a', '#8a4a3a', '#5a7a4a', '#8a7a3a', '#6a4a7a', '#3a7a7a', '#7a7a7a', '#a05a2a', '#2a2a3a', '#a8a090'];
  D.bodyTypes = [{ id: 'thin', name: 'Худорлявий', w: 0.82 }, { id: 'normal', name: 'Звичайний', w: 1 }, { id: 'broad', name: 'Кремезний', w: 1.18 }];

  // Допоміжне
  D.hour = tick => Math.floor((tick % D.DAY) / D.HOUR);
  D.dayNum = tick => Math.floor(tick / D.DAY);
  D.relDay = tick => D.dayNum(tick) - (RW.G && RW.G.startDay || 0);
  D.seasonOf = tick => Math.floor((D.dayNum(tick) % D.YEAR_DAYS) / D.SEASON_DAYS);
  D.nutrOf = it => (D.items[it] && D.items[it].nutr) || 0;
  D.isBuildable = (key) => D.bld[key] && D.bld[key].cat !== 'hidden';
})();
