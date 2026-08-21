import { expect, it } from "vitest";
import { GET } from "./route";

it("expõe somente o estado do processo", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
