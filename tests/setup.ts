import { afterEach, beforeEach, vi } from "vitest";
import { resetBolnaFetchCalls, setupBolnaFetchMock } from "./bolna-mock";

beforeEach(() => {
  setupBolnaFetchMock();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetBolnaFetchCalls();
});
