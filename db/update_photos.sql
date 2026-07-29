-- PO1.1: Update story photos
UPDATE public.stories SET photos = '[{"url":"https://replicate.delivery/xezq/8jYFbFr9aPJ3LhKm2Pq4IiPIcimN6rP2WNLMQo7pJT4LJavF/tmp86wwfspe.webp","caption":""}]'::jsonb WHERE slug = 'cay-dan-go-cu-cua-ong-ngoai';
UPDATE public.stories SET photos = '[{"url":"https://replicate.delivery/xezq/H7que23d79S6H64enBf0etFw2pGsWrRGXXl7ekS836IYoEt3C/tmpahculm3v.webp","caption":""}]'::jsonb WHERE slug = '10-nam-toi-khong-dung-vao-cay-dan';
UPDATE public.stories SET photos = '[{"url":"https://replicate.delivery/xezq/38I3sl4D6dLGIF4yeEH4giWepKfCflkzwnmT30MtcalaVi2bB/tmp32jeywl2.webp","caption":""}]'::jsonb WHERE slug = 'toi-bat-dau-hoc-guitar-o-tuoi-42';
UPDATE public.stories SET photos = '[{"url":"https://replicate.delivery/xezq/omz0LfQ0uj1zC6DMi7KeKOrKovrfBASWmvWjQfncTygJWi2bB/tmpl291zcyv.webp","caption":""}]'::jsonb WHERE slug = 'moi-toi-toi-dan-cho-con-gai-nghe';
UPDATE public.stories SET photos = '[{"url":"https://replicate.delivery/xezq/yPw85RL8JZqYMBhtwz7f5gPNzN9vhszkVdDEYgSL0R03S0eWA/tmpuu9t_ohd.webp","caption":""}]'::jsonb WHERE slug = 'lan-dau-toi-dung-tren-san-khau';
UPDATE public.stories SET photos = '[{"url":"https://replicate.delivery/xezq/Se4Pt6tiVA2MbKYMiu8tgYvdLvxG5qE7JMskOOoHDSOflo9WA/tmpf1e0q57q.webp","caption":""}]'::jsonb WHERE slug = 'toi-khong-co-nang-khieu';
UPDATE public.stories SET photos = '[{"url":"https://replicate.delivery/xezq/njiEElZXmXpKCFDJlHcfSizSiJS44feTBzMdxVwfd9qvYi2bB/tmppv_b67zl.webp","caption":""}]'::jsonb WHERE slug = '15-phut-moi-ngay';
UPDATE public.stories SET photos = '[{"url":"https://replicate.delivery/xezq/wJGfcuD4FQwTUKve1h2JZHfmzcSskQGfhp32HgkCc7drZi2bB/tmpk2buw5mj.webp","caption":""}]'::jsonb WHERE slug = 'cay-dan-va-nguoi-ban-toi-da-mat';

SELECT slug, jsonb_array_length(photos) as img_count FROM public.stories WHERE status = 'published' ORDER BY published_at DESC;