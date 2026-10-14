import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "src" / "backend"))

from loguru import logger  # noqa: E402

logger.remove()

from main import app  # noqa: E402

output = Path(__file__).resolve().parents[1] / "openapi.json"
output.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
print(f"Exported backend OpenAPI to {output}")
