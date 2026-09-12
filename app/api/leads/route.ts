import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[API /leads] Supabase error:", error);
      return NextResponse.json({ leads: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ leads: data || [] });
  } catch (err: any) {
    console.error("[API /leads] Unexpected error:", err);
    return NextResponse.json({ leads: [], error: err.message }, { status: 500 });
  }
}
