from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib import request
import json


@dataclass(frozen=True)
class FinancialCoreClient:
    base_url: str
    api_key: str

    def create_customer(self, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/v1/customers", body)

    def list_customers(self) -> dict[str, Any]:
        return self._request("GET", "/v1/customers")

    def create_account(self, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/v1/accounts", body)

    def get_balance(self, account_id: str) -> dict[str, Any]:
        return self._request("GET", f"/v1/accounts/{account_id}/balance")

    def create_deposit(self, body: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        return self._request("POST", "/v1/deposits", body, idempotency_key)

    def run_reconciliation(self, period_start: str, period_end: str) -> dict[str, Any]:
        return self._request(
            "POST",
            "/v1/reconciliation-runs",
            {"period_start": period_start, "period_end": period_end},
        )

    def _request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        payload = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"content-type": "application/json", "x-api-key": self.api_key}
        if idempotency_key:
            headers["x-idempotency-key"] = idempotency_key
        req = request.Request(f"{self.base_url}{path}", data=payload, headers=headers, method=method)
        with request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
