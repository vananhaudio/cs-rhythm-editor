-- DELETE old + INSERT demo stories (base64 UTF-8 safe)
DELETE FROM public.stories WHERE slug IN (
  'cay-dan-dau-tien-van-con-o-goc-phong',
  'sau-muoi-nam-toi-lai-cam-dan',
  'bai-hat-dau-tien-danh-cho-con-gai',
  'toi-tung-nghi-minh-khong-co-nang-khieu',
  'moi-ngay-chi-15-phut',
  'buoi-bieu-dien-dau-tien-truoc-gia-dinh',
  'mot-chiec-capo-lam-toi-thay-doi',
  'dieu-toi-tiec-nhat-la-khong-hoc-som-hon'
);

DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM public.app_users WHERE role IN ('admin','teacher') LIMIT 1;
  IF v_user_id IS NULL THEN SELECT id INTO v_user_id FROM public.app_users LIMIT 1; END IF;

  INSERT INTO public.stories (user_id, status, title, slug, pen_name, location, content, photos, topic, published_at, created_at, updated_at, conversation)
  VALUES (v_user_id, 'published',
    convert_from(decode('Q8OieSDEkcOgbiDEkeG6p3UgdGnDqm4gY+G7p2EgdMO0aSB24bqrbiBjw7JuIOG7nyBnw7NjIHBow7JuZw==', 'base64'), 'UTF8'),
    'cay-dan-dau-tien-van-con-o-goc-phong', 'Minh', 'Hà Nội',
    convert_from(decode('Q8OzIGzhur0gYWkgY8WpbmcgY8OzIG3hu5l0IG3Ds24gxJHhu5MgY8WpIG3DoCBtw6xuaCBraMO0bmcgbuG7oSBi4buPLiBW4bubaSBtw6xuaCwgxJHDsyBsw6AgY8OieSBndWl0YXIgxJHDoyBoxqFuIG3GsOG7nWkgbsSDbSB0deG7lWkuCgpOZ8OgeSBt4bubaSBtdWEsIG3DrG5oIGjDoG8gaOG7qW5nIGzhuq9tLiBI4buNYyDEkcaw4bujYyB2w6BpIGjhu6NwIMOibSBsw6AgbmdoxKkgY2jhu4kgdsOgaSB0aMOhbmcgbuG7r2Egc+G6vSDEkcOgbiDEkcaw4bujYyB04bqldCBj4bqjIG5o4buvbmcgYsOgaSBtw6xuaCB0aMOtY2guIE5oxrBuZyBt4buNaSB0aOG7qSBraMO0bmcgZOG7hSBuaMawIHTGsOG7n25nIHTGsOG7o25nLiDEkOG6p3UgbmfDs24gdGF5IMSRYXUsIGLhuqVtIGjhu6NwIMOibSBj4bupIHLDqCwgxJHhu5VpIGjhu6NwIMOibSB0aMOsIGx1w7RuIGNo4bqtbSBoxqFuIG5o4buLcCBow6F0LiBDaOG7iSBzYXUgdsOgaSB0deG6p24sIGPDonkgxJHDoG4gxJHGsOG7o2MgxJHhurd0IHbDoG8gZ8OzYyBwaMOybmcuCgpDaG8gxJHhur9uIG3hu5l0IGJ14buVaSB04buRaSwgdMOsbmggY+G7nSB4ZW0gbeG7mXQgdmlkZW8gduG7gSBuaOG7r25nIG5nxrDhu51pIGLhuq90IMSR4bqndSBo4buNYyBndWl0YXIg4bufIHR14buVaSBuZ2/DoGkgYmEgbcawxqFpLiBNw6xuaCBjaOG7o3QgbmdoxKk6IG7hur91IGjhu40gY8OybiBi4bqvdCDEkeG6p3UgxJHGsOG7o2MsIHThuqFpIHNhbyBtw6xuaCBs4bqhaSBraMO0bmc/IE3DrG5oIGzhuqV5IMSRw6BuIHh14buRbmcsIGzDqm4gZMOieSBs4bqhaSB2w6AgYuG6r3QgxJHhuqd1IHThu6sgbmjhu69uZyDEkWnhu4F1IHLhuqV0IG5o4buPLgoKSMO0bSBuYXkgbcOsbmggduG6q24gY2jGsGEgY2jGoWkgZ2nhu49pLiBOaMawbmcgY8OieSDEkcOgbiDhuqV5IGtow7RuZyBjw7JuIGzDoCBtw7NuIMSR4buTIHBo4bunIGLhu6VpIG7hu69hLiBOw7MgdHLhu58gdGjDoG5oIGzhu51pIG5o4bqvYyBy4bqxbmc6IMSRw7RpIGtoaSDEkWnhu4F1IGtow7MgbmjhuqV0IGtow7RuZyBwaOG6o2kgaOG7jWMsIG3DoCBsw6AgYuG6r3QgxJHhuqd1IGzhuqFpLg==', 'base64'), 'UTF8'),
    '[{"url":"https://replicate.delivery/xezq/8jYFbFr9aPJ3LhKm2Pq4IiPIcimN6rP2WNLMQo7pJT4LJavF/tmp86wwfspe.webp","caption":""}]'::jsonb, 'cay-dan-dau-tien',
    '2026-06-15 08:00:00+07'::timestamptz, '2026-06-15 08:00:00+07'::timestamptz, '2026-06-15 08:00:00+07'::timestamptz, '[]'::jsonb);

  INSERT INTO public.stories (user_id, status, title, slug, pen_name, location, content, photos, topic, published_at, created_at, updated_at, conversation)
  VALUES (v_user_id, 'published',
    convert_from(decode('U2F1IG3GsOG7nWkgbsSDbSwgdMO0aSBs4bqhaSBj4bqnbSDEkcOgbg==', 'base64'), 'UTF8'),
    'sau-muoi-nam-toi-lai-cam-dan', 'Tuấn', 'Đà Nẵng',
    convert_from(decode('SOG7k2kgxJHhuqFpIGjhu41jIG3DrG5oIHThu6tuZyBjaMahaSBndWl0YXIgZ+G6p24gbmjGsCBt4buXaSBuZ8OgeS4gUmEgdHLGsOG7nW5nLCBjw7RuZyB2aeG7h2MsIGdpYSDEkcOsbmggcuG7k2kgY29uIGPDoWkga2hp4bq/biBjw6J5IMSRw6BuIGThuqduIGJp4bq/biBt4bqldCBraOG7j2kgY3Xhu5ljIHPhu5FuZy4gTcaw4budaSBuxINtIHRyw7RpIHF1YSBuaGFuaCDEkeG6v24gbeG7qWMgY8OzIGzDumMgbcOsbmggbmdoxKkgbcOsbmggc+G6vSBjaOG6s25nIGJhbyBnaeG7nSBjaMahaSBs4bqhaSBu4buvYS4KCk3hu5l0IGjDtG0sIGNvbiB0cmFpIGjhu49pOiAiQuG7kSBiaeG6v3QgY2jGoWkgxJHDoG4ga2jDtG5nPyIgTcOsbmggdHLhuqMgbOG7nWk6ICJOZ8OgeSB4xrBhIGLhu5EgYmnhur90LiIgQ2jDrW5oIGPDonUgdHLhuqMgbOG7nWkgxJHDsyBsw6BtIG3DrG5oIHRo4bqleSB0aeG6v2MuCgpU4buRaSBow7RtIOG6pXkgbcOsbmggbOG6pXkgxJHDoG4geHXhu5FuZy4gTmjhu69uZyBuZ8OzbiB0YXkgY+G7qW5nIGzhuqFpLiBI4bujcCDDom0gY8WpbmcgcXXDqm4gZ+G6p24gaOG6v3QuIE5oxrBuZyBj4bqjbSBnacOhYyBraGkgdGnhur9uZyDEkcOgbiB2YW5nIGzDqm4gduG6q24gZ2nhu5FuZyBo4buHdCBuZ8OgeSB4xrBhLiBDw7MgbOG6vSBjw7Mgbmjhu69uZyDEkWFtIG3DqiBjaOG7iSBuZ+G7pyBxdcOqbiwgY2jhu6kgY2jGsGEgYmFvIGdp4budIGJp4bq/biBt4bqldC4=', 'base64'), 'UTF8'),
    '[{"url":"https://replicate.delivery/xezq/H7que23d79S6H64enBf0etFw2pGsWrRGXXl7ekS836IYoEt3C/tmpahculm3v.webp","caption":""}]'::jsonb, 'bo-do-roi-quay-lai',
    '2026-06-22 14:30:00+07'::timestamptz, '2026-06-22 14:30:00+07'::timestamptz, '2026-06-22 14:30:00+07'::timestamptz, '[]'::jsonb);

  INSERT INTO public.stories (user_id, status, title, slug, pen_name, location, content, photos, topic, published_at, created_at, updated_at, conversation)
  VALUES (v_user_id, 'published',
    convert_from(decode('QsOgaSBow6F0IMSR4bqndSB0acOqbiBkw6BuaCBjaG8gY29uIGfDoWk=', 'base64'), 'UTF8'),
    'bai-hat-dau-tien-danh-cho-con-gai', 'Hương', 'TP.HCM',
    convert_from(decode('Q29uIGfDoWkgbcOsbmggbeG7m2kgYuG7kW4gdHXhu5VpLiBN4buZdCB04buRaSB0csaw4bubYyBnaeG7nSDEkWkgbmfhu6csIG3DrG5oIHRo4butIMSRw6BuIGLDoGkgIkJhIG5n4buNbiBu4bq/biBsdW5nIGxpbmgiLiBDb24ga2jDtG5nIGjDoXQgdGhlby4gQ29uIGNo4buJIG5n4buTaSDDtG0gZ+G7kWkgdsOgIG5ow6xuIG3DrG5oLiDEkOG6v24gY3Xhu5FpIGLDoGksIGNvbiBuw7NpOiAiTeG6uSDEkcOgbiBu4buvYSDEkWkuIgoKS2hv4bqjbmgga2jhuq9jIOG6pXkgcuG6pXQgYsOsbmggdGjGsOG7nW5nLiBOaMawbmcgduG7m2kgbcOsbmgsIG7DsyBxdcO9IGjGoW4gcuG6pXQgbmhp4buBdSBs4bqnbiB2aeG7h2MgxJHDoG4gxJHDum5nIGhheSBzYWkuIE3DrG5oIGjhu41jIGd1aXRhciBraMO0bmcgcGjhuqNpIMSR4buDIGJp4buDdSBkaeG7hW4uIE3DrG5oIGjhu41jIHbDrCBtdeG7kW4gZ2nhu68gbOG6oWkgbmjhu69uZyBraG/huqNuaCBraOG6r2MgbmjGsCB0aOG6vyB0cm9uZyBnaWEgxJHDrG5oLg==', 'base64'), 'UTF8'),
    '[{"url":"https://replicate.delivery/xezq/38I3sl4D6dLGIF4yeEH4giWepKfCflkzwnmT30MtcalaVi2bB/tmp32jeywl2.webp","caption":""}]'::jsonb, 'guitar-trong-gia-dinh',
    '2026-07-01 10:00:00+07'::timestamptz, '2026-07-01 10:00:00+07'::timestamptz, '2026-07-01 10:00:00+07'::timestamptz, '[]'::jsonb);

  INSERT INTO public.stories (user_id, status, title, slug, pen_name, location, content, photos, topic, published_at, created_at, updated_at, conversation)
  VALUES (v_user_id, 'published',
    convert_from(decode('VMO0aSB04burbmcgbmdoxKkgbcOsbmgga2jDtG5nIGPDsyBuxINuZyBraGnhur91', 'base64'), 'UTF8'),
    'toi-tung-nghi-minh-khong-co-nang-khieu', 'Phúc', 'Bình Dương',
    convert_from(decode('TeG7l2kgbOG6p24gbmjDrG4gbmfGsOG7nWkga2jDoWMgxJHDoG4sIG3DrG5oIGx1w7RuIG5naMSpOiAiSOG7jSBjw7MgbsSDbmcga2hp4bq/dS4iIEPDsm4gbcOsbmggdGjDrCBraMO0bmcuIFRo4bq/IG7Dqm4gbcOsbmggaOG7jWMgcuG6pXQgY2jhuq1tLiBTYWkgcuG6pXQgbmhp4buBdS4gxJDhu5VpIGjhu6NwIMOibSBsw7pjIG7DoG8gY8WpbmcgbXXhu5luLgoKTmjGsG5nIHLhu5NpIG3DrG5oIG5o4bqtbiByYSDEkWnhu4F1IHRow7ogduG7iy4gTmjhu69uZyBuZ8aw4budaSBtw6xuaCBuZ8aw4buhbmcgbeG7mSBjxaluZyB04burbmcgYuG6r3QgxJHhuqd1IGLhurFuZyBuaOG7r25nIHRp4bq/bmcgxJHDoG4gcsOoLiBI4buNIGNo4buJIGtow7RuZyBi4buPIGN14buZYy4gTcOsbmggY8WpbmcgcXV54bq/dCDEkeG7i25oIG5oxrAgduG6rXkuIELDonkgZ2nhu50gbcOsbmggduG6q24gY8OybiBwaOG6o2kgaOG7jWMgcuG6pXQgbmhp4buBdS4gTmjGsG5nIMOtdCBuaOG6pXQgbcOsbmgga2jDtG5nIGPDsm4gdOG7sSBuw7NpIHLhurFuZyBtw6xuaCBraMO0bmcgY8OzIG7Eg25nIGtoaeG6v3UgbuG7r2Eu', 'base64'), 'UTF8'),
    '[{"url":"https://replicate.delivery/xezq/Se4Pt6tiVA2MbKYMiu8tgYvdLvxG5qE7JMskOOoHDSOflo9WA/tmpf1e0q57q.webp","caption":""}]'::jsonb, 'vuot-qua-kho-khan',
    '2026-07-08 20:00:00+07'::timestamptz, '2026-07-08 20:00:00+07'::timestamptz, '2026-07-08 20:00:00+07'::timestamptz, '[]'::jsonb);

  INSERT INTO public.stories (user_id, status, title, slug, pen_name, location, content, photos, topic, published_at, created_at, updated_at, conversation)
  VALUES (v_user_id, 'published',
    convert_from(decode('TeG7l2kgbmfDoHkgY2jhu4kgMTUgcGjDunQ=', 'base64'), 'UTF8'),
    'moi-ngay-chi-15-phut', 'Hoàng', 'Hà Nội',
    convert_from(decode('TcOsbmggxJFpIGzDoG0gdOG7qyBzw6FuZyDEkeG6v24gdOG7kWkuIEtow7RuZyBjw7Mgbmhp4buBdSB0aOG7nWkgZ2lhbi4gTMO6YyDEkeG6p3UgbcOsbmggY+G7qSBjaOG7nSDEkeG6v24gY3Xhu5FpIHR14bqnbiBt4bubaSB04bqtcC4gS+G6v3QgcXXhuqMgbMOgIGN14buRaSB0deG6p24gbsOgbyBjxaluZyBi4bqtbi4KClNhdSDEkcOzIG3DrG5oIMSR4buVaSBjw6FjaC4gQ2jhu4kgY+G6p24gMTUgcGjDunQgbeG7l2kgdOG7kWkuIEtow7RuZyBuaGnhu4F1IGjGoW4uIEPDsyBow7RtIGNo4buJIGvhu4twIMSRw6BuIMSRw7puZyBt4buZdCBiw6BpLiBOaMawbmcgbcOsbmggduG6q24gZ2nhu68gxJHhu4F1LiBTYXUgdsOgaSB0aMOhbmcgbmjDrG4gbOG6oWksIG3DrG5oIG5n4bqhYyBuaGnDqm4gdsOsIG3DrG5oIHRp4bq/biBi4buZIG5oaeG7gXUgaMahbiB0xrDhu59uZyB0xrDhu6NuZy4gQ8OzIGzhur0gxJFp4buBdSBxdWFuIHRy4buNbmcgbmjhuqV0IGtow7RuZyBwaOG6o2kgdOG6rXAgdGjhuq10IGzDonUuIE3DoCBsw6AgxJHhu6tuZyDEkeG7gyBjw6J5IMSRw6BuIHF1w6EgbMOidSBraMO0bmcgxJHGsOG7o2MgY+G6p20gbMOqbi4=', 'base64'), 'UTF8'),
    '[{"url":"https://replicate.delivery/xezq/njiEElZXmXpKCFDJlHcfSizSiJS44feTBzMdxVwfd9qvYi2bB/tmppv_b67zl.webp","caption":""}]'::jsonb, 'vuot-qua-kho-khan',
    '2026-07-12 16:00:00+07'::timestamptz, '2026-07-12 16:00:00+07'::timestamptz, '2026-07-12 16:00:00+07'::timestamptz, '[]'::jsonb);

  INSERT INTO public.stories (user_id, status, title, slug, pen_name, location, content, photos, topic, published_at, created_at, updated_at, conversation)
  VALUES (v_user_id, 'published',
    convert_from(decode('QnXhu5VpIGJp4buDdSBkaeG7hW4gxJHhuqd1IHRpw6puIHRyxrDhu5tjIGdpYSDEkcOsbmg=', 'base64'), 'UTF8'),
    'buoi-bieu-dien-dau-tien-truoc-gia-dinh', 'Mai', 'Huế',
    convert_from(decode('TcOsbmggY2jGsGEgdOG7q25nIMSR4bupbmcgdHLDqm4gc8OibiBraOG6pXUuIEtow6FuIGdp4bqjIMSR4bqndSB0acOqbiBj4bunYSBtw6xuaCBjaOG7iSBjw7MgYuG7kSBt4bq5IHbDoCBlbSBnw6FpLiBU4buRaSBow7RtIMSRw7MgbcOsbmggcnVuIMSR4bq/biBt4bupYyBxdcOqbiBj4bqjIGzhu51pLiDEkMOhbmggc2FpIHbDoGkgY2jhu5cuIEThu6tuZyBs4bqhaSBt4buZdCBuaOG7i3AuIE5oxrBuZyBraGkgYsOgaSBow6F0IGvhur90IHRow7pjLCBj4bqjIG5ow6AgduG6q24gduG7lyB0YXkuIEtow7RuZyBhaSBjaMOqIG3DrG5oLiBLaMO0bmcgYWkgY8aw4budaS4KCsSQw7MgbMOgIGzhuqduIMSR4bqndSB0acOqbiBtw6xuaCBoaeG7g3UgcuG6sW5nIMOibSBuaOG6oWMga2jDtG5nIHBo4bqjaSBsw6AgY3Xhu5ljIHRoaS4gw4JtIG5o4bqhYyBsw6AgxJHhu4MgY2hpYSBz4bq7Lg==', 'base64'), 'UTF8'),
    '[{"url":"https://replicate.delivery/xezq/yPw85RL8JZqYMBhtwz7f5gPNzN9vhszkVdDEYgSL0R03S0eWA/tmpuu9t_ohd.webp","caption":""}]'::jsonb, 'lan-dau-dan-truoc-moi-nguoi',
    '2026-07-18 09:00:00+07'::timestamptz, '2026-07-18 09:00:00+07'::timestamptz, '2026-07-18 09:00:00+07'::timestamptz, '[]'::jsonb);

  INSERT INTO public.stories (user_id, status, title, slug, pen_name, location, content, photos, topic, published_at, created_at, updated_at, conversation)
  VALUES (v_user_id, 'published',
    convert_from(decode('TeG7mXQgY2hp4bq/YyBjYXBvIGzDoG0gdMO0aSB0aGF5IMSR4buVaSBjw6FjaCBuaMOsbiB24buBIGd1aXRhcg==', 'base64'), 'UTF8'),
    'mot-chiec-capo-lam-toi-thay-doi', 'Khánh', 'Cần Thơ',
    convert_from(decode('TmfDoHkgdHLGsOG7m2MgbcOsbmggcuG6pXQgc+G7oyBo4bujcCDDom0gRmEuIEPhu6kgbmdoxKkgbuG6v3UgY2jGsGEgYuG6pW0gxJHGsOG7o2MgRmEgdGjDrCBjaMawYSB0aOG7gyBow6F0LiBDaG8gxJHhur9uIGtoaSBt4buZdCBuZ8aw4budaSBi4bqhbiDEkcawYSBjaG8gbcOsbmggY2hp4bq/YyBjYXBvIHbDoCBuw7NpOiAiVGjhu60gxJHhu5VpIHTDtG5nIHhlbS4iCgpM4bqnbiDEkeG6p3UgdGnDqm4gbcOsbmggbmjhuq1uIHJhIGd1aXRhciBraMO0bmcgY2jhu4kgbMOgIHPhu6ljIG3huqFuaCBj4bunYSBiw6BuIHRheS4gTsOzIGPDsm4gbMOgIGPDoWNoIG3DrG5oIGhp4buDdSBuaOG6oWMuIFThu6sgxJHDsyBtw6xuaCBi4bubdCBj4buRIGNo4bqlcCBoxqFuLiBCaeG6v3QgdMOsbSBjw6FjaCBwaMO5IGjhu6NwIHbhu5tpIGdp4buNbmcgaMOhdCBj4bunYSBtw6xuaC4gVsOgIHZp4buHYyBjaMahaSDEkcOgbiBjxaluZyB0cuG7nyBuw6puIHZ1aSBoxqFuIHLhuqV0IG5oaeG7gXUu', 'base64'), 'UTF8'),
    '[{"url":"https://replicate.delivery/xezq/wJGfcuD4FQwTUKve1h2JZHfmzcSskQGfhp32HgkCc7drZi2bB/tmpk2buw5mj.webp","caption":""}]'::jsonb, 'vuot-qua-kho-khan',
    '2026-07-22 18:30:00+07'::timestamptz, '2026-07-22 18:30:00+07'::timestamptz, '2026-07-22 18:30:00+07'::timestamptz, '[]'::jsonb);

  INSERT INTO public.stories (user_id, status, title, slug, pen_name, location, content, photos, topic, published_at, created_at, updated_at, conversation)
  VALUES (v_user_id, 'published',
    convert_from(decode('xJBp4buBdSB0w7RpIHRp4bq/YyBuaOG6pXQgbMOgIGtow7RuZyBo4buNYyBz4bubbSBoxqFu', 'base64'), 'UTF8'),
    'dieu-toi-tiec-nhat-la-khong-hoc-som-hon', 'Lan', 'Nha Trang',
    convert_from(decode('TcOsbmggbHXDtG4gbmdoxKkgZ3VpdGFyIGzDoCBkw6BuaCBjaG8gY8OhYyBi4bqhbiB0cuG6uy4gxJDhur9uIG7Eg20gYmEgbcawxqFpIGhhaSB0deG7lWkgbeG7m2kgcXV54bq/dCDEkeG7i25oIMSRxINuZyBrw70gaOG7jWMuIEJ14buVaSBo4buNYyDEkeG6p3UgdGnDqm4gbcOsbmgga2jDoSBuZ+G6oWkuIFRyb25nIMSR4bqndSBjaOG7iSBjw7MgbeG7mXQgY8OidSBo4buPaTogIkxp4buHdSBjw7MgbXXhu5luIHF1w6Ega2jDtG5nPyIKCkLDonkgZ2nhu50gc2F1IGfhuqduIG3hu5l0IG7Eg20sIG3DrG5oIG3hu5tpIGhp4buDdS4gxJBp4buBdSBtw6xuaCB0aeG6v2Mga2jDtG5nIHBo4bqjaSBsw6AgYuG6r3QgxJHhuqd1IOG7nyB0deG7lWkgYmEgbcawxqFpIGhhaS4gTcOgIGzDoCDEkcOjIGTDoG5oIHF1w6Egbmhp4buBdSBuxINtIMSR4buDIG5naMSpIHLhurFuZyBtw6xuaCBraMO0bmcgdGjhu4MuIE7hur91IGPDsyBhaSBo4buPaSBtw6xuaCBs4budaSBraHV5w6puIGTDoG5oIGNobyBuZ8aw4budaSBt4bubaSwgbcOsbmggc+G6vSBjaOG7iSBuw7NpIG3hu5l0IGPDonU6IMSQ4burbmcgY2jhu50gxJHhur9uIGtoaSB04buxIHRpbiBy4buTaSBt4bubaSBi4bqvdCDEkeG6p3UuIEjDo3kgYuG6r3QgxJHhuqd1IMSR4buDIGThuqduIGPDsyDEkcaw4bujYyBz4buxIHThu7EgdGluLg==', 'base64'), 'UTF8'),
    '[{"url":"https://replicate.delivery/xezq/omz0LfQ0uj1zC6DMi7KeKOrKovrfBASWmvWjQfncTygJWi2bB/tmpl291zcyv.webp","caption":""}]'::jsonb, 'vuot-qua-kho-khan',
    '2026-07-26 07:00:00+07'::timestamptz, '2026-07-26 07:00:00+07'::timestamptz, '2026-07-26 07:00:00+07'::timestamptz, '[]'::jsonb);

END $$;

SELECT slug, title, length(content) as chars FROM public.stories WHERE status = 'published' ORDER BY published_at DESC;