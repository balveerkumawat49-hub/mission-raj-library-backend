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

describe("Learner CRUD (owner)", () => {
  it("creates a learner with valid data", async () => {
    const token = await ownerToken();

    const res = await request(app)
      .post("/api/learners")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Asha Sharma",
        mobile: "9876543210",
        email: "asha@example.com",
        admissionDate: "2026-01-01",
        totalFee: 3000,
        paidFee: 1000
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Asha Sharma");
    expect(res.body.data.pendingFee).toBe(2000);
  });

  it("rejects creation with missing required fields", async () => {
    const token = await ownerToken();

    const res = await request(app)
      .post("/api/learners")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "" });

    expect(res.status).toBe(422);
  });

  it("lists learners with pagination metadata", async () => {
    const token = await ownerToken();
    await Learner.create({ name: "A", mobile: "1", admissionDate: new Date() });
    await Learner.create({ name: "B", mobile: "2", admissionDate: new Date() });

    const res = await request(app).get("/api/learners").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta.total).toBe(2);
  });
});

describe("Student self-service isolation", () => {
  it("blocks a student from reading another student's record", async () => {
    const passwordHash = await Learner.hashPassword("Pass12345");
    const studentA = await Learner.create({
      name: "Student A",
      mobile: "1111111111",
      admissionDate: new Date(),
      loginId: "a@test.com",
      passwordHash
    });
    const studentB = await Learner.create({
      name: "Student B",
      mobile: "2222222222",
      admissionDate: new Date()
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "a@test.com", password: "Pass12345", role: "student" });

    const ownRes = await request(app)
      .get(`/api/learners/${studentA.id}`)
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(ownRes.status).toBe(200);

    const otherRes = await request(app)
      .get(`/api/learners/${studentB.id}`)
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(otherRes.status).toBe(403);
  });
});
