import twilioClient from "@/lib/twilio";
import { getRealtimeHttpUrl } from "@/lib/realtime-server";

const { TWILIO_OUTBOUND_NUMBER, TWILIO_TWIML_URL } = process.env;

async function resolveWebsocketTwimlUrl(): Promise<string | null> {
  if (TWILIO_TWIML_URL) {
    return TWILIO_TWIML_URL;
  }

  try {
    const res = await fetch(getRealtimeHttpUrl("/public-url"), {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.publicUrl) return null;
    const base = String(data.publicUrl).replace(/\/$/, "");
    return `${base}/twiml`;
  } catch (err) {
    console.error("Unable to read websocket public URL", err);
    return null;
  }
}

export async function POST(request: Request) {
  if (!twilioClient) {
    return Response.json(
      { error: "Twilio client not initialized" },
      { status: 500 }
    );
  }

  const { to, from } = await request.json();

  const callerId = from || TWILIO_OUTBOUND_NUMBER;
  if (!callerId) {
    return Response.json(
      {
        error:
          "Missing caller ID. Provide `from` in the request or set TWILIO_OUTBOUND_NUMBER in the environment.",
      },
      { status: 400 }
    );
  }

  if (!to) {
    return Response.json(
      { error: "Missing 'to' number" },
      { status: 400 }
    );
  }

  const twimlUrl = await resolveWebsocketTwimlUrl();
  if (!twimlUrl) {
    return Response.json(
      {
        error:
          "Realtime TwiML URL unavailable. Ensure the websocket server is running with PUBLIC_URL set, or configure TWILIO_TWIML_URL.",
      },
      { status: 500 }
    );
  }

  try {
    const call = await twilioClient.calls.create({
      to,
      from: callerId,
      url: twimlUrl,
      method: "POST",
      record: true, // Automatically record all outgoing calls
      recordingChannels: "dual", // Record both channels separately
      recordingStatusCallback: undefined, // Optional: add webhook URL for recording events
      recordingStatusCallbackMethod: "POST",
    });

    return Response.json({ sid: call.sid, status: call.status });
  } catch (error: any) {
    console.error("Failed to initiate outgoing call", error);
    return Response.json(
      {
        error: error?.message || "Failed to initiate outgoing call",
      },
      { status: 500 }
    );
  }
}
