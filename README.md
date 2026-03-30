# EvalWiz

EvalWiz is a personal attempt to build the academic portal I always wished existed around me. It started from a very familiar frustration with university systems that feel old, rigid, and strangely annoyed that users keep showing up. I wanted something that feels calm, intentional, and actually useful to administrators, mentors, faculty, and eventually students too. This repo is basically the running logbook of that attempt.

Right now this project is a course operations and evaluation platform. It handles academic setup, course offerings, reusable classes, student registry management, mentor and faculty workflows, marks entry, reports, analytics, advanced analytics, exports, theme customization, and a few small surprises tucked into the interface for people who click around a little too curiously. Even though it is still a local first project, the codebase is already shaped around workflows that matter in a real institution.

## Project Spirit

This is not a polished company product yet. It is a serious pet project. That means two things at once. I care a lot about engineering quality and architectural clarity, and I also care about whether the app feels warm, human, and enjoyable to use. I do not want a portal that looks like punishment dressed as productivity. I want something that can grow into a real academic platform while still feeling like it was built by someone who actually has to live with the software. A lot of the design and architecture decisions here come from building something, bumping into a sharp edge, and deciding that edge should not exist.

## What The App Does Today

EvalWiz currently supports a global admin console and course scoped workspaces for mentors and faculty. Admin has access to global records and setup flows. Mentors work at the course offering level. Faculty work at the class level. The app models subjects separately from term specific offerings, keeps reusable class rosters distinct from offerings, supports electives as special mixed roster offerings, and lets student data live globally rather than being trapped inside whatever course happened to notice them first.

The current dashboard covers academic setup, users, students, sections, assessments, marks, reports, analytics, advanced analytics, exports, and a scenario simulation area. The student record flow is split between a global admin view and a subject scoped workspace view. Theme switching is a first class part of the UI rather than an afterthought, and the system includes several custom palettes across light and dark modes.

## Technical Shape

### Technology Stack

The app is built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma, SQLite for the local data store, and NextAuth version 5 beta for authentication. Charts are rendered with Recharts. PDF generation uses html to image and jsPDF. Spreadsheet export uses xlsx and exceljs. State for small client side flows uses Zustand where that helps keep components tidy.

The app uses the App Router. Most domain logic lives in server rendered pages, server actions, and shared helpers inside `src/lib`. The current setup is intentionally compact because this is still a single app, but the data model and workflow separation already lean toward a more modular future architecture. In other words, it is still one machine, but I have been trying to teach it some manners.

### How The Code Is Organized

The main application lives under `src/app`. Login lives in `src/app/login`. The dashboard and all role aware course workflows live in `src/app/dashboard`. Shared UI primitives live in `src/components` and `src/components/ui`. Shared domain helpers, formatting, workspace logic, roll number parsing, theme helpers, export utilities, and tests live in `src/lib`.

### Database Shape

The Prisma schema lives in `prisma/schema.prisma` and currently targets SQLite through `dev.db`. The main models are `User`, `Faculty`, `Subject`, `Section`, `Student`, `Assessment`, `Mark`, `AuditLog`, `CourseOffering`, `CourseOfferingClass`, `CourseOfferingMentor`, and `CourseOfferingEnrollment`.

That split is important. Subjects are reusable academic entities. Course offerings are term specific instances of subjects. Sections represent reusable classes or class like roster groups. Students live globally. Marks belong to students and assessments. Mentor assignment is offering specific. Faculty assignment to sections is offering specific. Electives are modeled differently from regular courses through offering scoped enrollment rather than purely home class membership.

### Roll Number Logic

The app includes roll number parsing logic so regular class mapping can be derived from structured student identifiers. That logic is used to interpret school code, program code, batch year, section identity, and roster position. This is deliberately kept separate from subject modeling. Subjects are not tied to a school or department simply because a student roll number can be parsed that way. Roll semantics are used for roster intelligence, not for turning the academic catalog into detective work or accidental bureaucracy.

### Authentication And Roles

Authentication uses credentials based sign in through NextAuth. Session strategy is JWT based. The login page is custom and intentionally always uses the default visual theme to avoid flashing during theme restoration. Roles are handled as a mix of base account capability and offering scoped context. Admin is global. Mentor is offering specific. Faculty scope depends on assignment inside the active workspace.

### Theming And Visual System

Theming is part of the product identity rather than a one line dark mode switch. The root document carries theme classes, the login page is intentionally excluded from theme persistence overrides, and the dashboard offers a theme studio with multiple light and dark palettes. Reports and on screen charts use theme aware styling where appropriate, while exported documents stay visually stable enough to read like official output instead of a screenshot from a spaceship. More time has gone into getting theme behavior right than any sensible person would admit immediately.

