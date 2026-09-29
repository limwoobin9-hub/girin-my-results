import { StudentSession, girinFetch } from "@/lib/girin-session";
import { parseAssessments } from "@/lib/assessments";

export async function getOwnResults(session: StudentSession) {
  const response = await girinFetch(`/api/my/${session.id}/homeworks`, session);
  if (!response.ok) throw new Error(`Girin HTTP ${response.status}`);
  const items = parseAssessments(await response.json());
  if (!items) throw new Error("Unexpected Girin response");
  return items;
}
