export type SubjectReputation = {
  score: number;
  completed: number;
};

type SubjectIdentityPayload = {
  subjectId?: string | number | null;
  subject_id?: string | number | null;
  id?: string | number | null;
};

type ReputationPayload = {
  score?: number | string | null;
  completed?: number | string | null;
  experiments?: number | string | null;
};

const toSubjectId = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "bigint") return Number(value);
  return null;
};

const jsonOrNull = async (resp: Response): Promise<any | null> => {
  try {
    return await resp.json();
  } catch {
    return null;
  }
};

export const registryApi = {
  async getSubjectIdForAddress(address?: string | null): Promise<string | null> {
    if (!address) return null;
    const params = new URLSearchParams({ address });
    const resp = await fetch(`/api/registry/subject?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (resp.status === 404) return null;
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(text || `registry lookup failed (HTTP ${resp.status})`);
    }

    const payload = (await jsonOrNull(resp)) as SubjectIdentityPayload | null;
    if (!payload) return null;
    return (
      toSubjectId(payload.subjectId) ??
      toSubjectId(payload.subject_id) ??
      toSubjectId(payload.id) ??
      null
    );
  },
};

export const reputationApi = {
  async getReputation(subjectId?: string | null): Promise<SubjectReputation | null> {
    if (!subjectId) return null;
    const params = new URLSearchParams({ subjectId });
    const resp = await fetch(`/api/reputation?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (resp.status === 404) return null;
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(text || `reputation lookup failed (HTTP ${resp.status})`);
    }

    const payload = (await jsonOrNull(resp)) as ReputationPayload | null;
    if (!payload) return null;

    const score = toNumber(payload.score);
    const completed = toNumber(payload.completed ?? payload.experiments);

    if (score === null && completed === null) return null;
    return {
      score: score ?? 0,
      completed: completed ?? 0,
    };
  },
};
