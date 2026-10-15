const API_URL = import.meta.env.VITE_API_URL ?? "";

export type Expenditure = {
  id: number;
  date: string;
  category: string;
  subcategory: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  description: string;
};

export type ExpenditureInput = Omit<Expenditure, "id">;

type ExpenditureResponse = { expenditure?: Expenditure; error?: string };
type ExpenditureListResponse = { expenditures?: Expenditure[]; error?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const data = response.status === 204 ? undefined : await response.json();
  if (!response.ok) {
    const error = (data as { error?: string } | undefined)?.error;
    throw new Error(error || "The expenditure request failed.");
  }
  return data as T;
}

export async function getExpenditures(): Promise<Expenditure[]> {
  const data = await request<ExpenditureListResponse>("/api/expenditures");
  return data.expenditures ?? [];
}

export async function createExpenditure(
  expenditure: ExpenditureInput,
): Promise<Expenditure> {
  const data = await request<ExpenditureResponse>("/api/expenditures", {
    method: "POST",
    body: JSON.stringify(expenditure),
  });
  if (!data.expenditure) throw new Error("The API returned no expenditure.");
  return data.expenditure;
}

export async function updateExpenditure(
  id: number,
  expenditure: ExpenditureInput,
): Promise<Expenditure> {
  const data = await request<ExpenditureResponse>(`/api/expenditures/${id}`, {
    method: "PUT",
    body: JSON.stringify(expenditure),
  });
  if (!data.expenditure) throw new Error("The API returned no expenditure.");
  return data.expenditure;
}

export async function deleteExpenditure(id: number): Promise<void> {
  await request<void>(`/api/expenditures/${id}`, { method: "DELETE" });
}
