# kGamify Admin Panel

Independent Next.js frontend port of the existing Admin Panel portal. Uses the REST endpoints in [API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md). The PHP source is unchanged. The Node backend includes an authenticated question-image upload API.

## Start

Requires Node.js 20.9+.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3001. Start the existing API separately on port 5001, or set `NEXT_PUBLIC_API_BASE_URL` in `.env.local`. The API must allow this frontend origin through CORS.

```sh
npm run build
npm start
```

## Scope

Game settings are part of the championship form. The frontend sends one `modes` entry to match the existing API documentation, which still uses numeric IDs. It does not assume the proposed PostgreSQL schema is live.

Tokens stay in memory. Reloading requires sign-in. Unsupported legacy actions show an explicit unavailable notice; no endpoints have been invented.

See [Frontend porting notes](../docs/FRONTEND_PORTING.md) for API mappings, route aliases, importer behavior, and the complete list of API gaps.

## Development demo

With `NEXT_PUBLIC_ENABLE_DEMO=true`, `npm run dev` accepts the demo credentials shown on the login screen. Teacher: `teacher@kgamify.test` / `DemoTeacher123!`. Admin: `demo.admin` / `DemoAdmin123!`. These select in-memory sample data, never create a backend account, and never send demo writes to the API. Changes reset on page reload. Demo login is disabled in production builds, regardless of this flag. Restart the dev server after changing environment variables. Set the flag to `false` to hide the demo credentials.

## Championship creation

The creation wizard has three steps: setup, questions, and review/publish. Setup stays in page memory until publication. Questions are saved immediately to the shared bank; selected question sets are linked when publishing. Each game draws the configured number from those sets. The documented API creates championships as active, so no championship is sent before the final Publish action. Reloading clears unfinished setup.

## Question sets and import

Question Sets now combines creating sets, viewing their questions, manual question entry, and CSV/JSON import. Imports are assigned to the selected set, overriding per-row label IDs. The old `/questions/import` URL opens this same workspace in import mode. The championship wizard also offers import directly inside its questions step; creating a new set there opens its importer.

Question-set creation uses a three-step wizard: name the set, add questions manually or by import, then review and finish. The set is saved after the first step because question records need its ID; questions are saved as they are added. Finish returns to the completed set. The standalone New Question navigation item has been removed.

## Question formatting

