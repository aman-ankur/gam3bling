alter table rooms
  add column if not exists invite_code text;

alter table rooms
  add constraint rooms_invite_code_format
  check (invite_code is null or invite_code ~ '^[A-Z0-9]{4,10}$');
