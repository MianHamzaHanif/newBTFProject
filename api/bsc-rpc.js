const RPC_ENDPOINTS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed.bnbchain.org",
];

// Only read-only JSON-RPC methods are proxied. Wallet transactions never go
// through this route; they continue to be signed and broadcast by the user.
const ALLOWED_METHODS = new Set([
  "eth_chainId", "eth_blockNumber", "eth_call", "eth_getBalance",
  "eth_getBlockByNumber", "eth_getBlockByHash", "eth_getLogs",
  "eth_getTransactionByHash", "eth_getTransactionReceipt", "eth_getCode",
]);

const readBody = async (request) => {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body);
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
};

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).json({ error: "POST only" });

  let payload;
  try {
    payload = await readBody(request);
  } catch {
    return response.status(400).json({ error: "Invalid JSON-RPC body" });
  }
  const calls = Array.isArray(payload) ? payload : [payload];
  if (!calls.length || calls.some((call) => !ALLOWED_METHODS.has(call?.method))) {
    return response.status(403).json({ error: "Read-only RPC method required" });
  }

  let lastError;
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await upstream.text();
      if (!upstream.ok) throw new Error(`RPC ${upstream.status}`);
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("content-type", "application/json");
      return response.status(200).send(body);
    } catch (error) {
      lastError = error;
    }
  }
  return response.status(502).json({ error: "BSC read RPC unavailable", detail: lastError?.message || "unknown" });
}
