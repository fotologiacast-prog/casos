type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

const base64Url = (input: Buffer | string) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const getServiceAccount = (): ServiceAccount => {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const json = encoded ? Buffer.from(encoded, "base64").toString("utf8") : raw;

  if (!json) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 ausente.");
  }

  return JSON.parse(json);
};

const signJwt = async (serviceAccount: ServiceAccount) => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: DRIVE_SCOPE,
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const crypto = await import("crypto");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key);
  return `${unsignedJwt}.${base64Url(signature)}`;
};

export const getGoogleAccessToken = async () => {
  const serviceAccount = getServiceAccount();
  const assertion = await signJwt(serviceAccount);

  const response = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Falha ao autenticar no Google.");
  }

  return data.access_token as string;
};

const driveRequest = async (accessToken: string, path: string, init: RequestInit = {}) => {
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "Falha na API do Google Drive.");
  }
  return data;
};

const escapeDriveQuery = (value: string) => value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export const findDriveFolder = async (accessToken: string, parentId: string, name: string) => {
  const query = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `'${escapeDriveQuery(parentId)}' in parents`,
    `name = '${escapeDriveQuery(name)}'`,
  ].join(" and ");

  const data = await driveRequest(
    accessToken,
    `/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`
  );

  return data.files?.[0] || null;
};

export const createDriveFolder = async (accessToken: string, parentId: string, name: string) => {
  const data = await driveRequest(accessToken, "/files?fields=id,name&supportsAllDrives=true", {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });

  return data as { id: string; name: string };
};

export const findOrCreateDriveFolder = async (accessToken: string, parentId: string, name: string) => {
  const existing = await findDriveFolder(accessToken, parentId, name);
  if (existing) return existing as { id: string; name: string };
  return createDriveFolder(accessToken, parentId, name);
};

export const sanitizeDriveFolderName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
