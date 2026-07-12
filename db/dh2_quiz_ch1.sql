-- ============================================================================
-- DH2 — Bài 1.11 Checkpoint Chương 1 (d2c00109) = QUIZ 6 câu (thầy duyệt 2026-07-12).
-- Schema JSON theo src/components/QuizViewer.tsx (multiple_choice: answer.correct
-- = chuỗi option; true_false: answer.correct = boolean). Đạt 70% là qua.
-- Idempotent.
-- ============================================================================

UPDATE edu_course_lessons
   SET lesson_type = 'quiz',
       content_url = NULL,
       description = NULL,
       content = '{
  "quiz_title": "Checkpoint Chương 1 — Chùm 2 & Ballad",
  "description": "Kiểm tra nhanh trước khi sang Chương 2. Đạt 70% là qua — sai câu nào, đọc phần giải thích để nắm lại.",
  "mode": "practice",
  "passing_score": 70,
  "questions": [
    {
      "id": "ch1-q1", "type": "multiple_choice", "skill": "chum-not", "difficulty": 1, "points": 1,
      "question": "Chùm 2 chia một phách thành gì?",
      "data": { "options": ["2 nốt móc đơn", "3 nốt bằng nhau", "4 nốt móc kép", "Không chia — vẫn là 1 nốt đen"] },
      "answer": { "correct": "2 nốt móc đơn" },
      "explanation": "Chùm 2 = chia đôi một phách thành 2 nốt móc đơn, đọc là \"1 – và\"."
    },
    {
      "id": "ch1-q2", "type": "true_false", "skill": "quat-chum2", "difficulty": 1, "points": 1,
      "question": "Chùm 2 BẮT BUỘC phải quạt xuống–lên.",
      "data": {},
      "answer": { "correct": false },
      "explanation": "Xuống–lên là cách thông thường và thuận tay nhất, nhưng không bắt buộc."
    },
    {
      "id": "ch1-q3", "type": "true_false", "skill": "chum-not", "difficulty": 2, "points": 1,
      "question": "Hai nốt trong chùm 2 giống hệt nhau cả về độ dài lẫn độ mạnh.",
      "data": {},
      "answer": { "correct": false },
      "explanation": "Chúng chỉ bằng nhau về THỜI GIAN. Về lực thì nốt rơi vào phách đánh MẠNH, nốt \"và\" đánh NHẸ — chính cái mạnh–nhẹ đó làm câu quạt có hồn."
    },
    {
      "id": "ch1-q4", "type": "multiple_choice", "skill": "doc-nhip", "difficulty": 1, "points": 1,
      "question": "Đọc miệng một ô nhịp 4/4 quạt chùm 2 là gì?",
      "data": { "options": ["1-và-2-và-3-và-4-và", "1-2-3-4", "1-2-3", "và-và-và-và"] },
      "answer": { "correct": "1-và-2-và-3-và-4-và" },
      "explanation": "Mỗi phách = \"số – và\": số là nhát xuống, \"và\" là nhát lên. Đủ 4 phách thành 1-và-2-và-3-và-4-và."
    },
    {
      "id": "ch1-q5", "type": "multiple_choice", "skill": "dieu-ballad", "difficulty": 1, "points": 1,
      "question": "Tính chất của điệu Ballad là gì?",
      "data": { "options": ["Êm ái, đều đặn, tình cảm", "Dồn dập, mạnh mẽ", "Nhún nhảy kiểu nhịp 3/4", "Chỉ dùng nốt đen"] },
      "answer": { "correct": "Êm ái, đều đặn, tình cảm" },
      "explanation": "Ballad là điệu 4/4 êm, đều, hợp các bài tâm tình — đúng cái bạn vừa quạt bằng chùm 2."
    },
    {
      "id": "ch1-q6", "type": "multiple_choice", "skill": "dieu-ballad", "difficulty": 2, "points": 1,
      "question": "Bài nào bạn vừa chơi đúng chất Ballad chùm 2 nhịp 4/4?",
      "data": { "options": ["Jingle Bells", "Happy Birthday", "Cả hai bài", "Không bài nào"] },
      "answer": { "correct": "Jingle Bells" },
      "explanation": "Happy Birthday là nhịp 3/4 — sang Chương 2 bạn sẽ gặp lại nó với đúng điệu của nhịp 3/4: Valse."
    }
  ]
}'
 WHERE id = 'd2c00109-0000-4000-8000-000000000000';

NOTIFY pgrst, 'reload schema';
