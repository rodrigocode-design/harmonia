import test from "node:test";
import assert from "node:assert/strict";
import { buildBookingLockKeys, ConflictError } from "../lib/access.ts";

class AtomicLockStore {
  private locks = new Set<string>();
  async reserve(keys: string[]) {
    await Promise.resolve();
    if (keys.some((key) => this.locks.has(key))) throw new ConflictError("Horário ocupado");
    for (const key of keys) this.locks.add(key);
    return true;
  }
}

test("duas reservas concorrentes para o mesmo recurso: somente uma confirma", async () => {
  const store = new AtomicLockStore();
  const keys = buildBookingLockKeys({ schoolId: "school", startsAt: "2026-10-05T15:00:00Z", endsAt: "2026-10-05T16:00:00Z", bufferMinutes: 10, resources: [{ type: "TEACHER", id: "teacher" }, { type: "ROOM", id: "room" }] });
  const results = await Promise.allSettled([store.reserve(keys), store.reserve(keys)]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.filter((item) => item.status === "rejected").length, 1);
});

test("reservas sem recursos em comum podem coexistir", async () => {
  const store = new AtomicLockStore();
  const base = { schoolId: "school", startsAt: "2026-10-05T15:00:00Z", endsAt: "2026-10-05T16:00:00Z", bufferMinutes: 10 };
  const [a,b] = await Promise.all([store.reserve(buildBookingLockKeys({ ...base, resources: [{ type: "TEACHER", id: "a" }] })), store.reserve(buildBookingLockKeys({ ...base, resources: [{ type: "TEACHER", id: "b" }] }))]);
  assert.equal(a && b, true);
});
