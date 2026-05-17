import { handleCreateEvent } from "@/lib/api/event-routes";

export async function POST(request: Request) {
    let json: unknown;

    try {
        json = await request.json();
    } catch {
        return Response.json(
            { error: "Request body must be valid JSON." },
            { status: 400 },
        );
    }

    return handleCreateEvent(json);
}
