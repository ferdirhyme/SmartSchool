// Inlined for self-containment
// Using a major-versioned URL for Supabase functions types to ensure stability.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Delete All Teachers function initialized.");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Create a Supabase admin client to perform privileged operations.
    // This uses the SERVICE_ROLE_KEY to bypass RLS.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 2. Find all user IDs for users with the 'Teacher' role from the 'profiles' table.
    const { data: teacherProfiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id') // 'id' here is the user's auth ID.
      .eq('role', 'Teacher');

    if (profileError) {
      throw new Error(`Failed to fetch teacher profiles: ${profileError.message}`);
    }

    if (!teacherProfiles || teacherProfiles.length === 0) {
      return new Response(JSON.stringify({ message: "No teachers found to delete." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const teacherIds = teacherProfiles.map(p => p.id);
    const deletionResults = {
        success: [],
        failed: [],
    };

    // 3. Delete each teacher's authentication account using their user ID.
    // This is the correct way to delete users in Supabase.
    // It will also cascade delete the corresponding row in the 'profiles' table.
    console.log(`Found ${teacherIds.length} teachers to delete.`);
    for (const userId of teacherIds) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        console.error(`Failed to delete user ${userId}:`, error.message);
        deletionResults.failed.push({ id: userId, reason: error.message });
      } else {
        console.log(`Successfully deleted auth user ${userId}.`);
        deletionResults.success.push(userId);
      }
    }
    
    // 4. Finally, clean up the 'teachers' table.
    // This is necessary as there's no direct foreign key from auth.users to teachers.
    console.log("Cleaning up the public.teachers table...");
    const { error: cleanupError } = await supabaseAdmin
        .from('teachers')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Targets all rows.

    if (cleanupError) {
        // Log the error but don't throw, as the main user deletion might have succeeded.
        console.error('Error during teachers table cleanup:', cleanupError.message);
    }

    const responseMessage = `
      Deletion process complete.
      - Successfully deleted ${deletionResults.success.length} user account(s).
      - Failed to delete ${deletionResults.failed.length} user account(s).
      ${cleanupError ? `- Teachers table cleanup failed: ${cleanupError.message}` : '- Teachers table cleaned up successfully.'}
    `.trim();

    return new Response(JSON.stringify({ message: responseMessage, results: deletionResults }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Critical error in delete-all-teachers function:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});