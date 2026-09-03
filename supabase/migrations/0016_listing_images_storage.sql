-- Phase 2: Storage bucket + policies for listing images (section 13, 46).
--
-- NOTE: this migration touches the `storage` schema, which only exists on a
-- real Supabase project (Storage is a managed service, not plain Postgres).
-- It cannot be exercised against the local-Postgres test harness used for
-- every other migration in this repo (supabase/seed/000-001) — run it only
-- against a real Supabase project, where `storage.objects` already has RLS
-- enabled by the platform.
--
-- Path convention: objects are stored as `{listing_id}/{uuid}-{filename}`, so
-- storage.foldername(name)[1] recovers the listing_id to re-check the same
-- ownership/permission rule used by the listing_images table RLS (0013).
-- The bucket is public (readable by anyone with the exact path) because
-- approved/available listings' photos are meant to be publicly visible on
-- the marketplace (Phase 4); nothing links to a draft listing's images from
-- any public page, and paths are unguessable UUIDs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy listing_images_storage_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and exists (
      select 1 from listings l
      where l.id::text = (storage.foldername(name))[1]
        and has_permission(auth.uid(), 'listing.manage_images', l.organization_id)
        and (
          l.created_by = auth.uid()
          or l.assigned_agent_id = auth.uid()
          or has_permission(auth.uid(), 'listing.update_organization', l.organization_id)
          or has_permission(auth.uid(), 'listing.update_all', l.organization_id)
        )
    )
  );

create policy listing_images_storage_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and exists (
      select 1 from listings l
      where l.id::text = (storage.foldername(name))[1]
        and has_permission(auth.uid(), 'listing.manage_images', l.organization_id)
        and (
          l.created_by = auth.uid()
          or l.assigned_agent_id = auth.uid()
          or has_permission(auth.uid(), 'listing.update_organization', l.organization_id)
          or has_permission(auth.uid(), 'listing.update_all', l.organization_id)
        )
    )
  );

create policy listing_images_storage_select on storage.objects
  for select
  to public
  using (bucket_id = 'listing-images');
