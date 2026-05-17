import { handleUpdateEvent } from "@/lib/api/event-routes";
import { isUuid } from "@/lib/utils";

export async function PATCH(
    request: Request,
    context: { params: Promise<{ eventId: string }> },
) {
    const { eventId } = await context.params;

    if (!isUuid(eventId)) {
        return Response.json({ error: "Invalid event ID." }, { status: 400 });
    }

    let json: unknown;

    try {
        json = await request.json();
    } catch {
        return Response.json(
            { error: "Request body must be valid JSON." },
            { status: 400 },
        );
    }

    return handleUpdateEvent(eventId, json);
}
