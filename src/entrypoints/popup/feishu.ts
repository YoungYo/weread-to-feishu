const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";

export type FeishuAuthInput = {
  appId: string;
  appSecret: string;
  tenantAccessToken?: string;
};

export type FeishuDocIds = {
  docToken: string;
  url: string;
};

function ensureOk<T extends { code?: number; msg?: string }>(res: T, action: string): T {
  if (res.code && res.code !== 0) {
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

  const data = ensureOk(await response.json(), "Get tenant_access_token");
  if (!data.tenant_access_token) {
    throw new Error("No tenant_access_token returned from Feishu.");
  }
  return data.tenant_access_token;
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

export async function listRootBlocks(docToken: string, token: string): Promise<Array<{ block_id: string; block_type?: number; parent_id?: string }>> {
  const response = await fetch(`${FEISHU_API_BASE}/docx/v1/documents/${docToken}/blocks/${docToken}/children?page_size=500`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = ensureOk(await response.json(), "List document blocks");
  return data?.data?.items ?? [];
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

  ensureOk(await response.json(), "Delete document blocks");
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

  const data = ensureOk(await response.json(), "Convert markdown to Feishu blocks");
  return {
    blocks: data?.data?.blocks ?? [],
    firstLevelIds: data?.data?.first_level_block_ids ?? [],
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

  ensureOk(await response.json(), "Create document blocks");
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
