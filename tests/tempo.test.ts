import { it, expect } from "vitest";
import { janelaDiaSeguinte, janelaDiaAnterior, formatarQuando } from "../src/lib/tempo";

it("janelaDiaSeguinte cobre o dia seguinte em BRT", () => {
  const { de, ate } = janelaDiaSeguinte(new Date("2026-06-03T12:00:00Z"));
  // 04/06 00:00 BRT = 04/06 03:00 UTC ; 04/06 23:59:59 BRT = 05/06 02:59:59 UTC
  expect(de).toBe("2026-06-04T03:00:00.000Z");
  expect(ate).toBe("2026-06-05T02:59:59.999Z");
});

it("formatarQuando mostra dia e hora em BRT", () => {
  const s = formatarQuando("2026-06-04T17:00:00Z"); // 14h BRT (UTC-3)
  expect(s).toContain("14");
  expect(s).toContain("04/06");
});

it("janelaDiaAnterior cobre o dia anterior em BRT", () => {
  const { de, ate } = janelaDiaAnterior(new Date("2026-06-03T12:00:00Z"));
  // 02/06 00:00 BRT = 02/06 03:00 UTC ; 02/06 23:59:59.999 BRT = 03/06 02:59:59.999 UTC
  expect(de).toBe("2026-06-02T03:00:00.000Z");
  expect(ate).toBe("2026-06-03T02:59:59.999Z");
});
