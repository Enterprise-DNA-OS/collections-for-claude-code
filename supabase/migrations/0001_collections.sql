create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
create table people (id uuid primary key default gen_random_uuid(), code text not null unique check (btrim(code)<>''), name text not null check (btrim(name)<>''), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), email text, organisation text);
create trigger touch_people before update on people for each row execute function touch_updated_at();
alter table people enable row level security;
create table locations (id uuid primary key default gen_random_uuid(), code text not null unique check (btrim(code)<>''), name text not null check (btrim(name)<>''), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), kind text not null default 'store' check(kind in ('store','gallery','external','transit')), suitability_notes text);
create trigger touch_locations before update on locations for each row execute function touch_updated_at();
alter table locations enable row level security;
create table accessions (id uuid primary key default gen_random_uuid(), code text not null unique check (btrim(code)<>''), name text not null check (btrim(name)<>''), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), received_on date not null, source_id uuid references people(id), method text not null default 'gift' check(method in ('gift','purchase','transfer','deposit')), title_evidence text, decision text not null default 'pending' check(decision in ('pending','accepted','declined')), decision_on date, check(decision <> 'accepted' or (decision_on is not null and nullif(btrim(title_evidence),'') is not null)));
create trigger touch_accessions before update on accessions for each row execute function touch_updated_at();
alter table accessions enable row level security;
create table objects (id uuid primary key default gen_random_uuid(), code text not null unique check (btrim(code)<>''), name text not null check (btrim(name)<>''), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), vernon_id text unique, accession_id uuid references accessions(id), description text, maker text, classification text, normal_location_id uuid references locations(id), current_location_id uuid references locations(id), provenance text, rights_note text, image_ref text, restricted boolean not null default true, inventory_checked_on date, inventory_checked_by text, source_record jsonb);
create trigger touch_objects before update on objects for each row execute function touch_updated_at();
alter table objects enable row level security;
create table conditions (id uuid primary key default gen_random_uuid(), code text not null unique check (btrim(code)<>''), name text not null check (btrim(name)<>''), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), object_id uuid not null references objects(id), checked_on date not null, checked_by text not null check(btrim(checked_by)<>''), grade text not null check(grade in ('good','fair','poor','urgent')), findings text not null check(btrim(findings)<>''), next_review date, check(next_review is null or next_review>=checked_on));
create trigger touch_conditions before update on conditions for each row execute function touch_updated_at();
alter table conditions enable row level security;
create table loans (id uuid primary key default gen_random_uuid(), code text not null unique check (btrim(code)<>''), name text not null check (btrim(name)<>''), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), borrower_id uuid not null references people(id), destination_id uuid not null references locations(id), source_country text not null default 'NZ' check(source_country ~ '^[A-Z]{2}$'), destination_country text not null default 'NZ' check(destination_country ~ '^[A-Z]{2}$'), starts_on date not null, due_on date not null, agreement_ref text, insurance_until date, status text not null default 'planned' check(status in ('planned','active','returned')), returned_on date, check(due_on>=starts_on), check((status='returned')=(returned_on is not null)));
create trigger touch_loans before update on loans for each row execute function touch_updated_at();
alter table loans enable row level security;
create table loan_items (id uuid primary key default gen_random_uuid(), code text not null unique check (btrim(code)<>''), name text not null check (btrim(name)<>''), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), loan_id uuid not null references loans(id), object_id uuid not null references objects(id), export_decision text not null default 'unknown' check(export_decision in ('unknown','required','not_required')), reviewed_by text, permit_ref text, unique(loan_id,object_id));
create trigger touch_loan_items before update on loan_items for each row execute function touch_updated_at();
alter table loan_items enable row level security;
create table movements (id uuid primary key default gen_random_uuid(), code text not null unique check (btrim(code)<>''), name text not null check (btrim(name)<>''), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), object_id uuid not null references objects(id), from_location_id uuid references locations(id), to_location_id uuid not null references locations(id), moved_at timestamptz not null default now(), moved_by text not null check(btrim(moved_by)<>''), authorised_by text not null check(btrim(authorised_by)<>''), reason text not null check(btrim(reason)<>''), loan_id uuid references loans(id));
create trigger touch_movements before update on movements for each row execute function touch_updated_at();
alter table movements enable row level security;
create table exhibitions (id uuid primary key default gen_random_uuid(), code text not null unique check (btrim(code)<>''), name text not null check (btrim(name)<>''), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), starts_on date not null, ends_on date not null, location_id uuid not null references locations(id), check(ends_on>=starts_on));
create trigger touch_exhibitions before update on exhibitions for each row execute function touch_updated_at();
alter table exhibitions enable row level security;
create table exhibition_items (id uuid primary key default gen_random_uuid(), code text not null unique check (btrim(code)<>''), name text not null check (btrim(name)<>''), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), exhibition_id uuid not null references exhibitions(id), object_id uuid not null references objects(id), label_text text, unique(exhibition_id,object_id));
create trigger touch_exhibition_items before update on exhibition_items for each row execute function touch_updated_at();
alter table exhibition_items enable row level security;
create table notes (id uuid primary key default gen_random_uuid(), code text not null unique check (btrim(code)<>''), name text not null check (btrim(name)<>''), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), object_id uuid not null references objects(id), author text not null check(btrim(author)<>''), body text not null check(btrim(body)<>''));
create trigger touch_notes before update on notes for each row execute function touch_updated_at();
alter table notes enable row level security;

