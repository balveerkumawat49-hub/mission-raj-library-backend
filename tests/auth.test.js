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

async function createOwner(overrides = {}) {
  const passwordHash = await Owner.hashPassword(overrides.password || "OwnerPass123");
  return Owner.create({
    name: "Test Owner",
    loginId: "owner@test.com",
    passwordHash,
    ...overrides
  });
}

describe("POST /api/auth/login", () => {
  it("logs in a valid owner and returns tokens", async () => {
    await createOwner();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "owner@test.com", password: "OwnerPass123", role: "owner" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.role).toBe("owner");
  });

  it("rejects an invalid password", async () => {
    await createOwner();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "owner@test.com", password: "wrong-password", role: "owner" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a missing loginId with a 422", async () => {
    const res = await request(app).post("/api/auth/login").send({ password: "x" });
    expect(res.status).toBe(422);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current owner profile with a valid token", async () => {
    await createOwner();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "owner@test.com", password: "OwnerPass123", role: "owner" });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("owner");
  });
});

describe("Role based access control", () => {
  it("prevents a student from accessing an owner-only endpoint", async () => {
    const passwordHash = await Learner.hashPassword("StudentPass123");
    await Learner.create({
      name: "Student One",
      mobile: "9999999999",
      admissionDate: new Date(),
      loginId: "student1@test.com",
      passwordHash
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "student1@test.com", password: "StudentPass123", role: "student" });

    expect(login.status).toBe(200);

    const res = await request(app)
      .get("/api/learners")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(403);
  });
});

describe("POST /api/auth/change-password", () => {
  it("changes the password and revokes old sessions", async () => {
    await createOwner();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "owner@test.com", password: "OwnerPass123", role: "owner" });

    const token = login.body.data.accessToken;

    const changeRes = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "OwnerPass123", newPassword: "NewOwnerPass456" });

    expect(changeRes.status).toBe(200);

    const reLogin = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "owner@test.com", password: "NewOwnerPass456", role: "owner" });

    expect(reLogin.status).toBe(200);
  });
});
