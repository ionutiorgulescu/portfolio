-- Public bucket for proxied/cached stock logo images (bytes, not third-party URLs).
-- The get-stock-logos edge function downloads logos from Finnhub/FMP once and
-- re-serves them from here, so clients never depend on third-party CDN reliability.
insert into storage.buckets (id, name, public)
values ('stock-logos', 'stock-logos', true)
on conflict (id) do nothing;

-- Public read access — logos are non-sensitive company assets.
create policy "Public read access for stock logos"
on storage.objects for select
to public
using (bucket_id = 'stock-logos');

-- No insert/update/delete policies: only the service role (edge function) writes,
-- and the service role bypasses RLS entirely.
