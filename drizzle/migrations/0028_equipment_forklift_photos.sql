alter table public.equipment add column photo_path text;

alter table public.equipment add constraint equipment_photo_path_org check (photo_path is null or photo_path like organization_id::text || '/%');

create policy "Staff and operators view equipment photos" on storage.objects for select to authenticated
  using (bucket_id = 'equipment-photos' and (public.is_org_staff(((storage.foldername(name))[1])::uuid) or public.has_org_role(((storage.foldername(name))[1])::uuid, 'operator')));
create policy "Staff upload equipment photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'equipment-photos' and public.is_org_staff(((storage.foldername(name))[1])::uuid));
create policy "Staff replace equipment photos" on storage.objects for update to authenticated
  using (bucket_id = 'equipment-photos' and public.is_org_staff(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'equipment-photos' and public.is_org_staff(((storage.foldername(name))[1])::uuid));
create policy "Staff remove equipment photos" on storage.objects for delete to authenticated
  using (bucket_id = 'equipment-photos' and public.is_org_staff(((storage.foldername(name))[1])::uuid));