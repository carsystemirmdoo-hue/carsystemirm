import assert from "node:assert/strict";
import test from "node:test";
import {
  ROLLER_DARK,
  ROLLER_LIGHT,
  catalogRollerColor,
} from "./catalogRollerColor.mjs";

const RED = "#E30613";

test("van abraziva i traka pravilo ne važi (farba zadržava svoju nijansu)", () => {
  assert.equal(
    catalogRollerColor({ categorySlugs: ["boje"], brandColor: RED, shade: "#503F37", coarse: [] }),
    undefined,
  );
});

test("smeđi F19 disk dobija boju brenda, ne smeđu", () => {
  assert.equal(
    catalogRollerColor({
      categorySlugs: ["abrazivi"],
      brandColor: RED,
      shade: "#503F37",
      coarse: [{ hex: "#53433a", share: 0.6 }],
    }),
    RED,
  );
});

test("crveni podložak na crvenom brendu dobija kontrast, ne crvenu", () => {
  assert.equal(
    catalogRollerColor({
      categorySlugs: ["abrazivi"],
      brandColor: RED,
      shade: null,
      coarse: [{ hex: "#cb2a2d", share: 0.55 }, { hex: "#1a1a1a", share: 0.2 }],
    }),
    ROLLER_LIGHT,
  );
});

test("traka bez boje brenda: kontrast prema svetlini proizvoda", () => {
  assert.equal(
    catalogRollerColor({ categorySlugs: ["maskiranje"], brandColor: null, shade: "#E6E3DD", coarse: [] }),
    ROLLER_DARK,
  );
  assert.equal(
    catalogRollerColor({ categorySlugs: ["maskiranje"], brandColor: null, shade: "#070A09", coarse: [] }),
    ROLLER_LIGHT,
  );
});
