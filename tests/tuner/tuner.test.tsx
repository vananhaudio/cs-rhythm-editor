import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { render, act, cleanup, fireEvent } from '@testing-library/react';
import GuitarTuner from '../../src/GuitarTuner';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://localhost' });
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
});
let now = 0, frequency = 0, amplitude = 0, serial = 0;
let frames = new Map<number, FrameRequestCallback>();
let contexts: FakeAudioContext[] = [];
let requests: { resolve: (stream: any) => void; reject: (error: Error) => void }[] = [];
let failSetup = false, suspend = false;
class FakeAudioContext {
  sampleRate = 44100;
  state = suspend ? 'suspended' : 'running';
  resumeResolve: (() => void) | undefined;
  constructor() { contexts.push(this); }
  resume() { return new Promise<void>(resolve => { this.resumeResolve = () => { this.state = 'running'; resolve(); }; }); }
  async close() { this.state = 'closed'; }
  createAnalyser() {
    if (failSetup) throw new Error('Audio initialization failed');
    return {
      fftSize: 8192, smoothingTimeConstant: 0,
      getFloatTimeDomainData(buf: Float32Array) {
        for (let i = 0; i < buf.length; i++) {
          buf[i] = frequency ? amplitude * Math.sin(2 * Math.PI * frequency * i / 44100) : 0;
        }
      },
    };
  }
  createMediaStreamSource() { return { connect() {} }; }
}
function stream() {
  const track = { stopped: false, stop() { this.stopped = true; } };
  return { track, getTracks: () => [track] };
}
beforeEach(t => {
  now = 0; frequency = 0; amplitude = 0; serial = 0;
  contexts = []; frames = new Map(); requests = []; failSetup = false; suspend = false;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
  } });
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: FakeAudioContext });
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: (fn: FrameRequestCallback) => { frames.set(++serial, fn); return serial; } });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: (id: number) => frames.delete(id) });
  t.mock.method(performance, 'now', () => now);
  t.mock.method(Date, 'now', () => now);
});
afterEach(() => { cleanup(); });
async function grant() { const s = stream(); await act(async () => requests.at(-1)!.resolve(s)); return s; }
async function advance(count: number, hz = 0, step = 1000 / 60) {
  frequency = hz; amplitude = hz ? 0.12 : 0;
  for (let i = 0; i < count; i++) {
    now += step;
    const pending = [...frames.values()]; frames.clear();
    await act(async () => pending.forEach(fn => fn(now)));
  }
}
async function ready() { const ui = render(<GuitarTuner embedded />); const s = await grant(); await advance(32); return { ui, s }; }

test('chạm nhiều lần trong khi xin mic chỉ tạo một yêu cầu', async () => {
  const ui = render(<GuitarTuner embedded />);
  fireEvent.click(ui.getByText('Đang bật micro…'));
  fireEvent.click(ui.getByText('Đang bật micro…'));
  assert.equal(requests.length, 1);
  await grant();
  assert.equal(contexts.length, 1);
});
test('đóng màn hình trước khi cấp mic: stream đến muộn được tắt', async () => {
  const ui = render(<GuitarTuner embedded />);
  ui.unmount();
  const s = await grant();
  assert.equal(s.track.stopped, true);
  assert.equal(contexts.length, 0);
  assert.equal(frames.size, 0);
});
test('đóng màn hình khi AudioContext đang resume: không khởi động vòng đo muộn', async () => {
  suspend = true;
  const ui = render(<GuitarTuner embedded />); const s = await grant();
  ui.unmount();
  assert.equal(s.track.stopped, true);
  assert.equal(contexts[0].state, 'closed');
  await act(async () => contexts[0].resumeResolve!());
  assert.equal(frames.size, 0);
});
test('khởi tạo âm thanh lỗi: dọn mic và cho phép thử lại', async () => {
  failSetup = true;
  const ui = render(<GuitarTuner embedded />); const s = await grant();
  assert.equal(s.track.stopped, true);
  assert.equal(contexts[0].state, 'closed');
  failSetup = false;
  fireEvent.click(ui.getByRole('button', { name: 'Cho phép & nghe lại' }));
  assert.equal(requests.length, 2);
  await grant();
  assert.equal(frames.size, 1);
});
test('từ chối quyền mic rồi thử lại thành công', async () => {
  const ui = render(<GuitarTuner embedded />);
  await act(async () => requests[0].reject(new Error('NotAllowedError')));
  fireEvent.click(ui.getByRole('button', { name: 'Cho phép & nghe lại' }));
  await grant();
  assert.equal(frames.size, 1);
});
test('React StrictMode không để sót stream hoặc vòng đo', async () => {
  const ui = render(<React.StrictMode><GuitarTuner embedded /></React.StrictMode>);
  assert.equal(requests.length, 2);
  const old = stream(), current = stream();
  await act(async () => { requests[1].resolve(current); requests[0].resolve(old); });
  assert.equal(old.track.stopped, true);
  assert.equal(current.track.stopped, false);
  assert.equal(frames.size, 1);
  ui.unmount();
  assert.equal(current.track.stopped, true);
  assert.equal(frames.size, 0);
});
test('âm chuẩn ngắn rồi im lặng: giữ kim nhưng KHÔNG đánh dấu xong', async () => {
  const { ui } = await ready();
  await advance(24, 110);
  const measured = ui.container.textContent!.match(/([\d.]+) Hz/)![1];
  assert.ok(Math.abs(1200 * Math.log2(Number(measured) / 110)) < 8);
  await advance(100);
  assert.ok(ui.container.textContent!.includes(`${measured} Hz`));
  assert.match(ui.container.textContent!, /0\/6/);
});
test('âm chuẩn liên tục hoàn tất đủ cả 6 dây', async () => {
  const { ui } = await ready();
  for (const hz of [82.41, 110, 146.83, 196, 246.94, 329.63]) {
    await advance(8);
    await advance(80, hz);
  }
  assert.match(ui.container.textContent!, /Cả 6 dây đã chuẩn/);
  assert.match(ui.container.textContent!, /Đàn đã lên dây chuẩn/);
});
test('âm lệch và khoảng ngắt khung hình không được tính là giữ chuẩn', async () => {
  const { ui } = await ready();
  await advance(24, 110);
  await advance(4, 110, 500);
  assert.match(ui.container.textContent!, /0\/6/);
  await advance(100, 114);
  assert.match(ui.container.textContent!, /0\/6/);
});
test('nghe mẫu hủy khoảng giữ chuẩn và không đếm tiếng loa', async () => {
  const { ui } = await ready();
  await advance(24, 110);
  fireEvent.click(ui.getByRole('button', { name: /Nghe mẫu/ }));
  await advance(100, 110);
  assert.match(ui.container.textContent!, /0\/6/);
});
