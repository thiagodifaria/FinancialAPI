import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROTO = ROOT / "data" / "proto" / "financial.proto"
OUT = ROOT / "service-python" / "src" / "app" / "grpc" / "generated"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    command = [
        sys.executable,
        "-m",
        "grpc_tools.protoc",
        f"-I{PROTO.parent}",
        f"--python_out={OUT}",
        f"--grpc_python_out={OUT}",
        str(PROTO),
    ]
    subprocess.check_call(command)
    (OUT / "__init__.py").touch()

    grpc_file = OUT / "financial_pb2_grpc.py"
    grpc_file.write_text(
        grpc_file.read_text().replace("import financial_pb2", "from . import financial_pb2"),
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