create function immutable_history() returns trigger language plpgsql as $$ begin raise exception 'History is append-only; add a correction note'; end $$;
create trigger immutable_movements before update or delete on movements for each row execute function immutable_history();
create trigger immutable_conditions before update or delete on conditions for each row execute function immutable_history();
create trigger immutable_notes before update or delete on notes for each row execute function immutable_history();
create index movements_object_time on movements(object_id,moved_at);
create index conditions_object_date on conditions(object_id,checked_on);
create index loan_items_object on loan_items(object_id);
create view v_catalogue as
select o.id,o.code,o.name,o.classification,o.maker,l.name as location,n.name as normal_location,o.inventory_checked_on,o.restricted,
 c.grade,c.checked_on as condition_checked,c.next_review,a.decision as accession_decision
from objects o left join locations l on l.id=o.current_location_id left join locations n on n.id=o.normal_location_id
left join accessions a on a.id=o.accession_id
left join lateral (select grade,checked_on,next_review from conditions where object_id=o.id order by checked_on desc,created_at desc,id limit 1) c on true;
create view v_loans as
select l.id,l.code,l.name,p.name as borrower,l.status,l.starts_on,l.due_on,l.destination_country,l.agreement_ref,l.insurance_until,count(li.id)::int as objects,
 (current_date-l.due_on) as days_overdue
from loans l join people p on p.id=l.borrower_id left join loan_items li on li.loan_id=l.id group by l.id,p.name;
create view v_attention as
select 'LOCATION' as rule,code,name,'Current or normal location missing' as issue from objects where current_location_id is null or normal_location_id is null
union all select 'INVENTORY',code,name,'Inventory check missing or older than 365 days (local policy)' from objects where inventory_checked_on is null or inventory_checked_on<current_date-365
union all select 'CONDITION',code,name,'Condition review absent, urgent or due' from v_catalogue where grade is null or grade in ('poor','urgent') or next_review<current_date
union all select 'LOAN',code,name,'Active loan overdue' from loans where status='active' and due_on<current_date
union all select 'TITLE',code,name,'Ownership evidence or accepted acquisition missing' from objects where accession_id is null or not exists(select 1 from accessions a where a.id=objects.accession_id and a.decision='accepted');
create view v_exhibition_readiness as
select e.code as exhibition,o.code,o.name,e.starts_on,c.grade,c.next_review,
 case when c.grade is null or c.grade in ('poor','urgent') or c.next_review<e.starts_on then 'Review condition' else 'Condition recorded' end as condition_review,
 case when exists(select 1 from loans l join loan_items li on li.loan_id=l.id where li.object_id=o.id and l.status<>'returned' and l.starts_on<=e.ends_on and l.due_on>=e.starts_on) then 'Loan overlaps exhibition' else 'No recorded loan overlap' end as availability
from exhibition_items ei join exhibitions e on e.id=ei.exhibition_id join objects o on o.id=ei.object_id join v_catalogue c on c.id=o.id;
