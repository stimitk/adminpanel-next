import type { Row, Session } from "./types";
import { demoCredentials } from "./demo-config";

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
  },
];
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
const participants: Row[] = [
  {
    user_name: "Alex",
    email: "alex@example.com",
    total_score: 95,
    total_bonus: 15,
    correct_questions: 9,
    total_questions: 10,
    time_taken: "00:02:40",
  },
  {
    user_name: "Sam",
    email: "sam@example.com",
    total_score: 80,
    total_bonus: 10,
    correct_questions: 8,
    total_questions: 10,
    time_taken: "00:03:15",
  },
  {
    user_name: "Jordan",
    email: "jordan@example.com",
    total_score: 65,
    total_bonus: 5,
    correct_questions: 7,
    total_questions: 10,
    time_taken: "00:04:00",
  },
];
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
      studentsReached: 3,
      totalQuizzesCompleted: 3,
      totalUsers: 3,
      totalTeachers: masters.teachers.length,
      totalChampionships: championships.length,
      totalQuestions: questions.length,
      totalQuizzesPlayed: 3,
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
      });
    data =
      method === "GET"
        ? labels
        : { labelId: labels[labels.length - 1].label_id };
  } else if (route === "/questions/analytics/frequent-errors")
    data = [
      {
        question_id: 1,
        question_text: questions[0]?.question_text,
        error_count: 2,
      },
    ];
  else if (route === "/questions" && method === "GET") {
    const search = (url.searchParams.get("search") || "").toLowerCase(),
      label = url.searchParams.get("labelId");
    const filtered = questions.filter(
      (q) =>
        (!label || String(q.label_id) === label) &&
        String(q.question_text).toLowerCase().includes(search),
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
    data = { updated: true };
  } else if (
    route === "/championships/feed" ||
    route === "/championships/active" ||
    (route === "/teacher/championships" && method === "GET")
  )
    data = championships.filter((c) =>
      route.startsWith("/teacher/")
        ? String(c.teacher_id) === String(session.profile.id)
        : c.status === 1,
    );
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
    });
    data = { champId: id };
  } else if (/^\/teacher\/championships\/[^/]+\/status$/.test(route)) {
    const row = championships.find(
      (c) => String(c.champ_id) === route.split("/")[3],
    );
    if (!row) throw new Error("Demo championship not found.");
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
  } else if (route.endsWith("/participants")) data = participants;
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
    data = participants.map((p, i) => ({
      rank: i + 1,
      userName: p.user_name,
      score: p.total_score,
      bonus: p.total_bonus,
      correctCount: p.correct_questions,
      totalQuestions: p.total_questions,
      timeTaken: p.time_taken,
    }));
  else if (/^\/championships\/[^/]+$/.test(route)) {
    data = championships.find(
      (c) => String(c.champ_id) === route.split("/").pop(),
    );
    if (!data) throw new Error("Demo championship not found.");
  } else if (route.startsWith("/admin/")) {
    if (session.profile.role !== "superadmin")
      throw new Error("Admin access is required.");
    const key = route.slice(7);
    if (masters[key]) {
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
      data = method === "GET" ? masters[key] : { created: true };
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
