// In các khối giáo trình MẪU (nguồn trong repo) ra JSON để test SQL helper — cùng hình dạng với class_lesson_content.blocks.
import { SOLO01_BUOI01 } from '../../src/data/solo01/buoi01'
import { SOLO01_BUOI04 } from '../../src/data/solo01/buoi04'
const out = { 1: { title: SOLO01_BUOI01.title, blocks: SOLO01_BUOI01.sections }, 4: { title: SOLO01_BUOI04.title, blocks: SOLO01_BUOI04.sections } }
console.log(JSON.stringify(out))
