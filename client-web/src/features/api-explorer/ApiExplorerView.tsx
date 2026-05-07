import {
  Braces,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  FileJson2,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { endpointSpec, ids } from "../../api/endpointSpec";
import { requestApi } from "../../api/httpClient";
import { MethodBadge } from "../../components/MethodBadge";
import { parseJsonObject, stringifyJson } from "../../lib/json";
import type {
  ApiResponseLog,
  EndpointSpec,
  FieldSpec,
  RuntimeEnvironment,
} from "../../types/api";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { ResponseConsole } from "./ResponseConsole";

type RequestMode = "simple" | "json" | "ready";

const defaultEnv: RuntimeEnvironment = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000",
  apiKey: "dev-api-key",
  bearerToken: "",
  customerId: "",
  accountId: "",
  resourceId: "",
  productId: "",
};

function applyEnv(path: string, env: RuntimeEnvironment): string {
  return path
    .replace(ids.customerId, env.customerId || ids.customerId)
    .replace(ids.accountId, env.accountId || ids.accountId)
    .replace(ids.productId, env.productId || ids.productId)
    .replace(ids.apiKeyId, env.resourceId || ids.apiKeyId)
    .replace(ids.boletoId, env.resourceId || ids.boletoId)
    .replace(ids.cardId, env.resourceId || ids.cardId)
    .replace(ids.contractId, env.resourceId || ids.contractId)
    .replace(ids.externalAccountId, env.resourceId || ids.externalAccountId)
    .replace(ids.feeId, env.resourceId || ids.feeId)
    .replace(ids.installmentId, env.resourceId || ids.installmentId)
    .replace(ids.movementId, env.resourceId || ids.movementId)
    .replace(ids.offerId, env.resourceId || ids.offerId)
    .replace(ids.pixKeyId, env.resourceId || ids.pixKeyId)
    .replace(ids.reconciliationRunId, env.resourceId || ids.reconciliationRunId)
    .replace(ids.statementId, env.resourceId || ids.statementId)
    .replace(ids.transactionId, env.resourceId || ids.transactionId)
    .replace(ids.transferId, env.resourceId || ids.transferId)
    .replace(ids.webhookDeliveryId, env.resourceId || ids.webhookDeliveryId)
    .replace(ids.webhookEndpointId, env.resourceId || ids.webhookEndpointId);
}

function bodyWithEnv(
  endpoint: EndpointSpec,
  env: RuntimeEnvironment,
): Record<string, unknown> {
  const body = { ...(endpoint.bodyTemplate ?? {}) };
  for (const [key, value] of Object.entries(body)) {
    if (value === "" && key.includes("customer")) body[key] = env.customerId;
    if (value === "" && key.includes("account")) body[key] = env.accountId;
    if (value === "" && key.includes("product")) body[key] = env.productId;
  }
  return body;
}

function fieldLabel(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bId\b/g, "ID")
    .replace(/\bApi\b/g, "API");
}

function fieldType(value: unknown): FieldSpec["type"] {
  if (typeof value === "number") return "number";
  if (Array.isArray(value) || (typeof value === "object" && value !== null))
    return "textarea";
  return "text";
}

function fieldsFor(endpoint: EndpointSpec): FieldSpec[] {
  if (endpoint.simpleFields?.length) return endpoint.simpleFields;
  return Object.entries(endpoint.bodyTemplate ?? {}).map(([name, value]) => ({
    name,
    label: fieldLabel(name),
    type: fieldType(value),
    defaultValue:
      Array.isArray(value) || (typeof value === "object" && value !== null)
        ? JSON.stringify(value)
        : String(value ?? ""),
  }));
}

function formFromEndpoint(
  endpoint: EndpointSpec,
  env: RuntimeEnvironment,
): Record<string, string> {
  const body = bodyWithEnv(endpoint, env);
  return Object.fromEntries(
    fieldsFor(endpoint).map((field) => {
      const value = body[field.name] ?? field.defaultValue ?? "";
      return [
        field.name,
        Array.isArray(value) || (typeof value === "object" && value !== null)
          ? JSON.stringify(value)
          : String(value),
      ];
    }),
  );
}

