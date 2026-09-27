"use strict";

const request = require("supertest");
const app = require("../src/app");
const Owner = require("../src/models/Owner");
const Learner = require("../src/models/Learner");
const { connectTestDB, clearTestDB, disconnectTestDB } = require("./testUtils");

beforeAll(async () => {
  await connectTestDB();
});
afterEach(async () => {
  await clearTestDB();
});
afterAll(async () => {
  await disconnectTestDB();
});

async function ownerToken() {
  const passwordHash = await Owner.hashPassword("OwnerPass123");
  await Owner.create({ name: "Owner", loginId: "owner@test.com", passwordHash });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ loginId: "owner@test.com", password: "OwnerPass123", role: "owner" });
  return login.body.data.accessToken;
}

describe("Attendance check-in / check-out", () => {
  it("checks a student in", async () => {
    const token = await ownerToken();
    const student = await Learner.create({ name: "S1", mobile: "1", admissionDate: new Date() });

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send({ studentId: student.id });

    expect(res.status).toBe(201);
    expect(res.body.data.checkIn).toBeDefined();
    expect(res.body.data.checkOut).toBeNull();
  });

  it("rejects a second check-in while already checked in", async () => {
    const token = await ownerToken();
    const student = await Learner.create({ name: "S1", mobile: "1", admissionDate: new Date() });

    await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send({ studentId: student.id });

    const res = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send({ studentId: student.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_CHECKED_IN");
  });

  it("checks a student out and computes duration", async () => {
    const token = await ownerToken();
    const student = await Learner.create({ name: "S1", mobile: "1", admissionDate: new Date() });

    const checkIn = await request(app)
      .post("/api/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send({ studentId: student.id });

    const res = await request(app)
      .post(`/api/attendance/${checkIn.body.data._id}/checkout`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.checkOut).toBeDefined();
    expect(res.body.data.durationMinutes).toBeGreaterThanOrEqual(0);
  });
});
