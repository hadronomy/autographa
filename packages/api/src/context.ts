// oxlint-disable-next-line no-empty-pattern
export async function createContext({}: { req: Request }) {
  return {};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
