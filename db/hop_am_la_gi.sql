-- Tạo Bài 1 "Hợp âm là gì?" cho khoá "Khởi đầu đam mê – Đệm hát cơ bản", Chương 1: Hợp âm (engine Flow).
-- Idempotent: chạy lại sẽ cập nhật, không tạo trùng.
-- HTML trong content dùng dấu nháy ĐƠN cho thuộc tính (style='...') để JSON sạch, không phải escape.
DO $$
DECLARE
  v_course uuid;
  v_mod    uuid;
  v_lesson uuid;
BEGIN
  SELECT id INTO v_course FROM edu_courses WHERE name ILIKE '%Đệm hát cơ bản%' LIMIT 1;
  IF v_course IS NULL THEN RAISE EXCEPTION 'Không tìm thấy khoá "Đệm hát cơ bản"'; END IF;

  -- Chương 1: Hợp âm (đã có sẵn trong khoá)
  SELECT id INTO v_mod FROM edu_modules WHERE course_id = v_course AND name ILIKE 'Chương 1%' LIMIT 1;
  IF v_mod IS NULL THEN
    INSERT INTO edu_modules (course_id, name, order_index)
      VALUES (v_course, 'Chương 1: Hợp âm', 0) RETURNING id INTO v_mod;
  END IF;

  -- Bài 1 (tạo hoặc cập nhật theo tiêu đề)
  SELECT id INTO v_lesson FROM edu_course_lessons WHERE module_id = v_mod AND title ILIKE 'Hợp âm là gì%' LIMIT 1;
  IF v_lesson IS NULL THEN
    INSERT INTO edu_course_lessons (module_id, title, lesson_type, order_index, tools)
      VALUES (v_mod, 'Hợp âm là gì?', 'flow', 0, '[]') RETURNING id INTO v_lesson;
  ELSE
    UPDATE edu_course_lessons SET lesson_type = 'flow' WHERE id = v_lesson;
  END IF;

  -- Flow (upsert theo lesson_id)
  DELETE FROM flows WHERE lesson_id = v_lesson;
  INSERT INTO flows (lesson_id, title, reward_xp, status, slides) VALUES (
    v_lesson, 'Hợp âm là gì?', 10, 'published',
    $json$[
      {"id":"h1","order":1,"logic":"NHAN","type":"text","title":"Mục tiêu","content":"<div style='display:flex; gap:13px; align-items:flex-start; background:#FBF6ED; border:1px solid #E6D8C2; border-left:4px solid #BF5A37; border-radius:6px; padding:18px;'><div style='flex:none; width:34px; height:34px; border-radius:50%; background:#F3E0D2; display:flex; align-items:center; justify-content:center; font-style:italic; font-weight:700; font-size:19px; color:#BF5A37;'>i</div><div><div style='font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#BF5A37; margin-bottom:6px;'>Mục tiêu</div><div style='font-size:17px; line-height:1.5; color:#2A2622;'>Sau bài này, bạn chỉ cần hiểu một điều: <b>hợp âm là nhiều nốt vang lên cùng lúc.</b></div></div></div>"},
      {"id":"h2","order":2,"logic":"NHAN","type":"text","title":"Mở đầu","content":"<p style='font-size:16px; line-height:1.75; margin:0 0 14px; color:#3A352F;'>Khi ta gảy <i>một</i> dây đàn, ta nghe một âm thanh — một <b>nốt</b>. Mỏng, đơn lẻ, như tiếng <span style='font-style:italic; color:#BF5A37;'>ting…</span></p><p style='font-size:16px; line-height:1.75; margin:0; color:#3A352F;'>Nhưng khi gảy <i>nhiều</i> dây cùng lúc, âm thanh dày hơn, đầy hơn — tiếng <span style='font-style:italic; color:#BF5A37;'>reng…</span> Đó chính là <b>hợp âm</b>.</p>"},
      {"id":"h3","order":3,"logic":"NHAN","type":"text","title":"Giải thích thật dễ","content":"<p style='font-size:16px; line-height:1.7; margin:0 0 16px; color:#3A352F;'>Cách dễ nhất là nghĩ về tiếng hát:</p><div style='display:grid; grid-template-columns:1fr 1fr; gap:12px;'><div style='background:#FBF6ED; border:1px solid #E6D8C2; border-radius:8px; padding:16px;'><div style='display:flex; gap:5px; align-items:flex-end; height:30px; margin-bottom:12px;'><span style='width:4px; height:26px; background:#C9BBA4; border-radius:2px;'></span></div><div style='font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#9A8F7E; margin-bottom:5px;'>Một nốt</div><div style='font-size:14px; line-height:1.5; color:#3A352F;'><b>Một người</b> hát một mình. Nghe mỏng.</div></div><div style='background:#F6E7D8; border:1px solid #E2C3A6; border-radius:8px; padding:16px;'><div style='display:flex; gap:4px; align-items:flex-end; height:30px; margin-bottom:12px;'><span style='width:4px;height:16px;background:#BF5A37;border-radius:2px;'></span><span style='width:4px;height:26px;background:#BF5A37;border-radius:2px;'></span><span style='width:4px;height:21px;background:#BF5A37;border-radius:2px;'></span><span style='width:4px;height:30px;background:#BF5A37;border-radius:2px;'></span></div><div style='font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#BF5A37; margin-bottom:5px;'>Một hợp âm</div><div style='font-size:14px; line-height:1.5; color:#3A352F;'><b>Nhiều người</b> hát cùng lúc. Nghe đầy hơn.</div></div></div>"},
      {"id":"h4","order":4,"logic":"NHAN","type":"guitar_chord","title":"Hợp âm trên guitar","interactive":{"name":"Em","caption":"Trên guitar, tay trái bấm cần đàn, tay phải gảy nhiều dây → nhiều nốt vang cùng lúc = một hợp âm. Đây là thế bấm <b>Em</b>. Bấm <b>Nghe</b> rồi gảy thử trên đàn của bạn."}},
      {"id":"h5","order":5,"logic":"NHAN","type":"text","title":"Hợp âm dùng để làm gì?","content":"<p style='font-size:16px; line-height:1.7; margin:0 0 16px; color:#3A352F;'>Hợp âm dùng để <b>đệm hát</b>. Người hát giữ giai điệu, guitar đánh hợp âm phía sau làm nền.</p><div style='display:flex; border:1px solid #E6D8C2; border-radius:8px; overflow:hidden;'><div style='flex:1; padding:16px 18px; background:#FBF6ED;'><div style='font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#9A8F7E; margin-bottom:4px;'>Giai điệu</div><div style='font-size:14px; color:#3A352F;'>Phần ta hát</div></div><div style='width:1px; background:#E6D8C2;'></div><div style='flex:1; padding:16px 18px; background:#F6E7D8;'><div style='font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#BF5A37; margin-bottom:4px;'>Hợp âm</div><div style='font-size:14px; color:#3A352F;'>Guitar đệm phía sau</div></div></div>"},
      {"id":"h6","order":6,"logic":"NGAM","type":"checklist","title":"Bài tập nhỏ — tự kiểm","interactive":{"items":["Mình đã gảy 1 dây — nghe tiếng mỏng (ting)","Mình đã bấm Em rồi gảy nhiều dây — nghe tiếng đầy (reng)","Mình nghe được sự khác nhau giữa một nốt và một hợp âm"]}},
      {"id":"h7","order":7,"logic":"DAN","type":"text","title":"Câu chốt","content":"<div style='background:#2A2622; border-radius:10px; padding:24px 22px; color:#F4ECDF;'><div style='font-size:11px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:#D89B72; margin-bottom:12px;'>Câu chốt</div><div style='font-size:19px; line-height:1.45; margin-bottom:18px; color:#FBF6ED;'>Hợp âm là nhiều nốt vang lên cùng lúc. Trên guitar, đó là một thế bấm giúp tạo âm thanh đầy hơn để đệm hát.</div><div style='height:1px; background:rgba(244,236,223,0.18); margin-bottom:16px;'></div><div style='font-size:13px; color:#C9BBA4; margin-bottom:10px;'>Mục tiêu đầu tiên khi học hợp âm:</div><div style='display:flex; gap:8px; flex-wrap:wrap;'><span style='font-size:13px; font-weight:700; color:#2A2622; background:#D89B72; border-radius:16px; padding:5px 14px;'>Bấm đúng</span><span style='font-size:13px; font-weight:700; color:#2A2622; background:#D89B72; border-radius:16px; padding:5px 14px;'>Gảy rõ</span><span style='font-size:13px; font-weight:700; color:#F4ECDF; background:rgba(244,236,223,0.12); border-radius:16px; padding:5px 14px;'>Không rè</span><span style='font-size:13px; font-weight:700; color:#F4ECDF; background:rgba(244,236,223,0.12); border-radius:16px; padding:5px 14px;'>Không tịt</span></div></div>"}
    ]$json$::jsonb
  );

  RAISE NOTICE 'Đã tạo/cập nhật Bài "Hợp âm là gì?" (lesson %) trong chương %', v_lesson, v_mod;
END $$;
