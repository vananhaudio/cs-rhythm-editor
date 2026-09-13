import { useState } from "react";
import type { SourceNote } from "../musicxml-beats/sourceTags.ts";
import type { MusicXmlEditCommand, Pitch, Step } from "./edit/commands.ts";
import { STEPS, describeCommands } from "./edit/commands.ts";
import type { DraftState } from "./edit/draftEngine.ts";
import { appliedCommands, canRedo, canUndo, isDirty } from "./edit/draftEngine.ts";
import type { NoteFields } from "./edit/noteFields.ts";
import type { ValidationReport } from "./edit/validation.ts";

/**
 * Panel biên tập theo ngữ cảnh (Giai đoạn Nội dung 3A): chỉ hiện công cụ của
 * thứ đang chọn. Panel KHÔNG biết XML: nó phát lệnh, trang áp lệnh lên nháp.
 * Mọi nút ở đây đều không ghi gì — trừ "Lưu thay đổi", và nút đó cũng chỉ
 * gọi lên trên.
 */
export interface EditPanelProps {
  draft: DraftState | null;
  selected: SourceNote | null;
  fields: NoteFields | null;
  saving: boolean;
  /** Vì sao chưa lưu được — để nút nói thật thay vì im lặng vô hiệu. */
  saveBlocked: string | null;
  report: ValidationReport | null;
  note: string;
  onCommand(cmd: MusicXmlEditCommand): void;
  onUndo(): void;
  onRedo(): void;
  onCancel(): void;
  onSave(changeNote: string): void;
}

const ALTER_LABEL: Record<number, string> = { [-2]: "♭♭", [-1]: "♭", 0: "♮", 1: "♯", 2: "♯♯" };
const pitchLabel = (p: Pitch) => `${p.step}${p.alter ? ALTER_LABEL[p.alter] ?? "" : ""}${p.octave}`;
const samePitch = (a: Pitch, b: Pitch) =>
  a.step === b.step && a.alter === b.alter && a.octave === b.octave;

