import { useState } from "react";
import type { SourceNote } from "../musicxml-beats/sourceTags.ts";
import type { MusicXmlEditCommand, Pitch, Step } from "./edit/commands.ts";
import { STEPS, describeCommands } from "./edit/commands.ts";
import type { AccidentalChoice } from "./edit/accidentals.ts";
import type { DraftState } from "./edit/draftEngine.ts";
import { appliedCommands, canRedo, canUndo, isDirty } from "./edit/draftEngine.ts";
import type { NoteFields, NoteLyric } from "./edit/noteFields.ts";
import { ALTER_SYMBOL, pitchName, samePitch } from "./edit/pitchModel.ts";
import { DOT_LABEL, NOTE_TYPES, TYPE_LABEL } from "./edit/durationModel.ts";
import type { NoteType } from "./edit/durationModel.ts";
import type { NoteWarning } from "./edit/noteWarnings.ts";
import type { ValidationReport } from "./edit/validation.ts";

/**
 * Panel biên tập theo ngữ cảnh: chỉ hiện công cụ của thứ đang chọn, và chỉ hiện
 * những gì sửa được thật. Panel KHÔNG biết XML và KHÔNG suy luận nhạc lý — nó
 * phát lệnh, còn `edit/` trả lời "sửa được không, dấu hoá nào, trường độ nào".
 */
export interface EditPanelProps {
  draft: DraftState | null;
  selected: SourceNote | null;
  fields: NoteFields | null;
  saving: boolean;
  /** Vì sao chưa lưu được — để nút nói thật thay vì im lặng vô hiệu. */
  saveBlocked: string | null;
  /** Ô nhịp mà bản nháp MỚI làm hỏng: xem trước vẫn cho xem, nhưng chặn lưu. */
  rhythmIssues: readonly string[];
  /** Chỗ "nhìn một đằng vang một nẻo" mà bản nháp mới gây ra. */
  warnings: readonly NoteWarning[];
  report: ValidationReport | null;
  note: string;
  onCommand(cmd: MusicXmlEditCommand): void;
  onUndo(): void;
  onRedo(): void;
  onCancel(): void;
  onSave(changeNote: string): void;
}

const ACCIDENTAL_CHOICES: { id: AccidentalChoice; ten: string }[] = [
  { id: "auto", ten: "Tự động" },
  { id: "hien", ten: "Hiện rõ" },
  { id: "an", ten: "Ẩn" },
];

function PitchEditor({
  path,
  current,
  fields,
  onCommand,
}: {
  path: string;
  current: Pitch;
  fields: NoteFields;
  onCommand: EditPanelProps["onCommand"];
}) {
  const [pitch, setPitch] = useState<Pitch>(current);
  const [accidental, setAccidental] = useState<AccidentalChoice>("auto");
  const doiCaoDo = !samePitch(pitch, current);
  // Giữ nguyên cao độ nhưng đổi cách VẼ dấu cũng là một thay đổi thật (dấu nhắc,
  // hoặc bỏ dấu thừa). Lớp `edit/` trả lời lựa chọn ấy dẫn tới dấu nào.
  const doiDau = !doiCaoDo && fields.accidentalTarget[accidental] !== fields.accidental;
  const khac = doiCaoDo || doiDau;
  const respell = fields.respell;
  return (
    <>
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
              {a === 0 ? "♮" : ALTER_SYMBOL[a]}
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
          onClick={() => onCommand({ type: "ChangePitch", path, pitch, accidental })}
        >
          {doiCaoDo ? `Đổi ${pitchName(current)} → ${pitchName(pitch)}` : doiDau ? "Đổi dấu hiển thị" : "Đổi cao độ"}
        </button>
      </div>
      <div className="np-edit-row">
        <span className="np-edit-label">Dấu hiển thị</span>
        <select
          aria-label="Dấu hiển thị"
          value={accidental}
          onChange={(e) => setAccidental(e.target.value as AccidentalChoice)}
        >
          {ACCIDENTAL_CHOICES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.ten}
            </option>
          ))}
        </select>
        <span className="np-muted">
          Tự động: chỉ vẽ dấu khi tiếng khác với bộ khoá và các dấu đã có trong ô nhịp.
        </span>
      </div>
      {respell.length > 0 && (
        <div className="np-edit-row">
          <span className="np-edit-label">Cách ghi khác</span>
          {respell.map((p) => (
            <button
              key={pitchName(p)}
              type="button"
              className="np-zbtn"
              onClick={() => onCommand({ type: "RespellNote", path, pitch: p, accidental })}
            >
              {pitchName(p)}
            </button>
          ))}
          <span className="np-muted">Giữ nguyên tiếng, chỉ đổi mặt chữ.</span>
        </div>
      )}
    </>
  );
}

