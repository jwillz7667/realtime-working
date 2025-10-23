import twilioClient from "@/lib/twilio";

interface RecordingRequest {
  action: "start" | "stop";
  callSid: string;
  recordingSid?: string;
  options?: Record<string, unknown>;
}

function requireTwilioClient() {
  if (!twilioClient) {
    throw new Error("Twilio client not initialized");
  }
  return twilioClient;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecordingRequest;
    const { action, callSid, recordingSid, options } = body;

    if (!action || !callSid) {
      return Response.json(
        { error: "Missing action or callSid" },
        { status: 400 }
      );
    }

    const client = requireTwilioClient();

    if (action === "start") {
      const recording = await client.calls(callSid).recordings.create({
        // default to dual-channel for analytics; callers can override via options
        recordingChannels: "dual",
        trim: "do-not-trim",
        ...(options || {}),
      });

      return Response.json({
        recordingSid: recording.sid,
        status: recording.status,
        duration: recording.duration,
        uri: recording.uri,
      });
    }

    if (action === "stop") {
      if (!recordingSid) {
        return Response.json(
          { error: "recordingSid required to stop recording" },
          { status: 400 }
        );
      }

      const recording = await client
        .calls(callSid)
        .recordings(recordingSid)
        .update({ status: "stopped" });

      return Response.json({
        recordingSid: recording.sid,
        status: recording.status,
        duration: recording.duration,
        uri: recording.uri,
      });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error: any) {
    console.error("Call recording error", error);
    const message = error?.message || "Failed to process recording request";
    if (message === "Twilio client not initialized") {
      return Response.json({ error: message }, { status: 500 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const client = requireTwilioClient();
    const url = new URL(request.url);
    const callSid = url.searchParams.get("callSid");
    const limitParam = url.searchParams.get("limit");
    const dateCreatedAfter = url.searchParams.get("dateCreatedAfter");
    const limit = Math.min(
      Math.max(Number.parseInt(limitParam || "25", 10) || 25, 1),
      100
    );

    const listArgs: Record<string, any> = { limit };
    if (dateCreatedAfter) {
      const parsedDate = new Date(dateCreatedAfter);
      if (!Number.isNaN(parsedDate.getTime())) {
        listArgs.dateCreatedAfter = parsedDate;
      }
    }

    const recordings = callSid
      ? await client.calls(callSid).recordings.list(listArgs)
      : await client.recordings.list(listArgs);

    const normalized = recordings.map((recording) => {
      const anyRecording = recording as any;
      const mediaUrlFromLinks = anyRecording.links?.media
        ? `https://api.twilio.com${anyRecording.links.media}`
        : null;
      const mediaUrl = anyRecording.mediaUrl || mediaUrlFromLinks;

      return {
        sid: recording.sid,
        callSid: recording.callSid,
        status: recording.status,
        duration: recording.duration,
        channels: anyRecording.channels ?? null,
        format: anyRecording.format ?? null,
        dateCreated: recording.dateCreated?.toISOString() ?? null,
        dateUpdated: recording.dateUpdated?.toISOString() ?? null,
        mediaUrl,
      };
    });

    return Response.json({ recordings: normalized });
  } catch (error: any) {
    console.error("Failed to fetch recordings", error);
    const message = error?.message || "Failed to fetch recordings";
    if (message === "Twilio client not initialized") {
      return Response.json({ error: message }, { status: 500 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
