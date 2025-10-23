import twilioClient from "@/lib/twilio";

export async function GET() {
  if (!twilioClient) {
    return Response.json([]);
  }

  try {
    const incomingPhoneNumbers = await twilioClient.incomingPhoneNumbers.list({
      limit: 20,
    });
    return Response.json(incomingPhoneNumbers);
  } catch (error) {
    console.error("Failed to list Twilio phone numbers", error);
    return Response.json([]);
  }
}

export async function POST(req: Request) {
  if (!twilioClient) {
    return Response.json(
      { error: "Twilio client not initialized" },
      { status: 500 }
    );
  }

  const { phoneNumberSid, voiceUrl } = await req.json();
  const incomingPhoneNumber = await twilioClient
    .incomingPhoneNumbers(phoneNumberSid)
    .update({ voiceUrl });

  return Response.json(incomingPhoneNumber);
}
