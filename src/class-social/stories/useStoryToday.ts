import { useEffect, useState } from 'react'
import { fetchStoryToday } from './storiesApi'
import type { StoryCardData } from './storyModel'

/** "Câu chuyện hôm nay" — tải một lần mỗi lượt vào Trang chủ. undefined = đang hỏi (Feed chờ trước khi khôi phục vị trí). */
export function useStoryToday(): StoryCardData | null | undefined {
  const [card, setCard] = useState<StoryCardData | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void fetchStoryToday().then(c => { if (alive) setCard(c) })
    return () => { alive = false }
  }, [])
  return card
}
