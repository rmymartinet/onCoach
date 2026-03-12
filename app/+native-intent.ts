export async function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (!path) {
      return "/";
    }

    const normalizedPath = path.startsWith("workoutai://")
      ? path
      : path.startsWith("/")
        ? `workoutai://${path.replace(/^\/+/, "")}`
        : `workoutai://${path}`;

    const url = new URL(normalizedPath);
    const note =
      url.searchParams.get("note") ??
      url.searchParams.get("text") ??
      url.searchParams.get("payload");

    if (note?.trim()) {
      return `/import-note?note=${encodeURIComponent(note)}`;
    }

    if (url.pathname === "/import-note") {
      return "/import-note";
    }

    return path;
  } catch {
    return path || "/";
  }
}
