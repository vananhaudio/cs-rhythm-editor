-- Cập nhật audio URL mới + timestamps chính xác cho Bài 2
-- Chạy trong Supabase SQL Editor

UPDATE flows
SET slides = (
  SELECT jsonb_agg(
    CASE
      WHEN slide->>'type' = 'narrated_slideshow'
      THEN slide
        || jsonb_build_object('interactive',
            (slide->'interactive')
            || jsonb_build_object(
                'audio_url', 'https://wojmdilyflffvdtpovmq.supabase.co/storage/v1/object/public/lessons/so%20do%20moi%20nhat%202.mp3',
                'end_times', '[12.9, 26.6, 41.8, 59.1, 74.0, 95.3, 115.7, 132.2, 150.8, 172.1, 193.9, 216.9]'::jsonb
               )
           )
      ELSE slide
    END
  )
  FROM jsonb_array_elements(slides) AS slide
)
WHERE lesson_id = (
  SELECT f.lesson_id FROM flows f
  JOIN edu_course_lessons l ON l.id = f.lesson_id
  WHERE l.title ILIKE 'Cách đọc sơ đồ%'
  LIMIT 1
);
