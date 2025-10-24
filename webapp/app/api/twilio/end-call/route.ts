import twilioClient from "@/lib/twilio";

export async function POST(request: Request) {
  if (!twilioClient) {
    return Response.json(
      { error: "Twilio client not initialized" },
      { status: 500 }
    );
  }

  try {
    const { callSid } = await request.json();

    if (!callSid) {
      return Response.json(
        { error: "Missing callSid" },
        { status: 400 }
      );
    }

    // Update call to completed status (hangs up)
    const call = await twilioClient.calls(callSid).update({
      status: "completed",
    });

    return Response.json({
      sid: call.sid,
      status: call.status,
      message: "Call ended successfully",
    });
  } catch (error: any) {
    console.error("Failed to end call", error);
    return Response.json(
      { error: error?.message || "Failed to end call" },
      { status: 500 }
    );
  }
}
