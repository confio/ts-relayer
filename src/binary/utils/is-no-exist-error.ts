export function isNoExistError(err: unknown): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof err === "object" && (err as any).code === "ENOENT";
}
