"""Adapter DEV/TEST: gọi `claude -p` (Claude Code đã đăng nhập trên máy này) đọc ảnh bằng công cụ Read.
KHÔNG dùng cho production/worker (gửi ảnh qua phiên Claude Code của người chạy; không có khoá API riêng).
Chỉ chạy khi người dùng chọn rõ `--vision claude-cli`."""
import json
import os
import shutil
import subprocess
import tempfile

from .prompt import build_prompt
from .provider import VisionError, VisionRequest, VisionResult, json_from_text, parse_vision_json


class ClaudeCliProvider:
    name = "claude-cli"

    def __init__(self, model="sonnet", binary=None, timeout=240):
        self.model = model
        self.binary = binary or os.environ.get("CLAUDE_BIN") or shutil.which("claude")
        self.timeout = timeout
        if not self.binary:
            raise VisionError("unavailable", "Không tìm thấy lệnh `claude`.")
        try:
            self.version = subprocess.run([self.binary, "--version"], capture_output=True, text=True, timeout=20).stdout.strip() or "unknown"
        except Exception:
            self.version = "unknown"

    def extract(self, request: VisionRequest) -> VisionResult:
        tmp = tempfile.mkdtemp(prefix="vision-")
        try:
            names = []
            for p in request.pages:
                n = f"page{p.index}.png"
                with open(os.path.join(tmp, n), "wb") as f:
                    f.write(p.png)
                names.append("./" + n)
            r = subprocess.run([self.binary, "-p", build_prompt(request, names), "--allowedTools", "Read", "--output-format", "json", "--model", self.model],
                               cwd=tmp, capture_output=True, text=True, timeout=self.timeout)
            if r.returncode != 0:
                raise VisionError("provider_failed", "claude -p thất bại.")
            out = json.loads(r.stdout)
            if out.get("is_error"):
                raise VisionError("provider_failed", "claude -p báo lỗi.")
            res = parse_vision_json(json_from_text(out.get("result", "")))
            res.meta = dict(costUsd=out.get("total_cost_usd"), durationMs=out.get("duration_ms"))
            return res
        except subprocess.TimeoutExpired as e:
            raise VisionError("timeout", "Vision hết thời gian.") from e
        except json.JSONDecodeError as e:
            raise VisionError("bad_response", "Đầu ra claude -p không phải JSON.") from e
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
