export const entities = {
  "people": [
    "code",
    "name",
    "email",
    "organisation"
  ],
  "locations": [
    "code",
    "name",
    "kind",
    "suitability_notes"
  ],
  "accessions": [
    "code",
    "name",
    "received_on",
    "source_id",
    "method",
    "title_evidence",
    "decision",
    "decision_on"
  ],
  "objects": [
    "code",
    "name",
    "vernon_id",
    "accession_id",
    "description",
    "maker",
    "classification",
    "normal_location_id",
    "current_location_id",
    "provenance",
    "rights_note",
    "image_ref",
    "restricted",
    "inventory_checked_on",
    "inventory_checked_by",
    "source_record"
  ],
  "conditions": [
    "code",
    "name",
    "object_id",
    "checked_on",
    "checked_by",
    "grade",
    "findings",
    "next_review"
  ],
  "loans": [
    "code",
    "name",
    "borrower_id",
    "destination_id",
    "source_country",
    "destination_country",
    "starts_on",
    "due_on",
    "agreement_ref",
    "insurance_until",
    "status",
    "returned_on"
  ],
  "loan_items": [
    "code",
    "name",
    "loan_id",
    "object_id",
    "export_decision",
    "reviewed_by",
    "permit_ref"
  ],
  "movements": [
    "code",
    "name",
    "object_id",
    "from_location_id",
    "to_location_id",
    "moved_at",
    "moved_by",
    "authorised_by",
    "reason",
    "loan_id"
  ],
  "exhibitions": [
    "code",
    "name",
    "starts_on",
    "ends_on",
    "location_id"
  ],
  "exhibition_items": [
    "code",
    "name",
    "exhibition_id",
    "object_id",
    "label_text"
  ],
  "notes": [
    "code",
    "name",
    "object_id",
    "author",
    "body"
  ]
};
