const requireValue = (name: string, value: string | undefined | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return trimmed;
};

export const requireUrlEnv = (name: string, value: string | undefined | null) => {
  const resolved = requireValue(name, value);
  try {
    // Validate that callers did not provide a malformed URL.
    void new URL(resolved);
    return resolved;
  } catch {
    throw new Error(`Environment variable ${name} must be a valid URL.`);
  }
};

export const requireEnv = requireValue;
