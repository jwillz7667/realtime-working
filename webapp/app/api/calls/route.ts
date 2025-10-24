import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";

// GET - Fetch all calls with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phoneNumber = searchParams.get("phone_number");
    const direction = searchParams.get("direction");
    const limit = parseInt(searchParams.get("limit") || "50");

    let query = supabase
      .from("calls")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (phoneNumber) {
      query = query.eq("phone_number", phoneNumber);
    }

    if (direction) {
      query = query.eq("direction", direction);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching calls:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ calls: data || [] });
  } catch (error: any) {
    console.error("Error in GET /api/calls:", error);
    return Response.json(
      { error: error?.message || "Failed to fetch calls" },
      { status: 500 }
    );
  }
}

// POST - Create a new call record
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone_number, call_sid, direction, instructions_used } = body;

    if (!phone_number || !call_sid || !direction) {
      return Response.json(
        { error: "Missing required fields: phone_number, call_sid, direction" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("calls")
      .insert({
        phone_number,
        call_sid,
        direction,
        instructions_used,
        status: "initiated",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating call:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ call: data });
  } catch (error: any) {
    console.error("Error in POST /api/calls:", error);
    return Response.json(
      { error: error?.message || "Failed to create call" },
      { status: 500 }
    );
  }
}

// PATCH - Update a call record
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { call_sid, status, duration, recording_url, recording_sid, ended_at } = body;

    if (!call_sid) {
      return Response.json(
        { error: "Missing required field: call_sid" },
        { status: 400 }
      );
    }

    const updates: any = {};
    if (status) updates.status = status;
    if (duration !== undefined) updates.duration = duration;
    if (recording_url) updates.recording_url = recording_url;
    if (recording_sid) updates.recording_sid = recording_sid;
    if (ended_at) updates.ended_at = ended_at;

    const { data, error } = await supabase
      .from("calls")
      .update(updates)
      .eq("call_sid", call_sid)
      .select()
      .single();

    if (error) {
      console.error("Error updating call:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ call: data });
  } catch (error: any) {
    console.error("Error in PATCH /api/calls:", error);
    return Response.json(
      { error: error?.message || "Failed to update call" },
      { status: 500 }
    );
  }
}
