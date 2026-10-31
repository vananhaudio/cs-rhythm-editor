// PHẢI được import đầu tiên: React DOM kiểm tra môi trường DOM ngay lúc nạp module (nếu thiếu thì onChange của ô nhập không chạy).
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://localhost' })
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window }, document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator }, IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
})
