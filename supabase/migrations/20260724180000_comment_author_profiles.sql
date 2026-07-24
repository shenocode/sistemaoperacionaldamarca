-- Allow collaborators to see profile names (needed for comment authors).
-- Without this, nested profiles(...) on content_comments returns null for non-admins.

create policy "Members can view collaborator profiles"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1
      from public.client_members mine
      join public.client_members theirs on theirs.client_id = mine.client_id
      where mine.user_id = auth.uid()
        and theirs.user_id = id
    )
    or exists (
      select 1
      from public.content_comments cc
      where cc.user_id = id
        and public.can_access_content(cc.content_id)
    )
  );

-- Backfill missing display names from auth metadata / email local-part
update public.profiles p
set full_name = coalesce(
  nullif(trim(p.full_name), ''),
  nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
  nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
  nullif(split_part(u.email, '@', 1), '')
)
from auth.users u
where u.id = p.id
  and (p.full_name is null or trim(p.full_name) = '');
