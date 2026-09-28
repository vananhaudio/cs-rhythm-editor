import { supabase } from '../supabase'
import ClassCurriculumAdminView from './ClassCurriculumAdminView'

export default function ClassCurriculumAdmin() {
  return <ClassCurriculumAdminView client={supabase} />
}
