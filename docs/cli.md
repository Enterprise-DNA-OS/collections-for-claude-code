# Collections CLI

Run `npm run collections -- help`. Every read accepts --json. Human output is aligned columns. UUID prefixes, codes and case-insensitive names resolve records; ambiguous matches list candidates and exit 1. Dates are real YYYY-MM-DD calendar dates. Timestamps are UTC. Unknown flags, fields and extra positional arguments fail.

## Reads

- `npm run collections -- objects`
- `npm run collections -- people`
- `npm run collections -- locations`
- `npm run collections -- accessions`
- `npm run collections -- loans`
- `npm run collections -- conditions`
- `npm run collections -- exhibitions`
- `npm run collections -- movements`
- `npm run collections -- accession-backlog`
- `npm run collections -- loans-due`
- `npm run collections -- condition-review`
- `npm run collections -- inventory-gaps`
- `npm run collections -- exhibition-readiness`
- `npm run collections -- rights-review`
- `npm run collections -- provenance-gaps`
- `npm run collections -- loan-condition`
- `npm run collections -- location-load`
- `npm run collections -- unlocated`
- `npm run collections -- export-review`
- `npm run collections -- maker-care`
- `npm run collections -- attention`
- `npm run collections -- compliance`

`object REFERENCE` includes source data, conditions, movements and notes. `weekly-review` combines loans-due, condition-review and compliance.

## Record fields

Use `add TYPE --data=FILE` or `update TYPE REFERENCE --data=FILE`. JSON fields ending in _id accept codes, names or UUID prefixes. Every new record needs code and name. Codes cannot be changed. See the migration for required fields and enumerated values.

- **people**: code, name, email, organisation
- **locations**: code, name, kind, suitability_notes
- **accessions**: code, name, received_on, source_id, method, title_evidence, decision, decision_on
- **objects**: code, name, vernon_id, accession_id, description, maker, classification, normal_location_id, current_location_id, provenance, rights_note, image_ref, restricted, inventory_checked_on, inventory_checked_by, source_record
- **conditions**: code, name, object_id, checked_on, checked_by, grade, findings, next_review
- **loans**: code, name, borrower_id, destination_id, source_country, destination_country, starts_on, due_on, agreement_ref, insurance_until, status, returned_on
- **loan_items**: code, name, loan_id, object_id, export_decision, reviewed_by, permit_ref
- **movements**: code, name, object_id, from_location_id, to_location_id, moved_at, moved_by, authorised_by, reason, loan_id
- **exhibitions**: code, name, starts_on, ends_on, location_id
- **exhibition_items**: code, name, exhibition_id, object_id, label_text
- **notes**: code, name, object_id, author, body

movements are created only through move, checkout and return-loan. Movement, condition and note history cannot be overwritten. Generic updates cannot change an object's current location. A new object's initial location is a baseline, not fabricated movement history. Loans start as planned; generic edits to active or returned loans and their items are rejected. Add one loan_items row per object. source_record and imported identity are import-owned.

Example new inspection in imports/inspection.json:

```json
{"code":"C04","name":"Arrival check","object_id":"2026.1.1","checked_on":"2026-10-06","checked_by":"Registrar","grade":"good","findings":"No change observed","next_review":"2027-04-06"}
```

```bash
npm run collections -- add conditions --data=imports/inspection.json
npm run collections -- move 2026.1.2 CONSERVATION --by=Registrar --authoriser=Curator --reason="Care assessment"
npm run collections -- checkout L02 --by=Registrar --authoriser=Curator
npm run collections -- return-loan L01 --by=Registrar --authoriser=Curator
npm run collections -- inventory 2026.1.3 --by=Registrar --date=2026-10-06
npm run collections -- log 2026.2.1 --by=Registrar --text="Donor contacted about title"
```

Checkout of the seeded L02 deliberately fails because its evidence and condition are incomplete. Move rejects objects on active loans. Checkout requires loan dates containing today, accepted acquisition, a condition review covering the loan, agreement and insurance references, and per-object export assessment for international loans. Return puts all objects at their normal locations atomically. Physical work and approvals must have happened before recording them.

`draft-loan LOAN` and `draft-weekly` write a new Markdown file under drafts/. Optional --file=NAME.md cannot escape that folder or overwrite an existing file. No send command exists.

`export --file=exports/collections.json` writes a consistent full JSON snapshot. It refuses to overwrite files. It is not a restore tool; use a tested database backup process too.

`import vernon --file=imports/objects.csv [--dry-run] [--map=imports/map.json]`: supported mapping keys are code, name, vernon_id, description, maker, classification, current_location_id, normal_location_id, provenance, rights_note and image_ref. Dates, decisions, historic moves and permissions are not inferred from an object report. The sample CSV contains fictional data.
