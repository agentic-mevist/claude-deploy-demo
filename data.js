// Categories shown as leaderboard tabs and training disciplines.
const CATEGORIES = [
  { id: 'overall', label: 'Overall',  unit: 'pts'    },
  { id: 'legs',    label: 'Legs',     unit: 'kg'     },
  { id: 'push',    label: 'Push',     unit: 'kg'     },
  { id: 'pull',    label: 'Pull',     unit: 'kg'     },
  { id: 'cardio',  label: 'Cardio',   unit: 'min'    },
  { id: 'classes', label: 'Classes',  unit: 'min'    },
];

const CATEGORY_BLURB = {
  legs:    'Squat, leg press, RDLs, split squats.',
  push:    'Bench, overhead press, dips, push-ups.',
  pull:    'Deadlift, rows, pull-ups, pulldowns.',
  cardio:  'Treadmill, spin, rower, stairs.',
  classes: 'HIIT, yin yoga, mobility, breathwork.',
};

const EXERCISES = {
  legs: [
    { id: 'squat',  name: 'Barbell Squat',        type: 'strength'   },
    { id: 'press',  name: 'Leg Press',            type: 'strength'   },
    { id: 'rdl',    name: 'Romanian Deadlift',    type: 'strength'   },
    { id: 'curl',   name: 'Leg Curl',             type: 'strength'   },
    { id: 'split',  name: 'Bulgarian Split Squat',type: 'strength'   },
  ],
  push: [
    { id: 'bench',  name: 'Bench Press',          type: 'strength'   },
    { id: 'ohp',    name: 'Overhead Press',       type: 'strength'   },
    { id: 'incdb',  name: 'Incline DB Press',     type: 'strength'   },
    { id: 'dip',    name: 'Dips',                 type: 'bodyweight' },
    { id: 'pushup', name: 'Push-ups',             type: 'bodyweight' },
  ],
  pull: [
    { id: 'dead',   name: 'Deadlift',             type: 'strength'   },
    { id: 'pull',   name: 'Pull-ups',             type: 'bodyweight' },
    { id: 'brow',   name: 'Barbell Row',          type: 'strength'   },
    { id: 'lat',    name: 'Lat Pulldown',         type: 'strength'   },
    { id: 'cable',  name: 'Cable Row',            type: 'strength'   },
  ],
  cardio: [
    { id: 'tread',  name: 'Treadmill',            type: 'duration', mult: 6 },
    { id: 'bike',   name: 'Spin Bike',            type: 'duration', mult: 5 },
    { id: 'row',    name: 'Rower',                type: 'duration', mult: 7 },
    { id: 'stair',  name: 'StairMaster',          type: 'duration', mult: 8 },
  ],
  classes: [
    { id: 'hiit',   name: 'HIIT',                 type: 'duration', mult: 9 },
    { id: 'yin',    name: 'Yin Yoga',             type: 'duration', mult: 4 },
    { id: 'mob',    name: 'Mobility',             type: 'duration', mult: 4 },
    { id: 'breath', name: 'Breathwork',           type: 'duration', mult: 3 },
  ],
};

const SEED_USERS = [
  { id: 'u1',  name: 'Kai Anderson',    initials: 'KA' },
  { id: 'u2',  name: 'Luna Sjoberg',    initials: 'LS' },
  { id: 'u3',  name: 'Indra Wijaya',    initials: 'IW' },
  { id: 'u4',  name: 'Marco Bianchi',   initials: 'MB' },
  { id: 'u5',  name: 'Yulia Petrova',   initials: 'YP' },
  { id: 'u6',  name: 'Hendrik de Vos',  initials: 'HV' },
  { id: 'u7',  name: 'Asha Mehta',      initials: 'AM' },
  { id: 'u8',  name: 'Diego Ramirez',   initials: 'DR' },
  { id: 'u9',  name: 'Wayan Putra',     initials: 'WP' },
  { id: 'u10', name: 'Sophia Lee',      initials: 'SL' },
  { id: 'u11', name: 'Ravi Krishnan',   initials: 'RK' },
  { id: 'u12', name: 'Sergei Volkov',   initials: 'SV' },
  { id: 'u13', name: 'Eliza Hart',      initials: 'EH' },
  { id: 'u14', name: 'Bagus Suparman',  initials: 'BS' },
  { id: 'u15', name: 'Tati Saraswati',  initials: 'TS' },
  { id: 'u16', name: 'Noa Friedman',    initials: 'NF' },
  { id: 'u17', name: 'Made Sukma',      initials: 'MS' },
  { id: 'u18', name: 'Klara Lindqvist', initials: 'KL' },
];

// Mulberry32 PRNG so seeded scores are stable across reloads.
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function seedScores() {
  const rand = mulberry32(20260525);
  const out = {};
  SEED_USERS.forEach((u) => {
    out[u.id] = {
      legs:    Math.round(2000 + rand() * 22000),
      push:    Math.round(1500 + rand() * 17000),
      pull:    Math.round(1800 + rand() * 19000),
      cardio:  Math.round(40   + rand() * 380),
      classes: Math.round(20   + rand() * 260),
    };
  });
  return out;
}
