// Container của /band/<slug> (chunk lazy riêng): nạp CSS Social + Band rồi hiện trang tuyển.
import '../class-social/classSocial.css'
import './band.css'
import BandRecruitPage from './BandRecruitPage'

export default function BandRecruitRoute({ slug }: { slug: string }) {
  return <BandRecruitPage slug={slug} />
}
