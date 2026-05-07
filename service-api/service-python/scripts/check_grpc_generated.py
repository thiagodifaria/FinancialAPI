import filecmp
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROTO = ROOT / "data" / "proto" / "financial.proto"
GENERATED = ROOT / "service-python" / "src" / "app" / "grpc" / "generated"


def main() -> int:
    with tempfile.TemporaryDirectory() as temp_dir:
        temp = Path(temp_dir)
        subprocess.check_call(
            [
                sys.executable,
                "-m",
                "grpc_tools.protoc",
                f"-I{PROTO.parent}",
                f"--python_out={temp}",
                f"--grpc_python_out={temp}",
                str(PROTO),
            ]
        )
        grpc_file = temp / "financial_pb2_grpc.py"
        grpc_file.write_text(
            grpc_file.read_text(encoding="utf-8").replace(
                "import financial_pb2", "from . import financial_pb2"
            ),
            encoding="utf-8",
        )
        (temp / "__init__.py").touch()

        comparison = filecmp.dircmp(GENERATED, temp)
        if comparison.left_only or comparison.right_only or comparison.diff_files:
            print("Stubs gRPC divergiram do proto. Rode scripts/generate_grpc.py.", file=sys.stderr)
            return 1
        shutil.rmtree(temp, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