function PitchEditor({
  path,
  current,
  onCommand,
}: {
  path: string;
  current: Pitch;
  onCommand: EditPanelProps["onCommand"];
}) {
  // Cha gắn `key` theo nốt + cao độ hiện tại: đổi nốt hay nháp đổi cao độ là
  // ô nhập dựng lại từ đầu — không cần effect đồng bộ.
  const [pitch, setPitch] = useState<Pitch>(current);
  const khac = !samePitch(pitch, current);
  return (
    <div className="np-edit-row">
      <span className="np-edit-label">Cao độ</span>
      <select
        aria-label="Bậc"
        value={pitch.step}
        onChange={(e) => setPitch({ ...pitch, step: e.target.value as Step })}
      >
        {STEPS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        aria-label="Dấu hoá"
        value={pitch.alter}
        onChange={(e) => setPitch({ ...pitch, alter: Number(e.target.value) })}
      >
        {[-2, -1, 0, 1, 2].map((a) => (
          <option key={a} value={a}>
            {ALTER_LABEL[a]}
          </option>
        ))}
      </select>
      <select
        aria-label="Quãng tám"
        value={pitch.octave}
        onChange={(e) => setPitch({ ...pitch, octave: Number(e.target.value) })}
      >
        {[1, 2, 3, 4, 5, 6, 7].map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="np-zbtn"
        disabled={!khac}
        onClick={() => onCommand({ type: "ChangePitch", path, pitch })}
      >
        {khac ? `Đổi ${pitchLabel(current)} → ${pitchLabel(pitch)}` : "Đổi cao độ"}
      </button>
      <span className="np-muted">
        Chỉ đổi cao độ vang lên; dấu hoá hiển thị là công cụ riêng, chưa có ở bước này.
      </span>
    </div>
  );
}

function LyricEditor({
  path,
  lyric,
  onCommand,
}: {
  path: string;
  lyric: NoteFields["lyrics"][number];
  onCommand: EditPanelProps["onCommand"];
}) {
  const [text, setText] = useState(lyric.text);
  const khac = text !== lyric.text && text.trim() !== "";
  return (
    <div className="np-edit-row">
      <span className="np-edit-label">Lời {lyric.number}</span>
      {lyric.compound ? (
        <span className="np-muted">
          “{lyric.text}” là âm tiết ghép — chưa sửa được ở bước này.
        </span>
      ) : (
        <>
          <input
            aria-label={`Lời ${lyric.number}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && khac)
                onCommand({ type: "ChangeLyricText", path, lyricNumber: lyric.number, text });
            }}
          />
          <button
            type="button"
            className="np-zbtn"
            disabled={!khac}
            onClick={() =>
              onCommand({ type: "ChangeLyricText", path, lyricNumber: lyric.number, text })
            }
          >
            Đổi lời
          </button>
        </>
      )}
    </div>
  );
}

export function EditPanel({
  draft,
  selected,
  fields,
  saving,
  saveBlocked,
  report,
  note,
  onCommand,
  onUndo,
  onRedo,
  onCancel,
  onSave,
}: EditPanelProps) {
  const dirty = !!draft && isDirty(draft);
  const soLenh = draft ? appliedCommands(draft).length : 0;
  const goiY = draft ? describeCommands(appliedCommands(draft)) : "";
  // Ghi chú tự sinh đi theo ngăn xếp lệnh, cho tới khi thầy tự gõ vào ô; nháp
  // sạch lại thì quên bản đã gõ. Điều chỉnh ngay trong lúc render, không effect.
  const [tuGo, setTuGo] = useState<string | null>(null);
  const [truocDoDirty, setTruocDoDirty] = useState(dirty);
  if (truocDoDirty !== dirty) {
    setTruocDoDirty(dirty);
    if (!dirty) setTuGo(null);
  }
  const ghiChu = tuGo ?? goiY;

  return (
    <div className="np-edit-panel" aria-label="Chỉnh sửa bản nhạc">
      <div className="np-edit-head">
        <strong>Chỉnh sửa</strong>
        <span className={dirty ? "np-edit-dirty" : "np-muted"}>
          {dirty ? `Có thay đổi chưa lưu · ${soLenh}` : "Chưa có thay đổi"}
        </span>
        <span className="np-edit-actions">
          <button type="button" className="np-zbtn" disabled={!draft || !canUndo(draft)} onClick={onUndo}>
            Hoàn tác
          </button>
          <button type="button" className="np-zbtn" disabled={!draft || !canRedo(draft)} onClick={onRedo}>
            Làm lại
          </button>
          <button type="button" className="np-zbtn" disabled={!dirty} onClick={onCancel}>
            Huỷ thay đổi
          </button>
        </span>
      </div>

      {selected && fields ? (
        fields.kind === "rest" ? (
          <div className="np-edit-row">
            <span className="np-muted">Dấu lặng không có cao độ hay lời để sửa.</span>
          </div>
        ) : (
          <>
            {fields.pitch && (
              <PitchEditor
                key={`${selected.path}|${pitchLabel(fields.pitch)}`}
                path={selected.path}
                current={fields.pitch}
                onCommand={onCommand}
              />
            )}
            {fields.lyrics.map((l) => (
              <LyricEditor
                key={`${selected.path}|${l.number}|${l.text}`}
                path={selected.path}
                lyric={l}
                onCommand={onCommand}
              />
            ))}
            {!fields.lyrics.length && (
              <div className="np-edit-row">
                <span className="np-muted">Nốt này chưa có lời.</span>
              </div>
            )}
          </>
        )
      ) : (
        <div className="np-edit-row">
          <span className="np-muted">Bấm một nốt trên bản nhạc để thấy công cụ sửa của nó.</span>
        </div>
      )}

      {dirty && (
        <div className="np-edit-row np-edit-save">
          <span className="np-edit-label">Ghi chú phiên bản</span>
          <input
            aria-label="Ghi chú phiên bản"
            value={ghiChu}
            maxLength={300}
            onChange={(e) => setTuGo(e.target.value)}
          />
          <button
            type="button"
            className="np-btn np-btn-primary"
            disabled={saving || saveBlocked !== null}
            title={saveBlocked ?? undefined}
            onClick={() => onSave(ghiChu)}
          >
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
          {saveBlocked && <span className="np-muted">{saveBlocked}</span>}
        </div>
      )}

      {report && !report.ok && (
        <ul className="np-edit-report" aria-label="Kết quả kiểm tra">
          {report.stages.map((s) => (
            <li key={s.id} data-ok={s.skipped ? "skip" : s.ok ? "yes" : "no"}>
              {s.skipped ? "·" : s.ok ? "✓" : "✗"} {s.label}
              {!s.ok && !s.skipped && s.messages.length > 0 && (
                <span> — {s.messages.slice(0, 3).join(" ")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {note && (
        <div className="np-edit-row" role="status">
          <span className={note.startsWith("Đã") ? "np-edit-ok" : "np-edit-err"}>{note}</span>
        </div>
      )}
    </div>
  );
}
