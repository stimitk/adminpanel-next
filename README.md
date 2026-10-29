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

Question forms now use a dedicated composer: formatted question text, four answer choices with inline correct-answer selection, optional image attachments, and scoring/time settings. Each question and answer can have an uploaded image. JPEG, PNG, WebP and GIF files up to 5 MB can be selected or dropped, previewed, replaced or removed. Saving waits for uploads to complete.

Real sessions upload through `POST /questions/images` on the configured backend. The returned public URL is saved with the question; binary files are not included in the question JSON. Demo sessions keep their attachments in memory and never upload them to the live API.

The backend stores files in `UPLOAD_DIR/questions` (default `./uploads/questions`). Set `PUBLIC_API_URL` to the public API origin in production. See [API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md) for upload requests and server storage configuration.