function formToBody(
  endpoint: EndpointSpec,
  form: Record<string, string>,
): Record<string, unknown> {
  return Object.fromEntries(
    fieldsFor(endpoint)
      .map((field) => {
        const rawValue = form[field.name] ?? "";
        if (
          !rawValue &&
          (field.name.endsWith("_id") || field.name === "product_id")
        )
          return null;
        if (field.type === "number") return [field.name, Number(rawValue)];
        if (field.type === "textarea") {
          try {
            return [field.name, JSON.parse(rawValue)];
          } catch {
            return [field.name, rawValue];
          }
        }
        return [field.name, rawValue];
      })
      .filter((entry): entry is [string, unknown] => Array.isArray(entry)),
  );
}

export function ApiExplorerView() {
  const [query, setQuery] = useState("");
  const [env, setEnv] = useState<RuntimeEnvironment>(() => {
    const stored = localStorage.getItem("financial-api-env");
    return stored ? { ...defaultEnv, ...JSON.parse(stored) } : defaultEnv;
  });
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      endpointSpec.map((category) => [category.category, false]),
    ),
  );
  const [active, setActive] = useState<EndpointSpec>(
    endpointSpec[0].endpoints[0],
  );
  const [requestMode, setRequestMode] = useState<RequestMode>("simple");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [payload, setPayload] = useState("{}");
  const [response, setResponse] = useState<ApiResponseLog | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(
    () => localStorage.setItem("financial-api-env", JSON.stringify(env)),
    [env],
  );
  useEffect(() => {
    const nextForm = formFromEndpoint(active, env);
    setFormData(nextForm);
    setPayload(stringifyJson(bodyWithEnv(active, env)));
    setRequestMode("simple");
    setResponse(null);
  }, [active, env.customerId, env.accountId, env.productId]);

  const activeFields = useMemo(() => fieldsFor(active), [active]);
  const readyPayload = useMemo(
    () => stringifyJson(bodyWithEnv(active, env)),
    [active, env.customerId, env.accountId, env.productId],
  );
  const bodyPreview = useMemo(() => {
    if (active.method === "GET") return "";
    if (requestMode === "json") return payload;
    if (requestMode === "ready") return readyPayload;
    return stringifyJson(formToBody(active, formData));
  }, [active, formData, payload, readyPayload, requestMode]);

  const filtered = useMemo(
    () =>
      endpointSpec.map((category) => ({
        ...category,
        endpoints: category.endpoints.filter((endpoint) =>
          `${endpoint.title} ${endpoint.path}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
      })),
    [query],
  );

  async function send() {
    setLoading(true);
    setResponse(null);
    try {
      const body =
        active.method === "GET" ? undefined : parseJsonObject(bodyPreview);
      const result = await requestApi({
        env,
        method: active.method,
        path: applyEnv(active.path, env),
        body,
        idempotencyKey: active.idempotent
          ? `console-${active.id}-${Date.now()}`
          : undefined,
      });
      setResponse(result);
      capture(result.body);
    } catch (error) {
      setResponse({
        status: 0,
        durationMs: 0,
        headers: {},
        body: {
          error: error instanceof Error ? error.message : "Falha desconhecida",
        },
      });
    } finally {
      setLoading(false);
    }
  }

  function capture(body: unknown) {
    if (!body || typeof body !== "object") return;
    const record = body as Record<string, unknown>;
    if (typeof record.access_token === "string")
      setEnv({ ...env, bearerToken: record.access_token });
    if (typeof record.id === "string") {
      if (active.captures === "customerId")
        setEnv({ ...env, customerId: record.id });
      else if (active.captures === "accountId")
        setEnv({ ...env, accountId: record.id });
      else setEnv({ ...env, resourceId: record.id });
    }
  }

  function updateFormField(name: string, value: string) {
    setFormData((current) => ({ ...current, [name]: value }));
  }

  function resetModel() {
    const nextForm = formFromEndpoint(active, env);
    setFormData(nextForm);
    setPayload(stringifyJson(bodyWithEnv(active, env)));
  }

  return (
    <div className="api-view">
      <aside className="endpoint-sidebar">
        <div className="search-box">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrar endpoints..."
          />
        </div>
        <div className="endpoint-list">
          {filtered.map((category) => (
            <div key={category.category}>
              <button
                className="category"
                onClick={() =>
                  setOpen({
                    ...open,
                    [category.category]: !open[category.category],
                  })
                }
              >
                <span>
                  <category.icon size={14} /> {category.category}
                </span>
                {open[category.category] ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
              </button>
              {open[category.category] &&
                category.endpoints.map((endpoint) => (
                  <button
                    key={endpoint.id}
                    className={
                      active.id === endpoint.id ? "endpoint active" : "endpoint"
                    }
                    onClick={() => setActive(endpoint)}
                  >
                    <MethodBadge method={endpoint.method} />
                    <span>{endpoint.title}</span>
                  </button>
                ))}
            </div>
          ))}
          <EnvironmentPanel env={env} setEnv={setEnv} />
        </div>
      </aside>
      <main className="endpoint-detail">
        <div className="endpoint-title">
          <h1>{active.title}</h1>
          <div>
            <MethodBadge method={active.method} />
            <code>{applyEnv(active.path, env)}</code>
          </div>
          <p>{active.description}</p>
          {(active.details?.length ||
            active.requestNotes?.length ||
            active.responseNotes?.length ||
            active.idempotent) && (
            <div className="endpoint-doc-grid">
              {active.details?.length ? (
                <section>
                  <strong>Como funciona</strong>
                  <ul>
                    {active.details.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {active.requestNotes?.length || active.idempotent ? (
                <section>
                  <strong>Requisição</strong>
                  <ul>
                    {active.idempotent ? (
                      <li>
                        Usa <code>x-idempotency-key</code> automático no console
                        para evitar duplicidade em retry.
                      </li>
                    ) : null}
                    {active.requestNotes?.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {active.responseNotes?.length ? (
                <section>
                  <strong>Resposta</strong>
                  <ul>
                    {active.responseNotes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
        <section className="request-card">
          <h2>
            <Play size={18} /> Testar requisição
          </h2>
          <div className="request-toolbar">
            <div className="mode-tabs" aria-label="Modo do corpo da requisição">
              <button
                className={requestMode === "simple" ? "active" : ""}
                onClick={() => setRequestMode("simple")}
                type="button"
              >
                <SlidersHorizontal size={14} /> Simples
              </button>
              <button
                className={requestMode === "json" ? "active" : ""}
                onClick={() => setRequestMode("json")}
                type="button"
              >
                <FileJson2 size={14} /> JSON Configurável
              </button>
              <button
                className={requestMode === "ready" ? "active" : ""}
                onClick={() => setRequestMode("ready")}
                type="button"
              >
                <FileCheck2 size={14} /> JSON Pronto
              </button>
            </div>
            {active.method !== "GET" && (
              <button
                className="reset-template"
                onClick={resetModel}
                type="button"
              >
                <RotateCcw size={14} /> Restaurar exemplos
              </button>
            )}
          </div>

          {active.method === "GET" ? (
            <div className="empty-request">
              <Braces size={16} />
              <span>
                Este endpoint não envia body. Clique em enviar para testar com o
                ambiente atual.
              </span>
            </div>
          ) : requestMode === "simple" ? (
            <div className="model-grid">
              {activeFields.map((field) => (
                <label
                  key={field.name}
                  className={
                    field.type === "textarea"
                      ? "model-field full"
                      : "model-field"
                  }
                >
                  <span>{field.label}</span>
                  {field.type === "select" ? (
                    <select
                      value={formData[field.name] ?? ""}
                      onChange={(event) =>
                        updateFormField(field.name, event.target.value)
                      }
                    >
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      value={formData[field.name] ?? ""}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        updateFormField(field.name, event.target.value)
                      }
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={formData[field.name] ?? ""}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        updateFormField(field.name, event.target.value)
                      }
                    />
                  )}
                </label>
              ))}
            </div>
          ) : requestMode === "json" ? (
            <>
              <label className="json-label">
                <Braces size={14} /> JSON configurável
              </label>
              <textarea
                className="json-editor"
                value={payload}
                onChange={(event) => setPayload(event.target.value)}
              />
            </>
          ) : (
            <>
              <label className="json-label">
                <FileCheck2 size={14} /> JSON pronto para envio
              </label>
              <textarea
                className="json-editor ready"
                value={readyPayload}
                readOnly
              />
            </>
          )}
          <button className="send-request" onClick={send} disabled={loading}>
            {loading ? "Enviando..." : "Enviar requisição"}
          </button>
        </section>
      </main>
      <ResponseConsole
        endpoint={active}
        env={env}
        payload={bodyPreview}
        response={response}
        loading={loading}
      />
    </div>
  );
}
