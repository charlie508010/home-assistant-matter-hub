import { type Request, type Response, Router } from "express";

export interface SettingsAuthResponse {
  enabled: boolean;
  username?: string;
  source: "configuration" | "none";
  managedExternally: boolean;
}

export function settingsApi(configuredAuth?: {
  username: string;
  password: string;
}): Router {
  const router = Router();

  router.get("/auth", (_req: Request, res: Response<SettingsAuthResponse>) => {
    if (configuredAuth) {
      res.json({
        enabled: true,
        username: configuredAuth.username,
        source: "configuration",
        managedExternally: true,
      });
    } else {
      res.json({ enabled: false, source: "none", managedExternally: true });
    }
  });

  router.put(
    "/auth",
    async (
      req: Request<unknown, unknown, { username: string; password: string }>,
      res: Response<SettingsAuthResponse | { error: string }>,
    ) => {
      void req;
      res.status(410).json({
        error:
          "HTTP authentication is managed via environment variables or add-on/app configuration.",
      });
    },
  );

  router.delete(
    "/auth",
    async (
      _req: Request,
      res: Response<SettingsAuthResponse | { error: string }>,
    ) => {
      res.status(410).json({
        error:
          "HTTP authentication is managed via environment variables or add-on/app configuration.",
      });
    },
  );

  return router;
}
