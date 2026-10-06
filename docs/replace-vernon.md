# Bring a selected Vernon object export across

The free importer accepts selected object fields exported through Vernon's reporting tool and saved as UTF-8 CSV. It does not ingest an entire Vernon installation. Field selection varies by collection; there is no universal export file.

## Export and prepare

1. Keep a complete Vernon backup and original media. Start with a small selection of Object records.
2. In Vernon Reporting choose a new Export report, then Formatting Options and the Excel-compatible format. Select fields and export the text file.
3. Open that text file through Excel's import wizard. Verify encoding, date and accession identifiers as text. Save a copy as CSV UTF-8, retaining accession punctuation and leading zeroes.
4. Include Accession Number and Object Name (or Title). Include System ID, Description, Artist/Maker, Classification, Current Location, Normal Location, Provenance, Rights Notes and Image Reference where available. Multi-valued fields must be deliberately flattened or mapped; this base stores one current location and one maker per object.

[Vernon's export instructions](https://help.vcms.vernonsystems.com/reporting/export-data-excel.htm), opened 6 October 2026, describe the report export and Excel conversion. Saving that spreadsheet as CSV is our preparation step. [Vernon's Object file](https://help.vcms.vernonsystems.com/reference/files/cataloguing/object-file.htm) documents its richer record structure.

## Import

Keep private source data under imports/, which Git ignores.

```bash
npm run collections -- import vernon --file=imports/objects.csv --dry-run
npm run collections -- import vernon --file=imports/objects.csv
npm run collections -- objects
npm run collections -- provenance-gaps
```

One import command handles the prepared CSV. The trial executes the same validations then rolls back. It reports rows inserted and unchanged. Unknown fields survive in source_record. Missing current locations remain unknown; no historic moves, acquisitions, permissions or rights are invented.

Exact repeated source rows are skipped. Changed accession numbers, conflicting System IDs or changed source rows stop the whole import. Reconcile changes deliberately against the original source; the importer does not silently overwrite later work. Duplicate rows, malformed CSV and missing identifiers fail atomically.

For different headings, pass `--map=imports/map.json`. The mapping is a JSON object from supported field key to exact source heading, for example `{"code":"Museum Number","name":"Object Title"}`. See docs/cli.md. Review every unmapped source column.

## Reconcile before switching

Compare counts and at least one complex record per object type, leading-zero identifiers, non-ASCII names, location names and multiline descriptions. Check rights and provenance separately. Import-created locations are unverified labels with kind store, never verified facility records. Edit their kind and suitability deliberately.

Acquisition decisions, object parts, vocabulary hierarchies, valuation histories, loan histories, condition histories, image binaries, security roles, workflows and exhibition relationships are not brought in by this object importer. Preserve them in the original backup, then map and migrate them separately with the registrar before retiring Vernon. Image Reference stores a path only; it neither copies nor publishes the file.

Enterprise DNA can map the remaining records into a version built around the museum. A complex collection is not an automatic one-day migration. Do a trial, check the exception list, then agree the cutover.
