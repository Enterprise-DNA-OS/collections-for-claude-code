# Collections for Claude Code

Objects, accessions, locations, loans, condition records and exhibitions in a database you own. Free MIT code from Enterprise DNA. Works with Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free code you install and operate. Hosting and agent costs remain yours. | Your fields, collection policies, screens and Vernon export mapping. [Discuss your version](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=vernon&utm_medium=github). | Installed and operated through Omni by Enterprise DNA. One setup fee, then a retainer. [See the offer](https://enterprisedna.co/omni/instead-of/vernon). |

## Quick start

Node 20 or newer. Start with fictional demo records in a local database. Never seed a live collection.

```bash
git clone https://github.com/Enterprise-DNA-OS/collections-for-claude-code.git
cd collections-for-claude-code
npm install
npm run demo
npm test
npm run collections -- attention
npm run collections -- loans-due
npm run view
npm run docs
```

PGlite runs the local demo without a server. DATABASE_URL selects a PostgreSQL database. Use a trusted registrar role, restricted network access and tested backups. Tables have row-level security enabled with no public policies. There is no browser login, public API or per-user permissions implementation. One collection per database.

## What works today

Eleven record types and four views cover the registrar's week. Actual moves update the current location and append history in one transaction. Loan checkout records dispatch only after selected agreement, insurance, condition, date and export-evidence checks. Return records move objects to their normal locations. Checks assist the registrar; they never grant permission or verify source documents.

The [import guide](docs/replace-vernon.md) explains the selected-field Vernon report, Excel conversion and one-command CSV import. It is an object catalogue import, not a complete migration of every Vernon module. Original rows are preserved; repeats are idempotent; changed source rows require deliberate reconciliation.

## Ten questions to ask

Vernon supports configurable reports. These are real questions this base answers today, not unsupported claims that Vernon cannot report them. You can change the rule and report together in your own system.

1. Which loans are due back within a month, including overdue objects? (`loans-due`)
2. Which objects need care before an exhibition opens? (`exhibition-readiness`)
3. Which planned loans need a condition review before their return date? (`loan-condition`)
4. Which locations hold objects with poor or urgent condition? (`location-load`)
5. Which objects lack provenance or an accepted acquisition? (`provenance-gaps`)
6. Which objects have no recorded current location? (`unlocated`)
7. Which objects have not had an inventory check in a year? (`inventory-gaps`)
8. Which objects have no recorded rights note? (`rights-review`)
9. Which overseas loans still need an export assessment? (`export-review`)
10. Which makers have the most objects needing a condition review? (`maker-care`)

## Weekly recipes

39 recipes live in .claude/commands. Begin with /accession-backlog, /loans-due, /condition-review, /inventory-gaps and /exhibition-readiness. /weekly-review combines three current reads. /log records an observation. /draft-loan and /draft-weekly write drafts only. [Every recipe](docs/command-library.md) and [the CLI contract](docs/cli.md) cover the remaining jobs.

## Documents and reports

npm run docs renders draft loan schedules, acquisition receipts, condition records and movement histories. brand.json sets the museum name, logo and colours. npm run view renders three private, read-only reports. Loan schedules are not signed agreements. [Scope of the static output](docs/why-no-front-end.md).

## Your first hour: ten things to ask for

1. Put our museum name on the reports.
2. Add our store labels.
3. Record a recent inventory observation.
4. Show loans due back this month.
5. Add a condition inspection.
6. Trial a small Vernon object export.
7. Add our collection category field.
8. Change the inventory review interval.
9. Add an exhibition preparation report.
10. Draft a loan schedule for review.

## Verification and operating limits

npm test creates disposable data, tests every CLI command, seed idempotence, import rollback, repeat imports, movement history, rejected loan dispatch, evidence checks and generated output. It ignores inherited production database settings. TEST_DATABASE_URL is only for a disposable CI database. Windows and Linux use the same test suite; remote results must be checked separately.

Read [compliance scope](docs/compliance.md): Spectrum-inspired record checks and selected export evidence, not accreditation or legal advice. The 365-day inventory cycle is a demo policy. No rights, title, cultural permissions, transport safety or insurance validity are inferred. Restricted records, locations and donor details remain private. No email, public catalogue, payment or transport arrangement occurs.

Exports contain all records, including restricted information. Keep them out of Git and store encrypted backups with a tested restore procedure. MIT. Independent project, not affiliated with Vernon Systems.