Question text supports bold, italic, underline, text color, bullet lists, and clear formatting in every authoring flow. It is sent as a restricted HTML string in the existing `questionText` field. Question tables and review screens render the same safe formatting. Pasted/imported markup is normalized to an allowlist; scripts, event handlers, links and arbitrary CSS are not rendered. The backend and any separate player app must also sanitize and render this HTML appropriately. The dependency-free browser editor uses native contenteditable editing commands to preserve undo history; see [MDN's browser editing reference](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand) for browser support limitations.

## Question images and editing

Question forms now use a dedicated composer: formatted question text, four answer choices with checkboxes to mark one or more correct answers, optional image attachments, and scoring/time settings. Each question and answer can have an uploaded image. JPEG, PNG, WebP and GIF files up to 5 MB can be selected or dropped, previewed, replaced or removed. Saving waits for uploads to complete.

Real sessions upload through `POST /questions/images` on the configured backend. The returned public URL is saved with the question; binary files are not included in the question JSON. Demo sessions keep their attachments in memory and never upload them to the live API.

The backend stores files in `UPLOAD_DIR/questions` (default `./uploads/questions`). Set `PUBLIC_API_URL` to the public API origin in production. See [API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md) for upload requests and server storage configuration.

## Multiple correct answers

A question can have several correct answers. They are sent in the existing `correctAnswer` field as a sorted, comma-separated string (`"1,3"`); a single answer is still `"2"`. Imports accept `1;3`, `1|3` or a quoted `"1,3"` in CSV. The backend and player app must accept and score this format.

## Removing questions from a set

In the Question Bank, filter by a question set, tick questions, and choose **Remove from set**. Each question is sent to `PUT /questions/:id` with its current data and `labelId: null`. The question is not deleted; it stays in the bank without a set and can be assigned again by editing it. The backend must accept a null `labelId` on update.

## Live quiz question selection

In Question Sets, the Questions view has an **Include** checkbox per question. Only included questions are meant to appear when a championship using the set goes live. Changes are kept across pages until **Save selection** (or **Discard changes**); switching sets, tabs or leaving the page warns about unsaved changes. At least one question in the set must stay included.

The choice is stored per question as `includeInLive` (sent with the question's current data to `PUT /questions/:id`); question content is not changed and nothing is deleted. Questions without the flag count as included. The championship wizard counts only included questions using `GET /questions?labelId=…&includeInLive=true`. The backend must store the flag, support that filter, and draw live-quiz questions only from included ones; the player app shows whatever the backend serves.

## Admin championship management and moderation

The Championships table shows **S.No.**, **Championship ID**, name, **No. of questions**, **Questions to display**, start and end dates, status, and icon actions (view, edit, activate/deactivate, block/unblock, leaderboard). It can be filtered by status (Active, Inactive, Blocked, Completed), searched, sorted and paged. Total questions comes from `total_questions` on each row (every question in the linked sets). Questions to display is the per-game number capped by `eligible_questions` (included and not blocked); a warning shows when there are not enough.

Admins load every championship from `GET /admin/championships`, including inactive and blocked ones. They can rename from the list (`PUT /admin/championships/:id` with `{ champName }`), edit every field from the championship's View page (the same `PUT` with `champName`, `categoryId`, `startDate`, `endDate`, `startTime`, `endTime`, `labelIds` and `modes: [{ modeId, modeName, description, noOfQuestions, timeMinutes }]`), activate/deactivate (`PATCH /admin/championships/:id/status` with `{ status: 0 | 1 }`) and block/unblock (`PATCH /admin/championships/:id/block` with `{ blocked }`) any championship. If the service returns 404 for the list, the panel falls back to the active feed and hides these controls.

In the Question Bank, admins can block/unblock questions (`PATCH /admin/questions/:id/block` with `{ blocked }`). Blocked items carry `is_blocked` and are marked with a red **Blocked** badge. The backend must keep blocked questions out of live quizzes and out of `includeInLive=true` results, keep blocked championships out of public feeds and refuse to open them or accept participation, and refuse teacher activation while a championship is blocked.

Status changes, blocking, question deletion and teacher approval or suspension ask for confirmation in a dialog first.

## Identifiers

Tables show readable IDs: championships `CH-00012`, question sets `QS-0042`, teachers `TCH-0103` and participants `USR-10001`. If the API sends `champ_code`, `label_code`, `teacher_code` or `user_code`, that value is shown instead. Otherwise the code is built from the numeric ID, so it is always unique. Searches accept either form (`TCH-0103`, `tch-103` or `103`).

## Question sets

The Question Sets list shows only S.No., the set name and a View action. View opens `/labels/:id`, which shows the set ID, teacher (name and ID), bank and question count in one summary row. The questions, add-question and import tabs that used to be on the list page are now on this page. `/labels/:id?tab=import` opens the import tab. `/questions/import` now shows the list and asks you to choose the set to import into. Teacher and bank details come from `teacher_id`, `teacher_name` and `bank_name` on `GET /questions/labels` rows. Admins can edit a set's name and bank from its page with **Edit** (`PUT /questions/labels/:id` with `{ labelName, bankName }`); the backend must provide this endpoint. The page's **Search records** box searches the whole set on the server (`GET /questions?labelId=…&search=…`), not just the questions on the current page.

## Question Bank search

The Question Bank lists every individual question. Each question belongs to one question set (`label_id`); the set carries the bank and teacher, and championships use sets (`label_ids` / mode `label_ids`). The table shows Question ID (`Q-00042`), question, correct answer, set, teacher, Status (Included / Excluded / Blocked) and Live quiz (the live championships currently drawing from the question's set, worked out from `GET /admin/championships`). View opens a panel with the full question and every championship using its set.

Search is one box that looks in every field (sent as `q` with `field=all`), with a **Filters** button that folds out Teacher, Question set, Status (Included / Excluded / Blocked) and Live quiz (Included = the set is used by a championship live today, Excluded = it is not). Search and filters apply together; active ones show as removable chips, with Clear filters and Clear all. The Question Sets list has the same bar, searching set name and ID, teacher name and ID, and bank, with filters for Teacher, Set status and Championship (sets the championship uses), applied in the browser. Results load one page at a time from the server, and typing waits 350 ms before a request is sent. Parameters for `GET /questions`:

| Parameter | Meaning |
|---|---|
| `q`, `field` | Case-insensitive keyword. The panel always sends `field=all`, which must also match question text and question IDs (`Q-00042` / `42`). **The backend's `all` must cover these.** `field` is `all` (default), `set` (set name), `setId`, `teacher` (teacher name), `teacherId` or `bank`. Names match every word in any order; IDs (`QS-0012`, `12`, `TCH-0103`, `103`) match exactly or by the start of the code. The Question Sets list applies the same rules in the browser. |
| `search` | Words in the question text (Search in: Question text) |
| `teacherId`, `labelId` | Exact teacher or question set |
| `liveState` | Status: `included`, `excluded` or `blocked` |
| `liveChampionship` | `yes`: the question's set is used by a championship that is live today (active, not blocked, within its dates); `no`: it is not. **New: the backend must support this.** |
| `questionId` | One question (Search in: Question ID, and the editor). `Q-00042` and `42` are both sent as `42` |
| `page`, `limit` | Pagination (10, 25, 50 or 100 rows) |

Question rows should include `bank_name`, `teacher_id` and `teacher_name`. The Teacher and Question set pickers call `GET /admin/teachers?search=&limit=10` and `GET /questions/labels?search=&limit=10`. If the server ignores these parameters, the panel filters the response and keeps only the first 10 matches.

## Analytics and leaderboards

`/analytics` is a dashboard with KPI cards, accuracy and correct/incorrect charts, a participation trend and a detailed table. It can be filtered by championship, category, question set, teacher and date range. Data comes from `GET /admin/analytics/performance` (teachers: `/teacher/analytics/performance`). The endpoint accepts `championshipId`, `categoryId`, `labelId`, `teacherId`, `from` and `to`, and returns `{ rows, daily }`. Each row covers one championship and question set, with participant, attempt, correct, incorrect, average score, total marks, average time and completion rate figures. If the endpoint is missing, the page says so.

`/leaderboard/:id` (and the older `/analytics/:id`) ranks participants by higher marks, then higher accuracy, then shorter time. Participants who tie on all three share a rank. Ranks are calculated over the whole championship, so filters never renumber anyone. The page reads `GET /championships/:id/leaderboard`. It accepts the older fields (`userName`, `score`, `correctCount`, `timeTaken`) or detailed attempt rows (`attempt_id`, `user_id`, `label_id`, `teacher_id`, `attempted`, `correct`, `incorrect`, `marks`, `total_marks`, `time_taken_sec`, `completed_at`, `completed`). A completed attempt passes at 40% of total marks. View Details opens a drawer that loads question-by-question answers from `GET /championships/:id/attempts/:attemptId` (`questions: [{ question_text, submitted_answer, correct_answer, outcome, marks, time_taken_sec }]`).

Demo mode generates this data from a fixed seed: about 37 teachers (some sharing a name), more than 100 question sets in named banks, about 2,600 questions, 14 championships and about 1,500 attempts.
