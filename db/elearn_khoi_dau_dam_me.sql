DO $$
DECLARE
  v_course_id uuid := 'fd23a7a2-bfce-44c6-8bde-6d76289a3625';
  v_mod1 uuid; v_mod2 uuid; v_mod3 uuid; v_mod4 uuid;
BEGIN
  DELETE FROM edu_course_lessons
    WHERE module_id IN (SELECT id FROM edu_modules WHERE course_id = v_course_id);
  DELETE FROM edu_modules WHERE course_id = v_course_id;

  INSERT INTO edu_modules (course_id, name, order_index)
    VALUES (v_course_id, 'Phần 1 — Chuẩn bị cây đàn', 0) RETURNING id INTO v_mod1;
  INSERT INTO edu_modules (course_id, name, order_index)
    VALUES (v_course_id, 'Phần 2 — Làm quen với đàn', 1) RETURNING id INTO v_mod2;
  INSERT INTO edu_modules (course_id, name, order_index)
    VALUES (v_course_id, 'Phần 3 — Chuẩn bị hai tay', 2) RETURNING id INTO v_mod3;
  INSERT INTO edu_modules (course_id, name, order_index)
    VALUES (v_course_id, 'Phần 4 — Sẵn sàng vào khoá chính', 3) RETURNING id INTO v_mod4;

  INSERT INTO edu_course_lessons
    (module_id, title, lesson_type, content_url, description, order_index, tools, content)
  VALUES
    (v_mod1,'Chọn cây đàn phù hợp','link','/lessons/khoi-dau-dam-me.html','Biết nên mua loại đàn nào',0,'[]','{"elearn":true,"num":1}'),
    (v_mod1,'Kiểm tra đàn trước khi học','link','/lessons/khoi-dau-dam-me.html','Biết đàn có học được không',1,'[]','{"elearn":true,"num":2}'),
    (v_mod1,'Các bộ phận của đàn','link','/lessons/khoi-dau-dam-me.html','Gọi đúng tên các phần đàn',2,'[]','{"elearn":true,"num":3}'),
    (v_mod2,'Tên 6 dây đàn','link','/lessons/khoi-dau-dam-me.html','Nhận diện đúng 6 dây',0,'[]','{"elearn":true,"num":4}'),
    (v_mod2,'Chỉnh dây bằng tuner','link','/lessons/khoi-dau-dam-me.html','Tự chỉnh được 6 dây',1,'[]','{"elearn":true,"num":5}'),
    (v_mod2,'Tư thế ngồi & đặt đàn','link','/lessons/khoi-dau-dam-me.html','Tư thế học ổn định',2,'[]','{"elearn":true,"num":6}'),
    (v_mod3,'Đặt tay trái lên cần đàn','link','/lessons/khoi-dau-dam-me.html','Tay trái đúng tư thế',0,'[]','{"elearn":true,"num":7}'),
    (v_mod3,'Gảy dây cho đàn kêu rõ','link','/lessons/khoi-dau-dam-me.html','Gảy 6 dây nghe rõ',1,'[]','{"elearn":true,"num":8}'),
    (v_mod3,'Cầm pick / dùng ngón phải','link','/lessons/khoi-dau-dam-me.html','Tay phải gảy gọn gàng',2,'[]','{"elearn":true,"num":9}'),
    (v_mod4,'Góc học & thói quen tập','link','/lessons/khoi-dau-dam-me.html','Có bộ chuẩn bị tối thiểu',0,'[]','{"elearn":true,"num":10}'),
    (v_mod4,'Đặt tinh thần cho khoá học','link','/lessons/khoi-dau-dam-me.html','Vào khoá với tâm thế đúng',1,'[]','{"elearn":true,"num":11}');
END $$;
