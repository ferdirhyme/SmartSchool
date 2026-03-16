// paystack-webhook.ts (Supabase Edge / Deno)
// Usage: set PAYSTACK_SECRET_KEY in your function environment variables.
// Note: This file assumes tables: payment_events, payment_webhook_errors, transactions, profiles
// and that transactions rows contain: reference (unique), status (pending|success|failed), gateway_response (jsonb), amount (decimal), user_id.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

// FIX: Add a declaration for the Deno global object, which is available in the Supabase Edge Function runtime environment.
declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
  "Content-Type": "text/plain; charset=utf-8",
};

// helper: convert ArrayBuffer to lowercase hex
const bufferToHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

// constant time equality check
const constTimeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) {
    res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return res === 0;
};

serve(async (req: Request) => {
  // Handle CORS preflight quickly
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Create admin Supabase client to bypass RLS for webhook processing/logging
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Fetch the Paystack secret key from the database instead of environment variables.
  const { data: settingsData, error: settingsError } = await supabaseAdmin
    .from('school_settings')
    .select('paystack_secret_key')
    .limit(1)
    .single();

  if (settingsError || !settingsData?.paystack_secret_key) {
    console.error("Failed to fetch Paystack secret key from DB:", settingsError?.message);
    return new Response("Payment gateway not configured in settings", { status: 500, headers: corsHeaders });
  }

  const PAYSTACK_SECRET_KEY = settingsData.paystack_secret_key;


  // Read raw body first (required for signature verification)
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    console.error("Failed to read raw body:", err);
    return new Response("Invalid request body", { status: 400, headers: corsHeaders });
  }

  const signatureHeader = req.headers.get("x-paystack-signature") ?? "";
  if (!signatureHeader) {
    console.error("Missing x-paystack-signature header");
    // 400 so Paystack will not retry indefinitely; signature problem is client side
    return new Response("Missing signature", { status: 400, headers: corsHeaders });
  }

  // Compute expected signature using Paystack's method: SHA512(secret + rawBody)
  try {
    const encoder = new TextEncoder();
    const dataToHash = PAYSTACK_SECRET_KEY + rawBody;
    const hashBuffer = await crypto.subtle.digest("SHA-512", encoder.encode(dataToHash));
    const expectedHex = bufferToHex(hashBuffer); // lowercase hex

    // Compare in constant time
    if (!constTimeEqual(expectedHex, signatureHeader.toLowerCase())) {
      console.error("Invalid signature", { expected: expectedHex.slice(0, 16) + "...", received: signatureHeader.slice(0, 16) + "..." });
      // Log the invalid attempt for debugging
      await supabaseAdmin.from("payment_webhook_errors").insert({
        reference: null,
        error_message: "Invalid signature",
        payload: rawBody,
      }).catch((e) => console.error("Failed to log webhook error:", e));
      return new Response("Invalid signature", { status: 400, headers: corsHeaders });
    }
  } catch (err) {
    console.error("Signature verification error:", err);
    await supabaseAdmin.from("payment_webhook_errors").insert({
      reference: null,
      error_message: `Signature verification error: ${String(err)}`,
      payload: rawBody,
    }).catch((e) => console.error("Failed to log webhook error:", e));
    return new Response("Signature verification failed", { status: 500, headers: corsHeaders });
  }

  // parse JSON after signature has been validated
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("Invalid JSON payload:", err);
    await supabaseAdmin.from("payment_webhook_errors").insert({
      reference: null,
      error_message: "Invalid JSON payload",
      payload: rawBody,
    }).catch((e) => console.error("Failed to log webhook error:", e));
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  // Extract useful fields
  const event = payload?.event ?? payload?.type ?? "unknown";
  const reference = payload?.data?.reference ?? payload?.data?.reference ?? null;
  const amount = payload?.data?.amount ?? null; // integer (pesewas)
  const gatewayData = payload?.data ?? null;

  // Log the incoming event (useful for audits)
  try {
    await supabaseAdmin.from("payment_events").insert({
      reference,
      event,
      payload,
      processed: false,
      created_at: new Date().toISOString()
    }).catch((e) => console.error("Failed to insert payment_event:", e));
  } catch (err) {
    console.error("Error logging payment event:", err);
  }

  // Only act on charge.success (or a set of events you care about)
  try {
    if (event === "charge.success" || event === "charge.successful" || event === "transaction.success") {
      if (!reference) {
        throw new Error("Missing transaction reference in payload");
      }

      // 1) Find transaction row by reference
      const { data: txRow, error: txError } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("reference", reference)
        .single();

      if (txError && txError.code !== "PGRST116") { // not found code may vary but often PGRST116
        console.error("DB error when fetching transaction:", txError);
        throw txError;
      }

      if (!txRow) {
        // Option: create or mark as external transaction; for now we log and fail
        console.error(`Transaction not found for reference ${reference}`);
        await supabaseAdmin.from("payment_webhook_errors").insert({
          reference,
          error_message: `Transaction not found for reference ${reference}`,
          payload,
        }).catch((e) => console.error("Failed to log missing tx:", e));
        // Return 200 so Paystack doesn't keep retrying if you don't want to process unknown references.
        return new Response("Transaction not found - logged", { status: 200, headers: corsHeaders });
      }

      // Idempotency: If already success, respond OK
      if (txRow.status === "success") {
        console.log(`Transaction ${reference} already marked success. Skipping processing.`);
        // mark event processed
        await supabaseAdmin.from("payment_events").update({ processed: true }).eq("reference", reference).catch((e) => console.error(e));
        return new Response("Already processed", { status: 200, headers: corsHeaders });
      }

      // Ensure amount matches (optional)
      const receivedAmount = typeof amount === "number" ? amount : null;
      // Convert pesewas to GHS decimal (if your DB stores in main currency)
      const amountInGHS = receivedAmount !== null ? Number((receivedAmount / 100).toFixed(2)) : null;

      // 2) Update transaction as success (and record gateway response). Use a single DB update
      const { error: updateError } = await supabaseAdmin
        .from("transactions")
        .update({
          status: "success",
          gateway_response: gatewayData,
          amount: amountInGHS ?? txRow.amount,
          updated_at: new Date().toISOString()
        })
        .eq("reference", reference);

      if (updateError) {
        console.error("Failed to update transaction:", updateError);
        throw updateError;
      }

      // 3) Optionally credit user balance or call RPC that performs both update + balance adjust
      try {
        // If you have an RPC that does this atomically, call it. Example shown:
        // await supabaseAdmin.rpc('add_credit_to_user_and_update_transaction', { p_user_id: txRow.user_id, p_amount: amountInGHS, p_reference: reference });
        // If no RPC, consider performing a safe update to profile / wallet table here.
      } catch (rpcErr) {
        console.error("RPC balance update failed:", rpcErr);
        // Log error but do not fail the webhook (we can retry or inspect later)
        await supabaseAdmin.from("payment_webhook_errors").insert({
          reference,
          error_message: `RPC balance update failed: ${String(rpcErr)}`,
          payload,
        }).catch((e) => console.error("Failed to log RPC error:", e));
      }

      // Mark the event as processed
      await supabaseAdmin.from("payment_events").update({ processed: true }).eq("reference", reference).catch((e) => console.error(e));
    }

    // For events you don't process, return 200 so Paystack considers it delivered
    return new Response("Webhook processed", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("Processing error:", err);
    // Log the processing error for later inspection
    await supabaseAdmin.from("payment_webhook_errors").insert({
      reference,
      error_message: String(err),
      payload,
    }).catch((e) => console.error("Failed to log processing error:", e));

    // Return 500 to let Paystack retry if this was a temporary error
    return new Response("Internal server error", { status: 500, headers: corsHeaders });
  }
});