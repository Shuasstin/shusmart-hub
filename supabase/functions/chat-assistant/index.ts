import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch latest scraped content from database
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: websiteContent } = await supabase
      .from('website_content')
      .select('*')
      .order('last_scraped_at', { ascending: false })
      .limit(20);

    // Build context from scraped content
    let contextInfo = "";
    if (websiteContent && websiteContent.length > 0) {
      contextInfo = "\n\nLATEST INFORMATION FROM SHU WEBSITE:\n";
      websiteContent.forEach(item => {
        contextInfo += `\n[${item.content_type.toUpperCase()}] ${item.title}:\n${item.content.substring(0, 500)}\n`;
      });
    }

    const systemPrompt = `You are an intelligent university assistant for SHU (Salim Habib University, formerly Barrett Hodgson University). 
You help students with:
- Admissions information and requirements (Current: Admissions for Spring 2026 are open)
- Examination schedules and procedures
- Campus facilities and services
- Academic programs and courses (BS programs in various fields)
- Student life, clubs, and activities
- General university policies
- Contact information and campus location

CONTACT INFORMATION:
- Address: NC-24, Deh Dih, Korangi Creek, Karachi
- UAN: 021-111 248 338
- Phone: 021-35122931-35
- Email: qec@shu.edu.pk

${contextInfo}

Provide clear, helpful, and accurate information based on the latest website data above. Be friendly and professional. 
If you don't know something, be honest and suggest they contact the relevant department using the contact information provided.
When discussing programs or admissions, reference the current information from the website.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service credits exhausted. Please contact support." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ response: aiResponse }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in chat-assistant:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An error occurred" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
