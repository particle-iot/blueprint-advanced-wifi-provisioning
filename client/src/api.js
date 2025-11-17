export const deviceProtectionRequest = async (body, deviceId) => {
  const res = await fetch(`http://localhost:3000/unprotect/${deviceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Server responded with ${res.status}`);
  }
  const resJson = await res.json();
  if (resJson.ok !== true) {
    throw new Error(`Unprotect failed: ${resJson.error || "unknown error"}`);
  }
  return resJson;
};
