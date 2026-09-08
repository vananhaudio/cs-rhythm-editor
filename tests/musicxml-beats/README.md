# MusicXML → beat-map — Giai đoạn 1

Context: Thầy cần nhãn phách độc lập với nốt để dạy đọc nhịp trên bản MusicXML.
Module chỉ tính thời gian và beat-map, không render hay thay đổi parser đang dùng trong app.

## Chạy

Yêu cầu Node.js >= 22.18 (chạy TypeScript bằng type stripping), npm install/ci theo lockfile.

```sh
npm run test:musicxml-beats
```

Lệnh kiểm tra TypeScript strict cho cả module và test trước khi chạy Node test runner.
21 fixture + 21 expected JSON. Expected viết từ yêu cầu âm nhạc (offset, meter,
nhãn và duration định trước), không tạo bằng output của engine. Bốn invariant
kiểm tra tie, voice, divisions và 1.200 nốt triplet; thêm kiểm tra onset của
quintuplet/septuplet, grace, forward, source identity và XML lỗi.

## API

```ts
import { parseMusicXML } from '../../src/musicxml-beats/parser.ts';
import { buildBeatMap } from '../../src/musicxml-beats/beatEngine.ts';
import { musicXMLToBeatMap, serializeBeatMap } from '../../src/musicxml-beats/beatMap.ts';

const score = parseMusicXML(xmlText); // exact normalized events + original XML
const measures = buildBeatMap(score); // independent of XML DOM and renderer
const json = serializeBeatMap(musicXMLToBeatMap(xmlText));
```

Ví dụ chạy từ thư mục repo, in beat-map ra stdout:

```sh
node --experimental-strip-types --input-type=module -e '
import { readFileSync } from "node:fs";
import { musicXMLToBeatMap, serializeBeatMap } from "./src/musicxml-beats/beatMap.ts";
console.log(serializeBeatMap(musicXMLToBeatMap(readFileSync("tests/musicxml-beats/fixtures/triplet.musicxml", "utf8"))));
'
```

## Hợp đồng thời gian và dữ liệu

- Mọi onset/duration/offset là canonical string `numerator/denominator`, gồm cả
  `0/1`, `1/1`; tính bằng BigInt nội bộ. Đơn vị là quarter note, không phải giây.
- `onset` của event và `beatsMap.offset` tính từ đầu phần thực của measure.
  `pickupOffset` là phần nhịp thiếu trước phần thực; ví dụ một quarter lấy đà
  trong 4/4: offset phách 4 = `0/1`, pickupOffset = `3/1`.
- `actualDuration` là maximum timeline extent sau khi xét backup/forward và các bè,
  không phải tổng duration của tất cả event. Backup ghi onset trước khi lùi cursor.
- `<duration>/divisions` quyết định timeline. Dot, time-modification, tie/tied
  giữ metadata, không nhân thời lượng hoặc gộp nốt.
- Grace/grace-chord có duration `0/1`. Các thuộc tính steal-time chỉ được giữ trong
  XML nguồn, không thay đổi timeline ký âm.
- Identity gồm part/measure/event structural path và XML id gốc nếu có. Paths được
  xác định trong phạm vi tài liệu; số ô trùng nhau không làm trùng identity.
- `sourceXml` giữ nguyên toàn tài liệu. Source của part/measure/event giữ XML
  serialize và đường dẫn. Harmony giữ nguyên subtree với offset chính xác;
  lời giữ các verse/text/syllabic và nguyên subtree (extend/elision/formatting).
- Đọc nhiều part, voice và staff; MVP dùng một meter chung trong mỗi part/measure.
- Beat-map là thứ tự ký âm, không triển khai playback hoặc bung repeat/volta.

## Pickup và lỗi

Chỉ xác nhận pickup khi ô đầu part có `implicit="yes"`, thời lượng dương và
ngắn hơn meter được hỗ trợ. Không suy từ số ô `0` hoặc tình trạng thiếu phách đơn lẻ.
`implicit="yes"` ở ô giữa bản không được coi là pickup.

Pickup một eighth cuối 4/4 bắt đầu ở vị trí nhịp `7/2`: không có onset phách nguyên
nào trong đoạn này, vì vậy `beatsMap: []`, pickupOffset `7/2`. Không gắn nhãn `4`
sai vào vị trí nửa sau phách 4. Chính sách này chỉ xuất nhãn số nguyên như yêu cầu MVP.

- Ô thiếu chưa xác nhận: `UNDERFULL_MEASURE_UNCLASSIFIED`, không sinh nhãn.
- Ô thừa: `OVERFULL_MEASURE`, không sinh nhãn.
- Thiếu/không hỗ trợ meter: diagnostic tương ứng, không đoán 4/4.
- XML sai cấu trúc cú pháp, thiếu duration/divisions, divisions không dương,
  backup làm cursor âm, chord không có anchor: throw Error kèm code/path.
- Có diagnostic ở measure thì không sinh beat grid cho measure đó.

## Giới hạn

- Nhận `score-partwise` dạng XML text; chưa nhận `score-timewise` hoặc MXL nén.
- Chỉ sinh nhãn 2/4, 3/4, 4/4. Chưa hỗ trợ 6/8, meter cộng/gộp, senza-misura,
  meter riêng từng staff hoặc đổi meter giữa measure (có diagnostic).
- Chưa tự phân loại pickup không có implicit metadata, ô split/thiếu nhịp giữa bản,
  hoặc ô cuối bù pickup. Giữ diagnostic để không tự sửa nguồn.
- Chưa xác thực toàn bộ MusicXML bằng XSD hoặc kiểm tra âm nhạc toàn bản
  (ví dụ tie start/stop có khớp cao độ, duration có khớp hình nốt hay không).
- Chưa có rendering: giữ XML/metadata không đồng nghĩa đã kiểm chứng engraving.
