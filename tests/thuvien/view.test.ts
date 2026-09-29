import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, test } from 'node:test'
import { createAnnotatedScoreRenderer } from '../../src/musicxml-beats/renderer/verovioAdapter.ts'
import { DEFAULT_SCORE_SETTINGS } from '../../src/musicxml-beats/renderer/types.ts'
import { pageSrc, renderPagesForView, scoreIdFromSearch, VIEW_SETTINGS } from '../../src/thuvien/viewScore.ts'

const fixture = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const renderer = await createAnnotatedScoreRenderer()
after(() => renderer.destroy())

for (const path of ['../musicxml-export/fixtures/short.musicxml', '../musicxml-compound/fixtures/simple-6-8.musicxml', '../../public/musicxml-beats/sample.musicxml']) {
  test(`renders ${path.split('/').pop()} with the Nhịp Phách engraver and no beat labels`, () => {
    const xml = fixture(path)
    const pages = renderPagesForView(renderer, xml)
    assert.ok(pages.length >= 1)
    for (const page of pages) {
      assert.match(page.svg, /<svg/)
      assert.ok(page.width > 0 && page.height > 0)
      assert.ok(!page.svg.includes(DEFAULT_SCORE_SETTINGS.color), 'không có nhãn số phách')
    }
    // Đối chứng: cùng bản, bật số phách thì có nhãn — chứng minh VIEW_SETTINGS thật sự tắt lớp phủ.
    assert.ok(renderer.render(xml, DEFAULT_SCORE_SETTINGS).anchors.length > 0)
    assert.equal(renderer.render(xml, VIEW_SETTINGS).anchors.length, 0)
  })
}

test('page image is a self-contained SVG data URL', () => {
  assert.equal(pageSrc('<svg a="1"/>'), 'data:image/svg+xml;charset=utf-8,%3Csvg%20a%3D%221%22%2F%3E')
})

test('reads ?bai= only when it is a uuid', () => {
  assert.equal(scoreIdFromSearch('?bai=0F1E2D3C-4B5A-6978-8796-A5B4C3D2E1F0'), '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0')
  assert.equal(scoreIdFromSearch('?bai=abc'), null)
  assert.equal(scoreIdFromSearch('?bai='), null)
  assert.equal(scoreIdFromSearch(''), null)
})
