// Development-only fixtures. These are not backend accounts or production credentials.
export const demoEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_DEMO === "true";
export const demoCredentials = {
  teacher: { identifier: "teacher@kgamify.test", password: "DemoTeacher123!" },
  admin: { identifier: "demo.admin", password: "DemoAdmin123!" },
};
