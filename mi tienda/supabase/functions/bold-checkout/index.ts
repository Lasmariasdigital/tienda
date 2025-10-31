// Archivo: index.ts (Edge Function para Bold Checkout)

// Usamos Deno para el ambiente de Supabase Edge Functions
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

// ⚠️ IMPORTANTE: Esta llave debe estar configurada como una Variable de Entorno
// en tu proyecto de Supabase (Settings -> Edge Functions -> Environment Variables).
// Nombre de la variable en Supabase: BOLD_SECRET_KEY
const BOLD_SECRET_KEY = Deno.env.get("BOLD_SECRET_KEY") || "TU_LLAVE_SECRETA_REAL_DE_BOLD";
const BOLD_API_KEY = "j72i47gDQcFNJOim3uGyzk_zONUlnZkPC713FA3mtuE"; // Tu Llave Pública

serve(async (req) => {
    // 1. Manejo de Peticiones OPTIONS (CORS Pre-flight)
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*", // Necesario para CORS
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            },
        });
    }

    try {
        if (req.method !== "POST") {
            return new Response(JSON.stringify({
                error: "Method not allowed"
            }), {
                status: 405,
                headers: { "Content-Type": "application/json" }
            });
        }
        
        const data = await req.json();
        const { orderId, amount, redirectionUrl, description } = data;

        if (!amount || !orderId || !redirectionUrl) {
            return new Response(JSON.stringify({
                error: "Missing required fields"
            }), {
                status: 400,
                headers: { 
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*", // Añadir CORS para errores
                }
            });
        }

        const currency = "USD"; // Fijo para esta tienda (debes usar la que configuraste en Bold)

        // 2. GENERACIÓN DEL HASH DE INTEGRIDAD (SEGURIDAD)
        // Formato: {Identificador}{Monto}{Divisa}{LlaveSecreta}
        const signatureString = `${orderId}${amount}${currency}${BOLD_SECRET_KEY}`;

        // Generar el hash SHA256
        const hash = createHmac("sha256", BOLD_SECRET_KEY).update(signatureString).digest("hex");

        // 3. CONSTRUCCIÓN DE LA URL DE BOLD
        const checkoutUrlParams = new URLSearchParams({
            'data-order-id': orderId,
            'data-currency': currency,
            'data-amount': amount.toString(),
            'data-api-key': BOLD_API_KEY,
            'data-integrity-signature': hash,
            'data-redirection-url': redirectionUrl,
            // 'data-description': description, // Opcional si no siempre se usa
            'data-render-mode': 'embedded'
        });

        const boldPaymentUrl = `https://checkout.bold.co/payment/initiate?${checkoutUrlParams.toString()}`;

        // 4. RESPUESTA EXITOSA (con CORS)
        return new Response(JSON.stringify({
            success: true,
            redirectUrl: boldPaymentUrl
        }), {
            status: 200,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*", // Permitir que tu tienda lo reciba
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            }
        });

    } catch (error) {
        console.error("Error processing request:", error);
        return new Response(JSON.stringify({
            error: "Internal Server Error"
        }), {
            status: 500,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*", // Permitir CORS para errores
            }
        });
    }
});