import path from "path";

export function getDefaultHomePath() {
  if (!process.env.HOME) {
    throw new Error("$HOME environment variable is not set.");
  }
  return path.join(process.env.HOME, ".ibc-setup");
}
