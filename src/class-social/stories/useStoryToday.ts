import { useEffect, useState } from 'react'
import { fetchStoryToday } from './storiesApi'
import type { StoryCardData } from './storyModel'

/** "Câu chuyện hôm nay" — tải một lần mỗi lượt vào Trang chủ. */
export function useStoryToday(): StoryCardData | null {
  const [card, setCard] = useState<StoryCardData | null>(null)
  useEffect(() => {
    let alive = true
    void fetchStoryToday().then(c => { if (alive) setCard(c) })
    return () => { alive = false }
  }, [])
  return card
}