function DurationEditor({
  path,
  fields,
  onCommand,
}: {
  path: string;
  fields: NoteFields;
  onCommand: EditPanelProps["onCommand"];
}) {
  const [noteType, setNoteType] = useState<NoteType>(fields.noteType ?? "quarter");
  const [dots, setDots] = useState(Math.min(fields.dots, 2));
  if (fields.duongTruongDo)
    return (
      <div className="np-edit-row">
        <span className="np-edit-label">Trường độ</span>
        <span className="np-muted">{fields.duongTruongDo}</span>
      </div>
    );
  const khac = noteType !== fields.noteType || dots !== fields.dots;
  return (
    <div className="np-edit-row">
      <span className="np-edit-label">Trường độ</span>
      <select
        aria-label="Hình nốt"
        value={noteType}
        onChange={(e) => setNoteType(e.target.value as NoteType)}
      >
        {NOTE_TYPES.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      <select aria-label="Chấm dôi" value={dots} onChange={(e) => setDots(Number(e.target.value))}>
        {DOT_LABEL.map((ten, i) => (
          <option key={ten} value={i}>
            {ten}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="np-zbtn"
        disabled={!khac}
        onClick={() => onCommand({ type: "ChangeDuration", path, noteType, dots })}
      >
        Đổi trường độ
      </button>
      {!fields.noteType && fields.rawNoteType && (
        <span className="np-muted">Nguồn đang ghi hình nốt “{fields.rawNoteType}”.</span>
      )}
    </div>
  );
}

function LyricEditor({
  path,
  lyric,
  onCommand,
}: {
  path: string;
  lyric: NoteLyric;
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

/** Cảnh báo theo NGỮ CẢNH của chính nốt đang chọn — nói trước khi thầy ra tay. */
function noteNotes(fields: NoteFields): string[] {
  const out: string[] = [];
  if (fields.ties.length)
    out.push("Nốt này đang nối sang nốt khác — chỉ sửa riêng nốt này, chuỗi nối giữ nguyên.");
  if (fields.chord === "member") out.push("Đây là một nốt trong hợp âm.");
  if (fields.tab)
    out.push(
      fields.tabKhop === false
        ? `TAB đang ghi dây ${fields.tab.string} phím ${fields.tab.fret} — không khớp cao độ của nốt.`
        : `Nốt này có thế bấm TAB (dây ${fields.tab.string}, phím ${fields.tab.fret}); đổi cao độ không tự đổi thế bấm.`
    );
  if (fields.grace) out.push("Nốt hoa mỹ.");
  return out;
}

export function EditPanel({
  draft,
  selected,
  fields,
  saving,
  saveBlocked,
  rhythmIssues,
  warnings,
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
          <>
            <div className="np-edit-row">
              <span className="np-muted">Dấu lặng không có cao độ hay lời để sửa.</span>
            </div>
            <DurationEditor path={selected.path} fields={fields} onCommand={onCommand} />
          </>
        ) : (
          <>
            {fields.pitch && (
              <PitchEditor
                key={`${selected.path}|${pitchName(fields.pitch)}|${fields.accidental ?? ""}`}
                path={selected.path}
                current={fields.pitch}
                fields={fields}
                onCommand={onCommand}
              />
            )}
            <DurationEditor
              key={`${selected.path}|${fields.noteType ?? ""}|${fields.dots}`}
              path={selected.path}
              fields={fields}
              onCommand={onCommand}
            />
            {fields.lyrics.map((l) => (
              <LyricEditor
                key={`${selected.path}|${l.number}|${l.text}`}
                path={selected.path}
                lyric={l}
                onCommand={onCommand}
              />
            ))}
            {noteNotes(fields).map((t) => (
              <div className="np-edit-row" key={t}>
                <span className="np-edit-canhbao">{t}</span>
              </div>
            ))}
          </>
        )
      ) : (
        <div className="np-edit-row">
          <span className="np-muted">Bấm một nốt trên bản nhạc để thấy công cụ sửa của nó.</span>
        </div>
      )}

      {(rhythmIssues.length > 0 || warnings.length > 0) && (
        <ul className="np-edit-report" aria-label="Cảnh báo bản nháp">
          {rhythmIssues.map((t) => (
            <li key={t} data-ok="no">
              ✗ {t}
            </li>
          ))}
          {warnings.map((w) => (
            <li key={`${w.code}${w.path}`} data-ok="warn">
              ⚠ {w.message}
            </li>
          ))}
        </ul>
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
