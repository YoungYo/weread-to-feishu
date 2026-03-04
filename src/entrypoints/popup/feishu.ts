const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";

type JsonObject = Record<string, unknown>;

export type FeishuAuthInput = {
  appId: string;
  appSecret: string;
  tenantAccessToken?: string;
};

export type FeishuDocIds = {
  docToken: string;
  url: string;
};

function sanitizeJsonText(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/^\)\]\}',?\s*/, "")
    .replace(/^for\s*\(;;\);\s*/i, "")
    .trim();
}

async function readJsonResponse(response: Response, action: string): Promise<JsonObject> {
  const raw = await response.text();
  const cleaned = sanitizeJsonText(raw);

  if (!cleaned) {
    throw new Error(`${action} failed: empty response (HTTP ${response.status})`);
  }

  try {
    return JSON.parse(cleaned) as JsonObject;
  } catch {
    throw new Error(`${action} 返回了非 JSON 响应（HTTP ${response.status}）：${raw.slice(0, 180)}`);
  }
}

function ensureOk<T extends { code?: number; msg?: string }>(res: T, action: string): T {
  if (res.code && res.code !== 0) {
    if ((res.msg ?? "").toLowerCase().includes("forbidden")) {
      throw new Error(`${action} failed: forbidden（应用权限或文档授权不足）`);
    }
    throw new Error(`${action} failed: ${res.msg ?? "unknown error"}`);
  }
  return res;
}

export async function getTenantAccessToken(input: FeishuAuthInput): Promise<string> {
  if (input.tenantAccessToken?.trim()) {
    return input.tenantAccessToken.trim();
  }

  if (!input.appId || !input.appSecret) {
    throw new Error("Please provide App ID and App Secret, or an existing tenant_access_token.");
  }

  const response = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: input.appId,
      app_secret: input.appSecret,
    }),
  });

  const data = ensureOk(await readJsonResponse(response, "Get tenant_access_token"), "Get tenant_access_token");
  const token = data.tenant_access_token;
  if (typeof token !== "string" || !token) {
    throw new Error("No tenant_access_token returned from Feishu.");
  }
  return token;
}

export function extractDocToken(docUrl: string): FeishuDocIds {
  const trimmed = docUrl.trim();
  const match = trimmed.match(/\/docx\/([a-zA-Z0-9]+)/);
  if (!match) {
    throw new Error("Invalid Feishu doc URL. Expect format like https://xxx.feishu.cn/docx/XXXX");
  }

  return {
    docToken: match[1],
    url: trimmed,
  };
}

export async function listRootBlocks(
  docToken: string,
  token: string,
): Promise<Array<{ block_id: string; block_type?: number; parent_id?: string }>> {
  const response = await fetch(`${FEISHU_API_BASE}/docx/v1/documents/${docToken}/blocks/${docToken}/children?page_size=500`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = ensureOk(await readJsonResponse(response, "List document blocks"), "List document blocks");
  return (data?.data as { items?: Array<{ block_id: string; block_type?: number; parent_id?: string }> })?.items ?? [];
}

export async function deleteBlocksByIndexRange(docToken: string, token: string, startIndex: number, endIndex: number): Promise<void> {
  if (endIndex <= startIndex) {
    return;
  }

  const response = await fetch(`${FEISHU_API_BASE}/docx/v1/documents/${docToken}/blocks/${docToken}/children/batch_delete`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      start_index: startIndex,
      end_index: endIndex,
    }),
  });

  ensureOk(await readJsonResponse(response, "Delete document blocks"), "Delete document blocks");
}

export async function convertMarkdownToBlocks(markdown: string, token: string): Promise<{ blocks: unknown[]; firstLevelIds: string[] }> {
  const response = await fetch(`${FEISHU_API_BASE}/docx/v1/documents/convert`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content_type: "markdown",
      content: markdown,
    }),
  });

  const data = ensureOk(await readJsonResponse(response, "Convert markdown to Feishu blocks"), "Convert markdown to Feishu blocks");
  const payload = (data?.data ?? {}) as { blocks?: unknown[]; first_level_block_ids?: string[] };

  return {
    blocks: payload.blocks ?? [],
    firstLevelIds: payload.first_level_block_ids ?? [],
  };
}

export async function appendBlocks(docToken: string, token: string, children: unknown[]): Promise<void> {
  if (!children.length) {
    return;
  }

  const response = await fetch(`${FEISHU_API_BASE}/docx/v1/documents/${docToken}/blocks/${docToken}/children`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ children }),
  });

  ensureOk(await readJsonResponse(response, "Create document blocks"), "Create document blocks");
}

export async function overwriteDocWithMarkdown(docToken: string, token: string, markdown: string): Promise<void> {
  const items = await listRootBlocks(docToken, token);
  if (items.length > 0) {
    await deleteBlocksByIndexRange(docToken, token, 0, items.length);
  }

  const converted = await convertMarkdownToBlocks(markdown, token);

  const idSet = new Set(converted.firstLevelIds);
  const sortedBlocks = converted.firstLevelIds
    .map((id) => (converted.blocks as Array<{ block_id?: string }>).find((b) => b.block_id === id))
    .filter(Boolean);
  const remaining = (converted.blocks as Array<{ block_id?: string }>).filter((b) => !idSet.has(b.block_id ?? ""));

  await appendBlocks(docToken, token, [...sortedBlocks, ...remaining]);
}
