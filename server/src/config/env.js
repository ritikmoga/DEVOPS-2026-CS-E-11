import "dotenv/config";

function readNumber(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? fallback, 10);
  return Number.isFinite(value) ? value : fallback;
}

export const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: readNumber("PORT", 5000),
  MONGO_URI: process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/eventflow"
});
