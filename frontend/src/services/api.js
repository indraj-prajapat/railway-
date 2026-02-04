import { BASE_API } from "@/config/setting";

const API_BASE = `${BASE_API}/api`;
const DOC_API = `${API_BASE}/documents`;

export async function getExplorer(token) {
  const res = await fetch(`${DOC_API}/explorer`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Explorer fetch failed: ${res.status}`);
  return res.json();
}

export async function newSearch(token, payload) {
  const res = await fetch(`${DOC_API}/new-search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

export async function getOnlyOfficeToken(config) {
  const res = await fetch(`${DOC_API}/onlyoffice/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`OnlyOffice token failed: ${res.status}`);
  return res.json();
}
