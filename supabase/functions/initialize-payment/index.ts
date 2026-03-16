// Inlined for self-containment
// Using a major-versioned URL for Supabase functions types to ensure stability.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

declare const Deno: any;

// Inlined CORS headers to make the function self-contained
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.info("initialize-payment function starting");

serve(async (req: Request) => {
  // Handle preflight requests for CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Basic check for Authorization header presence
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a user-scoped client to get the user's identity and perform actions on their behalf
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // get authenticated user
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError) throw userError;
    const user = userData.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // parse body safely
    const body = await req.json().catch(() => null);
    const amount = body?.amount;
    
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount. Send amount in the smallest currency unit (e.g., kobo)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create an ADMIN client to fetch settings securely, bypassing RLS.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    
    // Fetch paystack secret key and currency from school_settings
    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from('school_settings')
      .select('paystack_secret_key, currency')
      .limit(1)
      .single();

    if (settingsError) throw new Error(`Failed to fetch payment settings: ${settingsError.message}`);
    
    const PAYSTACK_SECRET_KEY = settingsData?.paystack_secret_key;
    const CURRENCY = settingsData?.currency;

    if (!PAYSTACK_SECRET_KEY || !CURRENCY) {
      console.error("Paystack secret key or currency is not set in school_settings table.");
      return new Response(JSON.stringify({ error: "Payment gateway not configured by administrator." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize transaction with Paystack
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: amount,
        currency: CURRENCY,
        metadata: {
          user_id: user.id, // Keep user_id in metadata for our webhook
        }
      }),
    });

    const paystackJson = await paystackResponse.json().catch(() => null);
    
    console.log("Paystack response:", paystackJson);

    if (!paystackResponse.ok) {
      console.error("Paystack init error", paystackJson);
      return new Response(JSON.stringify({ error: paystackJson?.message ?? "Paystack error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = paystackJson?.data?.reference;
    if (!reference) {
      console.error("Paystack response missing reference", paystackJson);
      return new Response(JSON.stringify({ error: "Payment initialization failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the user-scoped client. This will succeed because of the new RLS policy.
    const { error: dbError, data: inserted } = await supabaseClient
      .from("transactions")
      .insert({
        user_id: user.id,
        amount: (amount / 100), // store as decimal in main currency unit
        reference,
        
        status: "pending",
        gateway: "paystack",
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB insert error", dbError);
      return new Response(JSON.stringify({ error: "Could not create transaction record. " + dbError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return Paystack initialization data plus DB record id
    const responsePayload = {
      paystack: paystackJson.data,
      transaction: inserted,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("initialize-payment error", err);
    const errorMessage = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});