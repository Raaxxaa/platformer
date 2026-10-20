"""A tiny Ollama HTTP client (stdlib only)."""
from __future__ import annotations

import json
import urllib.error
import urllib.request


class OllamaError(RuntimeError):
    pass


def _req(host: str, path: str, body: dict | None = None, timeout: float = 30) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(host.rstrip("/") + path, data=data,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except (urllib.error.URLError, TimeoutError) as e:
        raise OllamaError(f"Ollama at {host} not reachable: {e}") from e


def models(host: str) -> list[str]:
    return [m["name"] for m in _req(host, "/api/tags").get("models", [])]


def has_model(host: str, name: str) -> bool:
    names = models(host)
    return name in names or f"{name}:latest" in names


def chat(host: str, model: str, system: str, user: str, num_ctx: int = 32768,
         json_mode: bool = False, timeout: float = 1800) -> str:
    body = {"model": model, "stream": False,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "options": {"num_ctx": num_ctx, "temperature": 0.2}}
    if json_mode:
        body["format"] = "json"
    return _req(host, "/api/chat", body, timeout=timeout)["message"]["content"]


def parse_json(text: str) -> dict:
    """Pulls the first JSON object out of a model reply (they like to add prose)."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    while start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i + 1])
                    except json.JSONDecodeError:
                        break
        start = text.find("{", start + 1)
    raise ValueError("no JSON object in reply")
