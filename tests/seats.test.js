"use strict";

const request = require("supertest");
const app = require("../src/app");
const Owner = require("../src/models/Owner");
const Learner = require("../src/models/Learner");
const Seat = require("../src/models/Seat");
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

describe("Seat allocation", () => {
  it("assigns a seat to a student and marks it occupied", async () => {
    const token = await ownerToken();
    const seat = await Seat.create({ seatNumber: "A1" });
    const student = await Learner.create({ name: "S1", mobile: "1", admissionDate: new Date() });

    const res = await request(app)
      .post("/api/seat-allocations")
      .set("Authorization", `Bearer ${token}`)
      .send({ seatId: seat.id, studentId: student.id });

    expect(res.status).toBe(201);

    const seatRes = await request(app).get("/api/seats").set("Authorization", `Bearer ${token}`);
    const updatedSeat = seatRes.body.data.find((s) => s._id === seat.id);
    expect(updatedSeat.status).toBe("occupied");
    expect(updatedSeat.student.id).toBe(student.id);
  });

  it("prevents double-allocating an already-occupied seat", async () => {
    const token = await ownerToken();
    const seat = await Seat.create({ seatNumber: "A2" });
    const s1 = await Learner.create({ name: "S1", mobile: "1", admissionDate: new Date() });
    const s2 = await Learner.create({ name: "S2", mobile: "2", admissionDate: new Date() });

    await request(app)
      .post("/api/seat-allocations")
      .set("Authorization", `Bearer ${token}`)
      .send({ seatId: seat.id, studentId: s1.id });

    const res = await request(app)
      .post("/api/seat-allocations")
      .set("Authorization", `Bearer ${token}`)
      .send({ seatId: seat.id, studentId: s2.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SEAT_ALREADY_OCCUPIED");
  });

  it("releases a seat and makes it available again", async () => {
    const token = await ownerToken();
    const seat = await Seat.create({ seatNumber: "A3" });
    const student = await Learner.create({ name: "S1", mobile: "1", admissionDate: new Date() });

    await request(app)
      .post("/api/seat-allocations")
      .set("Authorization", `Bearer ${token}`)
      .send({ seatId: seat.id, studentId: student.id });

    const releaseRes = await request(app)
      .post(`/api/seat-allocations/${seat.id}/release`)
      .set("Authorization", `Bearer ${token}`);

    expect(releaseRes.status).toBe(200);

    const updated = await Seat.findById(seat.id);
    expect(updated.status).toBe("available");
  });
});
