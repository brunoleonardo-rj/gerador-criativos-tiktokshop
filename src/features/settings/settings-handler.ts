import "server-only";
import { z } from "zod";
import type { PublicSettings, SettingsService } from "./service";
import { validateVeoTemplate } from "./veo-template";

const updateSchema = z.object({
  apiKey: z.string().max(500).optional(),
  model: z.string().trim().min(1).max(120),
  veoTemplate: z.string().trim().min(1).max(20_000),
}).strict();

type SettingsServiceApi = Pick<SettingsService, "getPublic" | "update" | "deleteApiKey">;

type SettingsHandlerDependencies = {
  service: SettingsServiceApi;
  requireSession: (request: Request) => Promise<unknown>;
  enforceSameOrigin: (request: Request) => void;
};

function isJsonRequest(request: Request) {
  return request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

function publicResponse(settings: PublicSettings) {
  return Response.json({ ...settings, updatedAt: settings.updatedAt.toISOString() });
}

function invalidData() {
  return Response.json({ message: "Dados de configuração inválidos" }, { status: 422 });
}

async function authenticate(request: Request, requireSession: SettingsHandlerDependencies["requireSession"]) {
  try {
    await requireSession(request);
    return true;
  } catch {
    return false;
  }
}

export function makeSettingsHandlers(deps: SettingsHandlerDependencies) {
  return {
    async GET(request: Request): Promise<Response> {
      if (!(await authenticate(request, deps.requireSession))) return new Response(null, { status: 401 });
      try {
        return publicResponse(await deps.service.getPublic());
      } catch {
        return Response.json({ message: "Não foi possível carregar as configurações" }, { status: 500 });
      }
    },

    async PUT(request: Request): Promise<Response> {
      try {
        deps.enforceSameOrigin(request);
      } catch {
        return Response.json({ message: "Solicitação inválida" }, { status: 403 });
      }
      if (!(await authenticate(request, deps.requireSession))) return new Response(null, { status: 401 });
      if (!isJsonRequest(request)) return Response.json({ message: "Content-Type deve ser application/json" }, { status: 415 });

      let input: z.infer<typeof updateSchema>;
      try {
        input = updateSchema.parse(await request.json());
      } catch {
        return invalidData();
      }
      if (!validateVeoTemplate(input.veoTemplate).valid) return invalidData();

      try {
        const apiKey = input.apiKey?.trim();
        return publicResponse(await deps.service.update({
          model: input.model,
          veoTemplate: input.veoTemplate,
          ...(apiKey ? { apiKey } : {}),
        }));
      } catch {
        return Response.json({ message: "Não foi possível salvar as configurações" }, { status: 500 });
      }
    },

    async DELETE_API_KEY(request: Request): Promise<Response> {
      try {
        deps.enforceSameOrigin(request);
      } catch {
        return Response.json({ message: "Solicitação inválida" }, { status: 403 });
      }
      if (!(await authenticate(request, deps.requireSession))) return new Response(null, { status: 401 });
      try {
        await deps.service.deleteApiKey();
        return new Response(null, { status: 204 });
      } catch {
        return Response.json({ message: "Não foi possível remover a credencial" }, { status: 500 });
      }
    },
  };
}
