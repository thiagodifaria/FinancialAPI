FROM python:3.13-slim

WORKDIR /app
ENV PYTHONPATH=/app/src

COPY service-python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY service-python/pyproject.toml ./pyproject.toml
COPY service-python/src/ ./src/
COPY data/proto/ ./proto/

# Gerar stubs gRPC a partir do contrato versionado.
RUN mkdir -p ./src/app/grpc/generated \
  && python -m grpc_tools.protoc -I./proto \
    --python_out=./src/app/grpc/generated \
    --grpc_python_out=./src/app/grpc/generated \
    ./proto/financial.proto \
  && touch ./src/app/grpc/generated/__init__.py \
  && sed -i 's/^import financial_pb2/from . import financial_pb2/' ./src/app/grpc/generated/financial_pb2_grpc.py

RUN useradd --create-home --shell /usr/sbin/nologin scoring
USER scoring

EXPOSE 50052

HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD python -c "import grpc; from grpc_health.v1 import health_pb2, health_pb2_grpc; channel = grpc.insecure_channel('localhost:50052'); response = health_pb2_grpc.HealthStub(channel).Check(health_pb2.HealthCheckRequest(), timeout=3); raise SystemExit(0 if response.status == health_pb2.HealthCheckResponse.SERVING else 1)"

CMD ["python", "-m", "app"]
