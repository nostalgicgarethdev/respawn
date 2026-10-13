import assert from "node:assert/strict"
import { test } from "node:test"
import { chance, roll, shouldMint, stepSpeed } from "../src/rules.ts"

test("speed climbs until the cap", () => {
  assert.equal(stepSpeed(6, 0.5, 13), 6.5)
  assert.equal(stepSpeed(12.8, 0.5, 13), 13)
  assert.equal(stepSpeed(13, 0.5, 13), 13)
})

test("a zero total returns the first row", () => {
  const table = [
    { id: "dust", name: "dust", weight: 0 },
    { id: "mint", name: "DROP", weight: 0 },
  ]
  assert.equal(roll(table, () => 0.9).id, "dust")
})

test("weights pick the row the roll lands in", () => {
  const table = [
    { id: "dust", name: "dust", weight: 70 },
    { id: "chip", name: "chip", weight: 25 },
    { id: "mint", name: "DROP", weight: 5 },
  ]
  assert.equal(roll(table, () => 0).id, "dust")
  assert.equal(roll(table, () => 0.7).id, "chip")
  assert.equal(roll(table, () => 0.99).id, "mint")
})

test("a mint lands on every exact multiple", () => {
  assert.equal(shouldMint(10, 10), true)
  assert.equal(shouldMint(11, 10), false)
  assert.equal(shouldMint(0, 10), false)
  assert.equal(shouldMint(4, 0), false)
})

test("chance is a share of the table", () => {
  assert.equal(chance(5, 100), 5)
  assert.equal(chance(0, 100), 0)
  assert.equal(chance(5, 0), 0)
})
