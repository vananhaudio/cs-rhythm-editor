"""Adapter PRODUCTION-hướng: Anthropic Messages API qua HTTPS (chỉ thư viện chuẩn). Khoá đọc từ môi trường của TIẾN TRÌNH WORKER
(ANTHROPIC_API_KEY) hoặc truyền vào hàm dựng — không bao giờ nằm trong browser, mã nguồn hay log.
Chưa kiểm thử với API thật trong Slice 1 (không có khoá trong môi trường dev); logic dựng/đọc phản hồi được test bằng `post` giả."""
import base64
import json
import os
import urllib.error
import urllib.request

from .prompt import build_prompt
from .provider import VisionError, VisionRequest, VisionResult, json_from_text, parse_vision_json

API_VERSION = "2023-06-01"


def _http_post(url, headers, body, timeout):
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        raise VisionError("unreachable", "Không gọi được dịch vụ Vision.") from e


class AnthropicApiProvider:
    name = "anthropic-api"
    version = "messages-" + API_VERSION

    def __init__(self, model, api_key=None, base_url="https://api.anthropic.com", max_tokens=4096, timeout=120, post=_http_post):
        self.model = model
        self._key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self.base_url = base_url.rstrip("/")
        self.max_tokens, self.timeout, self._post = max_tokens, timeout, post
        if not self._key:
            raise VisionError("not_configured", "Thiếu ANTHROPIC_API_KEY ở môi trường worker.")

    def __repr__(self):  # không bao giờ lộ khoá
        return f"AnthropicApiProvider(model={self.model!r})"

    def build_body(self, request: VisionRequest):
        names = [f"ảnh {i + 1}" for i in range(len(request.pages))]
        content = []
        for p in request.pages:
            content.append(dict(type="image", source=dict(type="base64", media_type="image/png", data=base64.b64encode(p.png).decode())))
        content.append(dict(type="text", text=build_prompt(request, names)))
        return dict(model=self.model, max_tokens=self.max_tokens, messages=[dict(role="user", content=content)])

    def extract(self, request: VisionRequest) -> VisionResult:
        headers = {"x-api-key": self._key, "anthropic-version": API_VERSION, "content-type": "application/json"}
        status, raw = self._post(f"{self.base_url}/v1/messages", headers, json.dumps(self.build_body(request)).encode(), self.timeout)
        if status == 429:
            raise VisionError("rate_limited", "Vision đang bị giới hạn tần suất.")
        if status >= 400:
            raise VisionError("provider_failed", f"Vision trả mã {status}.")
        try:
            data = json.loads(raw)
            text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
        except Exception as e:
            raise VisionError("bad_response", "Phản hồi Vision không đọc được.") from e
        res = parse_vision_json(json_from_text(text))
        usage = data.get("usage") or {}
        res.meta = dict(inputTokens=usage.get("input_tokens"), outputTokens=usage.get("output_tokens"))
        return res