Typography mixes a stronger serif academic tone with a cleaner sans serif interface layer. The goal is to make reports and educational surfaces feel like they belong to a university while keeping controls, dense tables, and filters modern and readable.

## Local Development

This project is currently built to run locally.

### Setup

Install dependencies with

```bash
npm install
```

Push the local Prisma schema with

```bash
npx prisma db push
```

Seed the database with

```bash
npx tsx prisma/seed.ts
```

Run the development server with

```bash
npm run dev
```

Build a production bundle locally with

```bash
npm run build
```

Run the production build with

```bash
npm run start
```

The default local database file is `prisma/dev.db`. The seed script creates an admin user, faculty accounts, mentors, reusable classes, a course offering, sample students, and sample assessments with marks.

### Seeded Credentials

Admin login

```text
admin@amrita.edu
admin123
```

Mentor login

```text
mentor1@amrita.edu
faculty123
```

Faculty login

```text
fac1@amrita.edu
faculty123
```

## Testing

The test setup is intentionally layered. That happened partly by design and partly because every time the app got more capable, the cost of trusting manual testing alone started looking worse.

### Vitest

Vitest handles unit and mocked integration tests. These currently cover a good portion of the shared utility layer and now also cover several high risk server action files, authentication behavior, PDF export behavior, and workspace label helpers. This is where I try to pin down the logic that is too important to keep rechecking by hand.

Coverage can be run with

```bash
npm run test:coverage
```

### Playwright

Playwright is configured as a thin local smoke suite. Right now it focuses on safe browser level checks such as login page health, protected route redirects, and invalid credential handling. I kept it non destructive because I do not want automated tests silently resetting local academic data just to make browser login flows pass and then acting innocent afterward. That layer will get bolder later, but only when the local data story is stable enough to deserve it.

End to end smoke tests run with

```bash
npm run test:e2e
```

Linting runs with

```bash
npm run lint
```

### What Is Tested Well Right Now

Shared domain helpers are in decent shape. Workspace guards, workspace state logic, roll number parsing, palette theme helpers, chart theme helpers, labels, and utility functions all have meaningful test coverage. The critical dashboard action files for academic setup, students, marks, sections, and assessments now have their first real mocked test layer as well.

### What Still Needs More Test Depth

Some deeper workflow permutations inside academic setup are still not exhaustively covered. Users actions are still a meaningful gap. The larger client side analytical surfaces such as reports, advanced analytics, and the what if engine would benefit from more pure helper extraction so their calculation logic can be tested without trying to wrestle giant components directly. The Playwright layer should also grow later into a richer seeded environment flow once the local data strategy is settled.

## Current Workflow Model

Admin starts from a global console and only drops into course context intentionally. Mentors see course level information with section aware filtering where needed. Faculty see class level views. Students are global records with home class identity, while elective enrollments can temporarily bring students from different home classes into a single offering. Marks entry, reports, analytics, and advanced analytics all use the active workspace as their scope boundary.

## Exports And Reports

The reporting surface includes consolidated views, component wise summaries, PDF export support, and spreadsheet oriented flows. PDF export temporarily forces a stable light document treatment and serif typography so reports read more like formal academic output than like screenshots of the live dashboard.

## Design Choices I Care About

I care a lot about not overwhelming the user. A lot of the recent work in this project has been about reducing repeated context, simplifying labels, compacting class naming, clarifying scope, improving theme behavior, keeping colored chips readable in every palette, and making the dashboard feel less like a noisy admin panel and more like a thoughtful workspace that is not trying to win an argument with you. A surprising amount of product quality lives in these tiny irritations, so I keep chasing them down.

## What This Is Growing Toward

Even though the current codebase is still a single web app, I see this as a stepping stone toward a larger academic platform with better service boundaries, stronger APIs, native mobile clients, attendance, LMS features, richer student workflows, and eventually AI assisted operations. The current repo is where a lot of the product thinking, workflow exploration, and interaction design are being worked out in practice, with equal parts curiosity, stubbornness, and caffeine. Some ideas land cleanly. Some arrive after the third refactor. Both kinds are welcome.

## Why I Am Building It This Way

Because a university portal should not feel like legacy paperwork with a web skin. It should feel dependable, understandable, and pleasant enough that people stop dreading it. EvalWiz is my attempt to move in that direction one module at a time, without pretending that bland software is the price of being serious. This repository is the trail of that work in progress.
