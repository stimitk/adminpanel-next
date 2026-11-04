import type { Row, Session } from "./types";
import { demoCredentials } from "./demo-config";
import { isBlocked, isIncludedInLive, isLiveEligible } from "./questions";
import { codeNumber, questionSetCode, teacherCode } from "./codes";
import { demoCategories, generateDemoData, seeded, shuffle } from "./demo-data";
import { matchesRecord, matchesSearch, type RecordSearchField } from "./search";
import { championshipLabelIds, championshipPhase } from "./championships";

let categories: Row[] = [
  { category_id: 1, category_name: "Science & Technology", status: 1 },
  { category_id: 2, category_name: "General Knowledge", status: 1 },
];
let labels: Row[] = [
  { label_id: 1, label_name: "Science Basics", status: 1 },
  { label_id: 2, label_name: "World Knowledge", status: 1 },
];
let questions: Row[] = [
  {
    question_id: 1,
    label_id: 1,
    label_name: "Science Basics",
    question_text: "Which planet is known as the Red Planet?",
    option1_text: "Earth",
    option2_text: "Mars",
    option3_text: "Venus",
    option4_text: "Jupiter",
    correct_answer: "2",
    expected_time_sec: 20,
    total_coins: 10,
  },
  {
    question_id: 2,
    label_id: 1,
    label_name: "Science Basics",
    question_text: "Which of these are noble gases?",
    option1_text: "Helium",
    option2_text: "Oxygen",
    option3_text: "Neon",
    option4_text: "Nitrogen",
    correct_answer: "1,3",
    expected_time_sec: 25,
    total_coins: 15,
  },
  {
    question_id: 3,
    label_id: 2,
    label_name: "World Knowledge",
    question_text: "What is the capital of Japan?",
    option1_text: "Kyoto",
    option2_text: "Osaka",
    option3_text: "Tokyo",
    option4_text: "Nagoya",
    correct_answer: "3",
    expected_time_sec: 20,
    total_coins: 10,
  },
];
let championships: Row[] = [
  {
    champ_id: 1,
    champ_name: "Science Discovery Cup",
    category_id: 1,
    category_name: "Science & Technology",
    teacher_id: 7,
    teacher_name: "Demo Teacher",
    start_date: "2026-10-01",
    end_date: "2026-12-31",
    start_time: "09:00:00",
    end_time: "18:00:00",
    status: 1,
    total_participants: 3,
    modes: [
      {
        mode_id: 1,
        mode_name: "Quick Challenge",
        description: "Explore the basics of science.",
        no_of_question: 10,
        time_minutes: "00:10:00",
      },
    ],
    label_ids: [1],
  },
  {
    champ_id: 2,
    champ_name: "World Capitals Sprint",
    category_id: 2,
    category_name: "General Knowledge",
    teacher_id: 7,
    teacher_name: "Demo Teacher",
    start_date: "2026-11-01",
    end_date: "2026-11-30",
    start_time: "10:00:00",
    end_time: "17:00:00",
    status: 0,
    total_participants: 0,
    modes: [
      {
        mode_id: 2,
        mode_name: "Quick Hit",
        description: "Name the capital.",
        no_of_question: 5,
        time_minutes: "00:05:00",
      },
    ],
    label_ids: [2],
  },
];
// Mirrors the counts the API is expected to return with championship rows.
function withCounts(championship: Row): Row {
  const ids = ((championship.label_ids || []) as unknown[]).map(String);
  const linked = questions.filter((q) => ids.includes(String(q.label_id)));
  return {
    ...championship,
    total_questions: linked.length,
    eligible_questions: linked.filter(isLiveEligible).length,
  };
}
function findChampionship(id: string | undefined) {
  const row = championships.find((c) => String(c.champ_id) === id);
  if (!row) throw new Error("Demo championship not found.");
  return row;
}
const masters: Record<string, Row[]> = {
  institutes: [
    {
      institute_id: 1,
      institute_name: "Demo Institute",
      institute_abbreviation: "DI",
      institute_address: "Sample Campus",
      institute_url: "https://example.com",
    },
  ],
  departments: [
    {
      department_id: 1,
      institute_id: 1,
      institute_name: "Demo Institute",
      department_name: "Computer Science",
    },
  ],
  qualifications: [
    { qualification_id: 1, qualification_name: "Bachelor of Technology" },
  ],
  companies: [
    {
      company_id: 1,
      company_name: "Example Sponsor",
      contact_person_name: "Demo Contact",
      contact_person_email: "contact@example.com",
      company_phone_number: "+910000000000",
    },
  ],
  advertisements: [],
  teachers: [
    {
      teacher_id: 7,
      teacher_name: "Demo Teacher",
      username: "demo.teacher",
      email: demoCredentials.teacher.identifier,
      institute: "Demo Institute",
      department: "Computer Science",
      status: 1,
    },
  ],
  "configs/coins": [{ coin_id: 1, coin_value: 10 }],
};
// Expand the hand-written fixtures with generated, realistic volumes.
const generated = generateDemoData({
  labels,
  questions,
  championships,
  teacher: masters.teachers[0],
});
categories = demoCategories.map((c) => ({ ...c }));
labels = generated.labels;
questions = generated.questions;
championships = generated.championships;
masters.teachers = generated.teachers;
const attempts = generated.attempts;
function labelOf(id: unknown) {
  return labels.find((l) => String(l.label_id) === String(id));
}
// Joins a question with its set, bank and teacher, as the API is expected to.
function withSet(question: Row): Row {
  const label = labelOf(question.label_id);
  return {
    ...question,
    label_name: label?.label_name ?? null,
    bank_name: label?.bank_name ?? null,
    teacher_id: label?.teacher_id ?? null,
    teacher_name: label?.teacher_name ?? null,
  };
}
function withQuestionCount(label: Row): Row {
  const linked = questions.filter((q) => String(q.label_id) === String(label.label_id));
  return {
    ...label,
    question_count: linked.length,
    championship_ids: championships
      .filter((c) => ((c.label_ids || []) as unknown[]).map(String).includes(String(label.label_id)))
      .map((c) => c.champ_id),
  };
}
const teacherMatches = (row: Row, query: string) => {
  const id = codeNumber(query, "TCH");
  return (
    matchesSearch(row.teacher_name, query) ||
    (id !== null && String(row.teacher_id).includes(id)) ||
    teacherCode(row).toLowerCase().includes(query.trim().toLowerCase())
  );
};
const setMatches = (row: Row, query: string) => {
  const id = codeNumber(query, "QS");
  return (
    matchesSearch(row.label_name, query) ||
    (id !== null && String(row.label_id) === id) ||
    questionSetCode(row).toLowerCase() === query.trim().toLowerCase()
  );
};
// Attempts joined with championship, set and teacher names.
function attemptRow(a: Row): Row {
  const c = championships.find((x) => x.champ_id === a.champ_id);
  const label = labelOf(a.label_id);
  return {
    ...a,
    champ_name: c?.champ_name,
    category_id: c?.category_id,
    category_name: c?.category_name,
    label_name: label?.label_name,
    teacher_id: label?.teacher_id,
    teacher_name: label?.teacher_name,
  };
}
function filteredAttempts(params: URLSearchParams, teacherId?: unknown) {
  const get = (key: string) => params.get(key) || "";
  const from = get("from"), to = get("to");
  return attempts.map(attemptRow).filter((a) =>
    (!get("championshipId") || String(a.champ_id) === get("championshipId")) &&
    (!get("categoryId") || String(a.category_id) === get("categoryId")) &&
    (!get("labelId") || String(a.label_id) === get("labelId")) &&
    (!get("teacherId") || String(a.teacher_id) === get("teacherId")) &&
    (teacherId === undefined || String(a.teacher_id) === String(teacherId)) &&
    (!from || String(a.completed_at).slice(0, 10) >= from) &&
    (!to || String(a.completed_at).slice(0, 10) <= to),
  );
}
function performance(params: URLSearchParams, teacherId?: unknown) {
  const rows = filteredAttempts(params, teacherId);
  const groups = new Map<string, Row[]>();
  for (const a of rows) {
    const key = `${a.champ_id}:${a.label_id}`;
    groups.set(key, [...(groups.get(key) || []), a]);
  }
  const sum = (list: Row[], key: string) => list.reduce((t, r) => t + Number(r[key] || 0), 0);
  const daily = new Map<string, number>();
  for (const a of rows) {
    const day = String(a.completed_at).slice(0, 10);
    daily.set(day, (daily.get(day) || 0) + 1);
  }
  return {
    rows: [...groups.values()].map((list) => {
      const first = list[0];
      return {
        champ_id: first.champ_id,
        champ_name: first.champ_name,
        category_id: first.category_id,
        category_name: first.category_name,
        label_id: first.label_id,
        label_name: first.label_name,
        teacher_id: first.teacher_id,
        teacher_name: first.teacher_name,
        participants: list.length,
        total_questions: questions.filter((q) => String(q.label_id) === String(first.label_id)).length,
        attempted: sum(list, "attempted"),
        correct: sum(list, "correct"),
        incorrect: sum(list, "incorrect"),
        avg_score: Math.round((sum(list, "marks") / list.length) * 10) / 10,
        total_marks: first.total_marks,
        avg_time_sec: Math.round(sum(list, "time_taken_sec") / list.length),
        completion_rate: Math.round((list.filter((a) => a.completed).length / list.length) * 1000) / 10,
      };
    }),
    daily: [...daily.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, participants]) => ({ date, participants })),
  };
}
// Question-by-question answers, rebuilt deterministically from the attempt.
function attemptDetails(a: Row) {
  const r = seeded(
    String(a.attempt_id).split("").reduce((t, ch) => t * 31 + ch.charCodeAt(0), 7),
  );
  const pool = questions.filter((q) => String(q.label_id) === String(a.label_id) && isIncludedInLive(q));
  const order = shuffle(r, pool.length ? pool : questions.slice(0, 20));
  const total = Number(a.total_questions);
  const outcomes = shuffle(r, [
    ...Array(Number(a.correct)).fill("correct"),
    ...Array(Number(a.incorrect)).fill("incorrect"),
    ...Array(Math.max(0, total - Number(a.attempted))).fill("unattempted"),
  ]);
  return outcomes.map((outcome, i) => {
    const q = order[i % order.length];
    const correct = String(q.correct_answer).split(",")[0];
    const wrong = ["1", "2", "3", "4"].filter((o) => !String(q.correct_answer).split(",").includes(o));
    const submitted = outcome === "correct" ? correct : outcome === "incorrect" ? wrong[Math.floor(r() * wrong.length)] : null;
    const text = (o: string | null) => (o ? `${o}. ${String(q[`option${o}_text`] ?? "")}` : null);
    return {
      number: i + 1,
      question_id: q.question_id,
      question_text: q.question_text,
      correct_answer: String(q.correct_answer).split(",").map(text).join(", "),
      submitted_answer: text(submitted),
      outcome,
      marks: outcome === "correct" ? 10 : 0,
      time_taken_sec: outcome === "unattempted" ? 0 : Math.round(6 + r() * 25),
    };
  });
}
function snake(key: string) {
  return key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}
