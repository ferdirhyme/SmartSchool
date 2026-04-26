import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => null);
    const reference = body?.reference;
    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), { status: 400, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify with Paystack first, without depending on a pending tx in the DB
    const { data: settingsData } = await supabaseAdmin
      .from('school_settings')
      .select('paystack_secret_key')
      .limit(1)
      .single();

    const PAYSTACK_SECRET_KEY = settingsData?.paystack_secret_key;
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error("Paystack not configured");
    }

    // Verify with Paystack
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    });

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
      return new Response(JSON.stringify({ error: "Failed to verify with Paystack" }), { status: 400, headers: corsHeaders });
    }

    if (paystackData.data.status === 'success') {
      // Amount in Paystack is in pesewas, convert to GHS
      const amountInGHS = Number((paystackData.data.amount / 100).toFixed(2));
      
      console.log(`Verified success for ref ${reference}. Amount: ${amountInGHS}`);

      // We use upsert with onConflict: 'reference' to handle both new records 
      // and updating existing pending ones without hitting unique constraint errors.
      const upsertPayload = {
        user_id: userData.user.id,
        amount: amountInGHS,
        status: 'success',
        reference: reference,
        gateway: 'paystack'
      };
      
      console.log("Attempting upsert with payload:", upsertPayload);

      const { data: upsertData, error: upsertError } = await supabaseAdmin
        .from('transactions')
        .upsert(upsertPayload, { onConflict: 'reference' })
        .select();

      if (upsertError) {
         console.error("Upsert error:", upsertError);
         return new Response(JSON.stringify({ error: `Transaction recording failed: ${upsertError.message}` }), { status: 500, headers: corsHeaders });
      }

      console.log("Successfully recorded transaction:", upsertData);

      return new Response(JSON.stringify({ success: true, message: "Payment verified and recorded", transaction: upsertData?.[0] }), { status: 200, headers: corsHeaders });
    } else {
       return new Response(JSON.stringify({ error: `Payment status: ${paystackData.data.status}` }), { status: 400, headers: corsHeaders });
    }

  } catch (err: any) {
    console.error("client-verify-payment error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
