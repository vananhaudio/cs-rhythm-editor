import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wojmdilyflffvdtpovmq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvam1kaWx5ZmxmZnZkdHBvdm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjk0OTYsImV4cCI6MjA5NDg0NTQ5Nn0.JxlY5iqBTK3q5BYnF1MgY8A5zS3R5okrD8uddsEFavY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