function idFor(rows: Row[], key: string) {
  return Math.max(0, ...rows.map((r) => Number(r[key]) || 0)) + 1;
}
// Sample series with weekly rhythm and one spike, so the dashboard has something worth noticing.
function demoPeriodStats(days: number) {
  const day = 86_400_000;
  const playsOn = (i: number) =>
    Math.round(14 + 6 * Math.sin(i / 1.1) + (i % 7 < 2 ? -8 : 0) + (i === 12 ? 25 : 0));
  const series = (offset: number) =>
    Array.from({ length: days }, (_, i) => {
      const plays = Math.max(0, playsOn(i + offset));
      return {
        date: new Date(Date.now() - (days - 1 - i + offset) * day).toISOString().slice(0, 10),
        plays,
        players: Math.round(plays * 0.7),
      };
    });
  const daily = series(0);
  const sum = (rows: { plays: number }[]) => rows.reduce((t, r) => t + r.plays, 0);
  const plays = sum(daily);
  const previousPlays = sum(series(days));
  return {
    period: { days, from: daily[0].date, to: daily[days - 1].date },
    generatedAt: new Date().toISOString(),
    current: { plays, players: Math.round(plays * 0.35), accuracy: 68.4, newUsers: Math.round(plays * 0.08) },
    previous: { plays: previousPlays, players: Math.round(previousPlays * 0.33), accuracy: 66.1, newUsers: Math.round(previousPlays * 0.09) },
    daily,
    topChampionships: championships.slice(0, 5).map((c, i) => ({
      champ_id: c.champ_id,
      champ_name: c.champ_name,
      plays: Math.round(plays / (i + 2)),
      players: Math.round(plays / (i + 3)),
      accuracy: 70 - i * 4,
    })),
    liveChampionships: championships.filter((c) => c.status === 1).length,
    pendingTeachers: masters.teachers.filter((t) => Number(t.status) === 0).length,
  };
}
export function demoRequest(
  path: string,
  method: string,
  body: unknown,
  session: Session | null,
): { handled: boolean; data?: unknown } {
  const url = new URL(path, "http://demo.local");
  const route = url.pathname.replace(/\/$/, "");
  const input = (body || {}) as Row;
  if (
    method === "POST" &&
    ["/auth/teacher/login", "/auth/admin/login"].includes(route)
  ) {
    const admin = route.includes("/admin/");
    const credentials = admin ? demoCredentials.admin : demoCredentials.teacher;
    if ((admin ? input.username : input.identifier) !== credentials.identifier)
      return { handled: false };
    if (input.password !== credentials.password)
      throw new Error(
        "Incorrect demo password. Use the credentials shown below the form.",
      );
    const profile = {
      id: admin ? 1 : 7,
      name: admin ? "Demo Admin" : "Demo Teacher",
      username: admin ? "demo.admin" : "demo.teacher",
      email: admin ? "admin@kgamify.test" : credentials.identifier,
      role: admin ? "superadmin" : "teacher",
      institute: "Demo Institute",
      department: "Computer Science",
    };
    return {
      handled: true,
      data: {
        [admin ? "admin" : "teacher"]: profile,
        tokens: {
          accessToken: `demo-access-${profile.role}`,
          refreshToken: "demo-refresh",
        },
      },
    };
  }
  if (!session?.accessToken.startsWith("demo-access-"))
    return { handled: false };
  let data: unknown;
  if (route.endsWith("/dashboard-stats"))
    data = {
      ...demoPeriodStats(Number(url.searchParams.get("days")) || 30),
      championshipsCount: championships.length,
      questionsCount: questions.length,
      studentsReached: new Set(attempts.map((a) => a.user_id)).size,
      totalQuizzesCompleted: attempts.length,
      totalUsers: new Set(attempts.map((a) => a.user_id)).size,
      totalTeachers: masters.teachers.length,
      totalChampionships: championships.length,
      totalQuestions: questions.length,
      totalQuizzesPlayed: attempts.length,
    };
  else if (route === "/questions/categories") {
    if (method === "POST")
      categories.push({
        category_id: idFor(categories, "category_id"),
        category_name: input.categoryName,
        status: 1,
      });
    data = method === "GET" ? categories : { created: true };
  } else if (route === "/questions/labels") {
    if (method === "POST")
      labels.push({
        label_id: idFor(labels, "label_id"),
        label_name: input.labelName,
        status: 1,
        teacher_id: session.profile.role === "teacher" ? session.profile.id : null,
        teacher_name: session.profile.role === "teacher" ? session.profile.name : null,
        bank_name: input.bankName || null,
      });
    if (method === "GET") {
      // Optional filters for type-ahead pickers; without them, every set.
      const search = url.searchParams.get("search") || "";
      const teacher = url.searchParams.get("teacherId");
      const limit = Number(url.searchParams.get("limit")) || 0;
      const list = labels.filter(
        (l) =>
          (!search || setMatches(l, search) || matchesSearch(l.bank_name, search)) &&
          (!teacher || String(l.teacher_id) === teacher),
      );
      data = (limit ? list.slice(0, limit) : list).map(withQuestionCount);
    } else data = { labelId: labels[labels.length - 1].label_id };
  } else if (/^\/questions\/labels\/[^/]+$/.test(route) && method === "PUT") {
    const row = labelOf(route.split("/").pop());
    if (!row) throw new Error("Demo question set not found.");
    const name = String(input.labelName || "").trim();
    if (name.length < 2 || name.length > 50)
      throw new Error("Question set name must be 2 to 50 characters.");
    row.label_name = name;
    if ("bankName" in input) row.bank_name = String(input.bankName || "").trim() || null;
    for (const q of questions)
      if (String(q.label_id) === String(row.label_id)) q.label_name = name;
    data = { updated: true };
  } else if (route === "/questions/analytics/frequent-errors")
    data = [
      {
        question_id: 1,
        question_text: questions[0]?.question_text,
        error_count: 2,
      },
    ];
  else if (route === "/questions" && method === "GET") {
    const params = url.searchParams;
    const search = params.get("search") || "",
      label = params.get("labelId"),
      teacher = params.get("teacherId"),
      questionId = params.get("questionId"),
      liveState = params.get("liveState"),
      keyword = params.get("q") || "",
      field = params.get("field") || "all",
      liveOnly = params.get("includeInLive") === "true",
      liveChampionship = params.get("liveChampionship");
    // Sets used by a championship that is live today.
    const liveSets = new Set(
      championships.filter((c) => championshipPhase(c) === "Live").flatMap(championshipLabelIds),
    );
    // `q` searches set name/ID, teacher name/ID and bank (or one of them via `field`).
    const keywordMatches = (row: Row) =>
      matchesRecord(row, keyword, field as RecordSearchField);
    const filtered = questions.map(withSet).filter(
      (q) =>
        (!questionId || String(q.question_id) === questionId) &&
        (!label || String(q.label_id) === label) &&
        (!teacher || String(q.teacher_id) === teacher) &&
        (!liveOnly || isLiveEligible(q)) &&
        (!liveChampionship ||
          (liveChampionship === "yes") === liveSets.has(String(q.label_id))) &&
        (!liveState ||
          (liveState === "blocked"
            ? isBlocked(q)
            : liveState === "included"
              ? isLiveEligible(q)
              : !isBlocked(q) && !isIncludedInLive(q))) &&
        matchesSearch(q.question_text, search) &&
        keywordMatches(q),
    );
    const page = Number(url.searchParams.get("page") || 1),
      limit = Number(url.searchParams.get("limit") || 20);
    data = {
      questions: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      limit,
    };
  } else if (route === "/questions" && method === "POST") {
    const row = Object.fromEntries(
      Object.entries(input).map(([k, v]) => [snake(k), v]),
    );
    row.question_id = idFor(questions, "question_id");
    row.label_name = labels.find(
      (l) => String(l.label_id) === String(input.labelId),
    )?.label_name;
    row.expected_time_sec = input.expectedTimeSeconds;
    questions.push(row);
    data = { questionId: row.question_id };
  } else if (/^\/questions\/[^/]+$/.test(route) && method === "PUT") {
    const row = questions.find(
      (q) => String(q.question_id) === route.split("/").pop(),
    );
    if (!row) throw new Error("Demo question not found.");
    Object.assign(
      row,
      Object.fromEntries(Object.entries(input).map(([k, v]) => [snake(k), v])),
    );
    if ("expectedTimeSeconds" in input)
      row.expected_time_sec = input.expectedTimeSeconds;
    // labelId: null removes the question from its set; it stays in the bank.
    if ("labelId" in input)
      row.label_name =
        input.labelId === null
          ? null
          : labels.find((l) => String(l.label_id) === String(input.labelId))
              ?.label_name;
    data = { updated: true };
  } else if (/^\/questions\/[^/]+$/.test(route) && method === "DELETE") {
    const index = questions.findIndex(
      (q) => String(q.question_id) === route.split("/").pop(),
    );
    if (index < 0) throw new Error("Demo question not found.");
    questions.splice(index, 1);
    data = { deleted: true };
  } else if (
    route === "/championships/feed" ||
    route === "/championships/active" ||
    (route === "/teacher/championships" && method === "GET")
  )
    data = championships
      .filter((c) =>
        route.startsWith("/teacher/")
          ? String(c.teacher_id) === String(session.profile.id)
          : c.status === 1 && !isBlocked(c),
      )
      .map(withCounts);
  else if (route === "/teacher/championships" && method === "POST") {
    const id = idFor(championships, "champ_id");
    const modes = (input.modes || []) as Row[];
    championships.push({
      champ_id: id,
      champ_name: input.champName,
      category_id: input.categoryId,
      category_name: categories.find((c) => c.category_id === input.categoryId)
        ?.category_name,
      teacher_id: session.profile.id,
      teacher_name: session.profile.name,
      start_date: input.startDate,
      end_date: input.endDate,
      start_time: input.startTime,
      end_time: input.endTime,
      status: 1,
      total_participants: 0,
      modes: modes.map((m) => ({
        mode_id: id,
        mode_name: m.modeName,
        description: m.description,
        no_of_question: m.noOfQuestions,
        time_minutes: m.timeMinutes,
      })),
      label_ids: modes.flatMap((m) => (m.labelIds || []) as unknown[]),
    });
    data = { champId: id };
  } else if (/^\/teacher\/championships\/[^/]+\/status$/.test(route)) {
    const row = championships.find(
      (c) => String(c.champ_id) === route.split("/")[3],
    );
    if (!row) throw new Error("Demo championship not found.");
    if (isBlocked(row) && Number(input.status) === 1)
      throw new Error(
        "An admin has blocked this championship. It cannot be activated.",
      );
    row.status = input.status;
    data = { updated: true };
  } else if (
    /^\/teacher\/championships\/[^/]+$/.test(route) &&
    method === "PUT"
  ) {
    const row = championships.find(
      (c) => String(c.champ_id) === route.split("/").pop(),
    );
    if (!row) throw new Error("Demo championship not found.");
    const keys: Record<string, string> = {
      champName: "champ_name",
      categoryId: "category_id",
      startDate: "start_date",
      endDate: "end_date",
      startTime: "start_time",
      endTime: "end_time",
    };
    for (const [k, v] of Object.entries(input)) if (keys[k]) row[keys[k]] = v;
    data = { updated: true };
  } else if (/^\/championships\/[^/]+\/attempts\/[^/]+$/.test(route)) {
    const [, , champ, , attemptId] = route.split("/");
    const attempt = attempts.find(
      (a) => String(a.champ_id) === champ && String(a.attempt_id) === decodeURIComponent(attemptId),
    );
    if (!attempt) throw new Error("Demo attempt not found.");
    data = { ...attemptRow(attempt), questions: attemptDetails(attempt) };
  } else if (route.endsWith("/participants"))
    data = attempts
      .filter((a) => String(a.champ_id) === route.split("/")[3])
      .map(attemptRow);
  else if (route.endsWith("/analytics/performance"))
    data = performance(
      url.searchParams,
      route.startsWith("/teacher/") ? session.profile.id : undefined,
    );
  else if (/^\/teacher\/analytics\//.test(route))
    data = {
      championship: {
        name:
          championships.find(
            (c) => String(c.champ_id) === route.split("/").pop(),
          )?.champ_name || "Demo Championship",
      },
      analytics: {
        totalPlays: 3,
        averageScore: 80,
        highestScore: 95,
        lowestScore: 65,
        averageCorrect: 8,
      },
    };
  else if (route.endsWith("/leaderboard"))
    data = attempts
      .filter((a) => String(a.champ_id) === route.split("/")[2])
      .map(attemptRow);
  else if (/^\/championships\/[^/]+$/.test(route)) {
    const row = findChampionship(route.split("/").pop());
    // Blocked championships are hidden from everyone except admins.
    if (isBlocked(row) && session.profile.role !== "superadmin")
      throw new Error("This championship is not available.");
    data = withCounts(row);
  } else if (route.startsWith("/admin/")) {
    if (session.profile.role !== "superadmin")
      throw new Error("Admin access is required.");
    const key = route.slice(7);
    if (key === "championships" && method === "GET")
      data = championships.map(withCounts);
    else if (/^championships\/[^/]+$/.test(key) && method === "PUT") {
      const row = findChampionship(key.split("/")[1]);
      const name = String(input.champName || "").trim();
      if (name.length < 2 || name.length > 100)
        throw new Error("Championship name must be 2 to 100 characters.");
      row.champ_name = name;
      const keys: Record<string, string> = {
        categoryId: "category_id",
        startDate: "start_date",
        endDate: "end_date",
        startTime: "start_time",
        endTime: "end_time",
        labelIds: "label_ids",
      };
      for (const [k, v] of Object.entries(input)) if (keys[k]) row[keys[k]] = v;
      if (input.categoryId !== undefined)
        row.category_name = categories.find(
          (c) => String(c.category_id) === String(input.categoryId),
        )?.category_name;
      if (Array.isArray(input.modes))
        row.modes = ((row.modes || []) as Row[]).map((mode) => {
          const next = (input.modes as Row[]).find(
            (m) => String(m.modeId) === String(mode.mode_id),
          );
          return next
            ? {
                ...mode,
                mode_name: next.modeName,
                description: next.description,
                no_of_question: next.noOfQuestions,
                time_minutes: next.timeMinutes,
              }
            : mode;
        });
      data = { updated: true };
    } else if (/^championships\/[^/]+\/status$/.test(key)) {
      const row = findChampionship(key.split("/")[1]);
      if (![0, 1].includes(Number(input.status)))
        throw new Error("Status must be 0 or 1.");
      row.status = Number(input.status);
      data = { updated: true };
    } else if (/^championships\/[^/]+\/block$/.test(key)) {
      const row = findChampionship(key.split("/")[1]);
      if (typeof input.blocked !== "boolean")
        throw new Error("blocked must be true or false.");
      row.is_blocked = input.blocked;
      data = { updated: true };
    } else if (/^questions\/[^/]+\/block$/.test(key)) {
      const row = questions.find(
        (q) => String(q.question_id) === key.split("/")[1],
      );
      if (!row) throw new Error("Demo question not found.");
      if (typeof input.blocked !== "boolean")
        throw new Error("blocked must be true or false.");
      row.is_blocked = input.blocked;
      data = { updated: true };
    } else if (masters[key]) {
      if (method === "POST") {
        const names: Record<string, string> = {
          institutes: "institute",
          departments: "department",
          qualifications: "qualification",
          companies: "company",
          advertisements: "advertisement",
        };
        const prefix = names[key];
        const row = Object.fromEntries(
          Object.entries(input).map(([k, v]) => [snake(k), v]),
        );
        row[`${prefix}_id`] = idFor(masters[key], `${prefix}_id`);
        if (input.name) row[`${prefix}_name`] = input.name;
        if (key === "institutes") {
          row.institute_abbreviation = input.abbreviation;
          row.institute_address = input.address;
          row.institute_url = input.url;
        }
        if (key === "departments")
          row.institute_name = masters.institutes.find(
            (i) => i.institute_id === input.instituteId,
          )?.institute_name;
        masters[key].push(row);
      }
      const search = url.searchParams.get("search") || "";
      const limit = Number(url.searchParams.get("limit")) || 0;
      const list =
        key === "teachers" && search
          ? masters[key].filter((t) => teacherMatches(t, search))
          : masters[key];
      data = method === "GET" ? (limit ? list.slice(0, limit) : list) : { created: true };
    } else if (/^teachers\/[^/]+\/status$/.test(key)) {
      const row = masters.teachers.find(
        (t) => String(t.teacher_id) === key.split("/")[1],
      );
      if (row) row.status = input.status;
      data = { updated: true };
    } else if (/^configs\/coins\/[^/]+$/.test(key)) {
      const row = masters["configs/coins"].find(
        (c) => String(c.coin_id) === key.split("/").pop(),
      );
      if (row) row.coin_value = input.coinValue;
      data = { updated: true };
    } else throw new Error("This action is unavailable in demo mode.");
  } else if (route === "/support/contact") data = { recorded: true };
  else throw new Error("This action is unavailable in demo mode.");
  // Detach fixture objects from React state so later writes cannot mutate mounted views.
  return { handled: true, data: structuredClone(data) };
}
