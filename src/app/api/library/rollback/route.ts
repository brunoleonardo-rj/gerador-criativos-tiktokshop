import { requireSession, enforceSameOrigin } from "@/features/auth/request-guard"; import { makeLibraryHandlers } from "@/features/library/library-handler"; import { getLibraryService } from "@/features/library/route-service";
export async function POST(request: Request) { return (makeLibraryHandlers({ service: await getLibraryService(), requireSession, enforceSameOrigin })).ROLLBACK(request); }
