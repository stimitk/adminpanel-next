// Development-only sample data, generated from a fixed seed so every reload
// shows the same records. Large enough to exercise search, pagination,
// analytics and leaderboards: ~40 teachers (some sharing a name), ~90 question
// sets in named banks, ~2,500 questions, 14 championships and ~1,500 attempts.
import type { Row } from "./types";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Random = ReturnType<typeof rng>;
export const seeded = rng;
const int = (r: Random, min: number, max: number) => min + Math.floor(r() * (max - min + 1));
const pick = <T,>(r: Random, list: readonly T[]) => list[Math.floor(r() * list.length)];
export function shuffle<T>(r: Random, list: readonly T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const DAY = 86_400_000;
export const isoDay = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

type Generated = { text: string; options: string[]; answer: number };

// Builds four options with the answer at a random position.
function choice(r: Random, text: string, answer: string, wrong: string[]): Generated {
  const distractors = shuffle(r, [...new Set(wrong.filter((w) => w !== answer))]).slice(0, 3);
  const options = shuffle(r, [answer, ...distractors]);
  return { text, options, answer: options.indexOf(answer) + 1 };
}
function numeric(r: Random, text: string, answer: number, spread = 10): Generated {
  const wrong = new Set<string>();
  while (wrong.size < 3) {
    const delta = int(r, 1, spread) * (r() < 0.5 ? -1 : 1);
    if (answer + delta !== answer) wrong.add(String(answer + delta));
  }
  return choice(r, text, String(answer), [...wrong]);
}

const capitals: [string, string][] = [
  ["France", "Paris"], ["Japan", "Tokyo"], ["Australia", "Canberra"], ["Canada", "Ottawa"],
  ["Brazil", "Brasília"], ["Egypt", "Cairo"], ["Kenya", "Nairobi"], ["Germany", "Berlin"],
  ["Italy", "Rome"], ["Spain", "Madrid"], ["Russia", "Moscow"], ["China", "Beijing"],
  ["India", "New Delhi"], ["Nepal", "Kathmandu"], ["Sri Lanka", "Sri Jayawardenepura Kotte"],
  ["Argentina", "Buenos Aires"], ["Mexico", "Mexico City"], ["Turkey", "Ankara"],
  ["South Africa", "Pretoria"], ["Nigeria", "Abuja"], ["Thailand", "Bangkok"],
  ["Vietnam", "Hanoi"], ["Indonesia", "Jakarta"], ["Norway", "Oslo"], ["Sweden", "Stockholm"],
  ["Finland", "Helsinki"], ["Portugal", "Lisbon"], ["Greece", "Athens"], ["Peru", "Lima"],
  ["Chile", "Santiago"], ["New Zealand", "Wellington"], ["Pakistan", "Islamabad"],
  ["Bangladesh", "Dhaka"], ["Switzerland", "Bern"], ["Austria", "Vienna"], ["Poland", "Warsaw"],
];
const states: [string, string][] = [
  ["Maharashtra", "Mumbai"], ["Karnataka", "Bengaluru"], ["Tamil Nadu", "Chennai"],
  ["Kerala", "Thiruvananthapuram"], ["Gujarat", "Gandhinagar"], ["Rajasthan", "Jaipur"],
  ["West Bengal", "Kolkata"], ["Punjab", "Chandigarh"], ["Bihar", "Patna"],
  ["Odisha", "Bhubaneswar"], ["Assam", "Dispur"], ["Telangana", "Hyderabad"],
  ["Madhya Pradesh", "Bhopal"], ["Uttar Pradesh", "Lucknow"], ["Goa", "Panaji"],
];
const elements: [string, string, number][] = [
  ["Hydrogen", "H", 1], ["Helium", "He", 2], ["Lithium", "Li", 3], ["Carbon", "C", 6],
  ["Nitrogen", "N", 7], ["Oxygen", "O", 8], ["Fluorine", "F", 9], ["Neon", "Ne", 10],
  ["Sodium", "Na", 11], ["Magnesium", "Mg", 12], ["Aluminium", "Al", 13], ["Silicon", "Si", 14],
  ["Phosphorus", "P", 15], ["Sulfur", "S", 16], ["Chlorine", "Cl", 17], ["Argon", "Ar", 18],
  ["Potassium", "K", 19], ["Calcium", "Ca", 20], ["Iron", "Fe", 26], ["Copper", "Cu", 29],
  ["Zinc", "Zn", 30], ["Silver", "Ag", 47], ["Tin", "Sn", 50], ["Gold", "Au", 79],
  ["Mercury", "Hg", 80], ["Lead", "Pb", 82],
];
const units: [string, string][] = [
  ["force", "newton"], ["energy", "joule"], ["power", "watt"], ["pressure", "pascal"],
  ["electric current", "ampere"], ["electric charge", "coulomb"], ["voltage", "volt"],
  ["resistance", "ohm"], ["frequency", "hertz"], ["temperature", "kelvin"], ["mass", "kilogram"],
  ["luminous intensity", "candela"], ["magnetic flux", "weber"], ["capacitance", "farad"],
];
const events: [string, number][] = [
  ["India gained independence", 1947], ["The Constitution of India came into effect", 1950],
  ["World War I began", 1914], ["World War II ended", 1945], ["The Berlin Wall fell", 1989],
  ["The first Moon landing took place", 1969], ["The French Revolution began", 1789],
  ["The Battle of Plassey was fought", 1757], ["The Revolt of 1857 began", 1857],
  ["The Dandi March took place", 1930], ["The United Nations was founded", 1945],
  ["The Quit India Movement was launched", 1942], ["The Jallianwala Bagh massacre occurred", 1919],
  ["The American Declaration of Independence was signed", 1776], ["Chandrayaan-3 landed on the Moon", 2023],
];
const csFacts: [string, string, string[]][] = [
  ["Which data structure follows Last-In-First-Out (LIFO)?", "Stack", ["Queue", "Tree", "Graph", "Heap"]],
  ["Which data structure follows First-In-First-Out (FIFO)?", "Queue", ["Stack", "Tree", "Set", "Heap"]],
  ["What does CPU stand for?", "Central Processing Unit", ["Central Program Utility", "Computer Personal Unit", "Core Processing Utility"]],
  ["Which protocol is used to load web pages securely?", "HTTPS", ["FTP", "SMTP", "Telnet", "SNMP"]],
  ["Which of these is not a programming language?", "HTML", ["Python", "Java", "C++", "Rust"]],
  ["What is the time complexity of binary search?", "O(log n)", ["O(n)", "O(n²)", "O(1)", "O(n log n)"]],
  ["Which device forwards packets between networks?", "Router", ["Hub", "Repeater", "Modem", "Switch"]],
  ["How many bits are in one byte?", "8", ["4", "16", "10", "2"]],
  ["Which sorting algorithm repeatedly swaps adjacent elements?", "Bubble sort", ["Merge sort", "Quick sort", "Heap sort"]],
  ["What does RAM stand for?", "Random Access Memory", ["Read Access Memory", "Rapid Action Memory", "Run All Memory"]],
];

const generators: Record<string, (r: Random) => Generated> = {
  Mathematics: (r) => {
    const kind = int(r, 0, 4);
    const a = int(r, 6, 49), b = int(r, 3, 19);
    if (kind === 0) return numeric(r, `What is ${a} × ${b}?`, a * b, 12);
    if (kind === 1) return numeric(r, `What is ${a * 7} + ${b * 13}?`, a * 7 + b * 13, 15);
    if (kind === 2) return numeric(r, `What is ${b * 5}% of ${a * 20}?`, (b * 5 * a * 20) / 100, 20);
    if (kind === 3) return numeric(r, `What is the square of ${a}?`, a * a, 30);
    return numeric(r, `Solve for x: ${b}x + ${a} = ${b * a + a}`, a, 6);
  },
  Physics: (r) => {
    if (r() < 0.45) {
      const [quantity, unit] = pick(r, units);
      return choice(r, `What is the SI unit of ${quantity}?`, unit, units.map((u) => u[1]));
    }
    const t = int(r, 2, 6), v = int(r, 30, 90);
    if (r() < 0.5) return numeric(r, `A car travels ${v * t} km in ${t} hours. What is its average speed in km/h?`, v, 15);
    const m = int(r, 2, 20), acc = int(r, 2, 9);
    return numeric(r, `What force (in N) accelerates a ${m} kg mass at ${acc} m/s²?`, m * acc, 12);
  },
  Chemistry: (r) => {
    const [name, symbol, z] = pick(r, elements);
    const kind = int(r, 0, 2);
    if (kind === 0) return choice(r, `What is the chemical symbol of ${name}?`, symbol, elements.map((e) => e[1]));
    if (kind === 1) return choice(r, `Which element has the symbol ${symbol}?`, name, elements.map((e) => e[0]));
    return numeric(r, `What is the atomic number of ${name}?`, z, 5);
  },
  Geography: (r) => {
    if (r() < 0.3) {
      const [state, capital] = pick(r, states);
      return choice(r, `What is the capital of ${state}?`, capital, states.map((s) => s[1]));
    }
    const [country, capital] = pick(r, capitals);
    return r() < 0.6
      ? choice(r, `What is the capital of ${country}?`, capital, capitals.map((c) => c[1]))
      : choice(r, `${capital} is the capital of which country?`, country, capitals.map((c) => c[0]));
  },
  History: (r) => {
    const [event, year] = pick(r, events);
    return numeric(r, `In which year: ${event}?`, year, 12);
  },
  "Computer Science": (r) => {
    if (r() < 0.5) {
      const n = int(r, 5, 63);
      const answer = n.toString(2);
      return choice(r, `What is ${n} written in binary?`, answer, [
        (n + 1).toString(2), (n - 1).toString(2), (n ^ 2).toString(2), (n + 4).toString(2),
      ]);
    }
    const [text, answer, wrong] = pick(r, csFacts);
    return choice(r, text, answer, wrong);
  },
};

const subjects = [
  { subject: "Physics", category: 1, sets: ["Motion & Forces", "Light & Optics", "Electricity Basics", "Work & Energy", "Units & Measurement"] },
  { subject: "Chemistry", category: 1, sets: ["Periodic Table", "Elements & Symbols", "Atomic Structure", "Chemical Basics"] },
  { subject: "Mathematics", category: 3, sets: ["Multiplication Drill", "Percentages", "Linear Equations", "Squares", "Mental Maths"] },
  { subject: "Geography", category: 2, sets: ["World Capitals", "Indian States", "Countries & Capitals", "Map Skills"] },
  { subject: "History", category: 5, sets: ["Modern India", "World Wars", "Freedom Struggle", "Key Dates"] },
  { subject: "Computer Science", category: 4, sets: ["Programming Basics", "Data Structures", "Number Systems", "Networks"] },
];
const levels = ["Class 8", "Class 9", "Class 10", "Class 11", "Class 12", "Foundation", "Advanced"];

export const demoCategories: Row[] = [
  { category_id: 1, category_name: "Science & Technology", status: 1 },
  { category_id: 2, category_name: "General Knowledge", status: 1 },
  { category_id: 3, category_name: "Mathematics", status: 1 },
  { category_id: 4, category_name: "Computer Science", status: 1 },
  { category_id: 5, category_name: "History & Civics", status: 1 },
];

// Repeated names are deliberate: teacher IDs tell them apart.
const teacherNames = [
  "Priya Sharma", "Rahul Verma", "Anjali Singh", "Priya Sharma", "Vikram Iyer", "Neha Gupta",
  "Arjun Mehta", "Priya Sharma", "Sneha Reddy", "Rahul Verma", "Karan Malhotra", "Divya Nair",
  "Rohan Das", "Anjali Singh", "Meera Pillai", "Amit Patel", "Kavya Joshi", "Suresh Kumar",
  "Pooja Bansal", "Sanjay Rao", "Nisha Kapoor", "Aditya Kulkarni", "Ritu Chawla", "Manish Tiwari",
  "Lakshmi Menon", "Farhan Ali", "Shreya Ghosh", "Deepak Yadav", "Isha Agarwal", "Gaurav Saxena",
  "Amit Patel", "Tanvi Desai", "Harish Bhat", "Swati Mishra", "Nikhil Jain", "Rekha Iyer",
];
const institutes = ["Demo Institute", "Delhi Public College", "St. Xavier's Institute", "National Institute of Science", "Pune Technical University", "Bangalore Academy"];
const departments = ["Computer Science", "Physics", "Mathematics", "Chemistry", "Humanities", "General Studies"];
const firstNames = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Ananya", "Diya", "Saanvi", "Aadhya", "Kiara", "Myra", "Anika", "Navya", "Pari", "Riya", "Kabir", "Dev", "Rudra", "Advik", "Zara", "Meher", "Tara", "Nikhil", "Om", "Laksh", "Siya", "Ira", "Yash", "Aryan", "Neel", "Jiya", "Avni", "Tanish", "Veer", "Mira"];
const lastNames = ["Sharma", "Verma", "Singh", "Iyer", "Gupta", "Mehta", "Reddy", "Malhotra", "Nair", "Das", "Pillai", "Patel", "Joshi", "Kumar", "Bansal", "Rao", "Kapoor", "Kulkarni", "Chawla", "Menon", "Ali", "Ghosh", "Yadav", "Agarwal", "Saxena", "Desai", "Bhat", "Mishra", "Jain", "Khan"];

const championshipNames: [string, string][] = [
  ["National Science Olympiad 2026", "Physics"], ["Math Mania Weekly", "Mathematics"],
  ["Capital Quest", "Geography"], ["Chemistry Champions League", "Chemistry"],
  ["Physics Power Hour", "Physics"], ["Code Sprint Challenge", "Computer Science"],
  ["History Hunters", "History"], ["Young Mathematicians Cup", "Mathematics"],
  ["Elements Face-off", "Chemistry"], ["Geo Genius Trophy", "Geography"],
  ["Freedom Struggle Quiz", "History"], ["Binary Brains Bowl", "Computer Science"],
];

export function generateDemoData(base: {
  labels: Row[];
  questions: Row[];
  championships: Row[];
  teacher: Row;
}) {
  const r = rng(20261101);
  const teachers: Row[] = [
    base.teacher,
    ...teacherNames.map((name, i) => {
      const institute = institutes[(i * 5 + 1) % institutes.length];
      return {
        teacher_id: 101 + i,
        teacher_name: name,
        username: `${name.toLowerCase().replace(/\s+/g, ".")}${i + 1}`,
        email: `${name.toLowerCase().replace(/\s+/g, ".")}.${101 + i}@example.edu`,
        institute,
        department: departments[(i * 3) % departments.length],
        status: i % 13 === 5 ? 0 : i % 17 === 9 ? 2 : 1,
      };
    }),
  ];
  const active = teachers.filter((t) => Number(t.status) === 1 && t.teacher_id !== base.teacher.teacher_id);

  // Existing fixtures belong to the demo teacher's starter bank.
  const labels: Row[] = base.labels.map((l) => ({
    ...l,
    teacher_id: base.teacher.teacher_id,
    teacher_name: base.teacher.teacher_name,
    bank_name: "Starter Bank — Demo",
    subject: l.label_id === 1 ? "Physics" : "Geography",
  }));
  const questions: Row[] = [...base.questions];
  let labelId = labels.length;
  let questionId = questions.length;
  for (const teacher of active) {
    const owned = shuffle(r, subjects).slice(0, int(r, 1, 2));
    for (const { subject, sets } of owned) {
      const bank = `${subject} — ${pick(r, levels)}`;
      for (const setName of shuffle(r, sets).slice(0, int(r, 1, 3))) {
        labelId += 1;
        const label: Row = {
          label_id: labelId,
          label_name: r() < 0.2 ? `${setName} (Set ${pick(r, ["A", "B", "C"])})` : setName,
          status: r() < 0.94 ? 1 : 0,
          teacher_id: teacher.teacher_id,
          teacher_name: teacher.teacher_name,
          bank_name: bank,
          subject,
        };
        labels.push(label);
        const seen = new Set<string>();
        const count = int(r, 14, 42);
        for (let tries = 0; seen.size < count && tries < count * 4; tries++) {
          const q = generators[subject](r);
          if (seen.has(q.text)) continue;
          seen.add(q.text);
          questionId += 1;
          questions.push({
            question_id: questionId,
            label_id: labelId,
            label_name: label.label_name,
            question_text: q.text,
            option1_text: q.options[0],
            option2_text: q.options[1],
            option3_text: q.options[2],
            option4_text: q.options[3],
            correct_answer: String(q.answer),
            expected_time_sec: pick(r, [15, 20, 25, 30]),
            total_coins: pick(r, [5, 10, 10, 15, 20]),
            include_in_live: r() > 0.06,
            is_blocked: r() < 0.012,
          });
        }
      }
    }
  }

  const championships: Row[] = base.championships.map((c) => ({ ...c }));
  championshipNames.forEach(([name, subject], i) => {
    const sets = shuffle(r, labels.filter((l) => l.subject === subject && Number(l.status) === 1)).slice(0, int(r, 1, 3));
    const owner = sets[0];
    const category = subjects.find((s) => s.subject === subject)!.category;
    // Spread across finished, running and upcoming windows.
    const start = i < 5 ? -int(r, 70, 140) : i < 10 ? -int(r, 10, 40) : int(r, 3, 15);
    const end = i < 5 ? start + int(r, 20, 45) : start + int(r, 45, 80);
    const questionsPerGame = pick(r, [10, 10, 15, 20]);
    championships.push({
      champ_id: championships.length + 1,
      champ_name: name,
      category_id: category,
      category_name: demoCategories.find((c) => c.category_id === category)?.category_name,
      teacher_id: owner?.teacher_id,
      teacher_name: owner?.teacher_name,
      start_date: isoDay(start),
      end_date: isoDay(end),
      start_time: "09:00:00",
      end_time: "21:00:00",
      status: i === 7 ? 0 : 1,
      is_blocked: i === 8,
      total_participants: 0,
      modes: [
        {
          mode_id: championships.length + 1,
          mode_name: pick(r, ["Classic", "Speed Round", "Marathon", "Quick Challenge"]),
          description: `${subject} questions drawn from the linked sets.`,
          no_of_question: questionsPerGame,
          time_minutes: `00:${String(Math.ceil((questionsPerGame * 30) / 60)).padStart(2, "0")}:00`,
        },
      ],
      label_ids: sets.map((s) => s.label_id),
    });
  });

  const users = Array.from({ length: 520 }, (_, i) => {
    const name = `${firstNames[i % firstNames.length]} ${lastNames[(i * 7 + Math.floor(i / firstNames.length)) % lastNames.length]}`;
    return {
      user_id: 10001 + i,
      user_name: name,
      user_email: `${name.toLowerCase().replace(/\s+/g, ".")}${i + 1}@mail.example`,
      skill: 0.35 + r() * 0.6,
    };
  });

  const attempts: Row[] = [];
  for (const c of championships) {
    const startOffset = (Date.parse(String(c.start_date)) - Date.now()) / DAY;
    if (startOffset > 0 || !(c.label_ids as unknown[])?.length) continue;
    const endTime = Math.min(Date.parse(`${c.end_date}T21:00:00`), Date.now() - 3_600_000);
    const startTime = Date.parse(`${c.start_date}T09:00:00`);
    const perGame = Number((c.modes as Row[])[0]?.no_of_question) || 10;
    const players = shuffle(r, users).slice(0, c.champ_id === 1 ? 24 : int(r, 70, 230));
    for (const user of players) {
      const labelChoice = pick(r, c.label_ids as number[]);
      const completed = r() < 0.86;
      const attempted = completed ? perGame : int(r, 2, perGame - 1);
      let correct = 0;
      for (let q = 0; q < attempted; q++) if (r() < user.skill) correct += 1;
      const day = new Date(startTime + r() * Math.max(DAY, endTime - startTime));
      day.setHours(int(r, 8, 21), int(r, 0, 59), int(r, 0, 59), 0);
      attempts.push({
        attempt_id: `${c.champ_id}-${user.user_id}`,
        champ_id: c.champ_id,
        label_id: labelChoice,
        user_id: user.user_id,
        user_name: user.user_name,
        user_email: user.user_email,
        total_questions: perGame,
        attempted,
        correct,
        incorrect: attempted - correct,
        marks: correct * 10,
        total_marks: perGame * 10,
        time_taken_sec: Math.round(attempted * (9 + r() * 22)),
        completed_at: day.toISOString(),
        completed,
      });
    }
    c.total_participants = players.length;
  }
  return { teachers, labels, questions, championships, attempts };
}
