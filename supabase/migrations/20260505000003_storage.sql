-- venue-photos bucket: public read (planner OK with public photos), authed write.

insert into storage.buckets (id, name, public)
values ('venue-photos', 'venue-photos', true)
on conflict (id) do update set public = excluded.public;

create policy "venue-photos public read"
  on storage.objects for select
  using (bucket_id = 'venue-photos');

create policy "venue-photos authed insert"
  on storage.objects for insert
  with check (
    bucket_id = 'venue-photos'
    and auth.role() = 'authenticated'
  );

create policy "venue-photos owner update"
  on storage.objects for update
  using (
    bucket_id = 'venue-photos'
    and auth.uid() = owner
  );

create policy "venue-photos admin or owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'venue-photos'
    and (auth.uid() = owner or auth_is_admin())
  );
