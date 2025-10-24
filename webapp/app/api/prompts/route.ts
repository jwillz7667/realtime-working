import { supabase } from "@/lib/supabase";

// GET - Fetch all instruction prompts
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("instruction_prompts")
      .select("*")
      .order("is_default", { ascending: false })
      .order("name");

    if (error) {
      console.error("Error fetching prompts:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ prompts: data || [] });
  } catch (error: any) {
    console.error("Error in GET /api/prompts:", error);
    return Response.json(
      { error: error?.message || "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}

// POST - Create a new prompt
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, instructions, is_default } = body;

    if (!name || !instructions) {
      return Response.json(
        { error: "Missing required fields: name, instructions" },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from("instruction_prompts")
        .update({ is_default: false })
        .eq("is_default", true);
    }

    const { data, error } = await supabase
      .from("instruction_prompts")
      .insert({
        name,
        instructions,
        is_default: is_default || false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating prompt:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ prompt: data });
  } catch (error: any) {
    console.error("Error in POST /api/prompts:", error);
    return Response.json(
      { error: error?.message || "Failed to create prompt" },
      { status: 500 }
    );
  }
}

// PATCH - Update a prompt
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, name, instructions, is_default } = body;

    if (!id) {
      return Response.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from("instruction_prompts")
        .update({ is_default: false })
        .eq("is_default", true);
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (name) updates.name = name;
    if (instructions) updates.instructions = instructions;
    if (is_default !== undefined) updates.is_default = is_default;

    const { data, error } = await supabase
      .from("instruction_prompts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating prompt:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ prompt: data });
  } catch (error: any) {
    console.error("Error in PATCH /api/prompts:", error);
    return Response.json(
      { error: error?.message || "Failed to update prompt" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a prompt
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json(
        { error: "Missing required parameter: id" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("instruction_prompts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting prompt:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/prompts:", error);
    return Response.json(
      { error: error?.message || "Failed to delete prompt" },
      { status: 500 }
    );
  }
}
