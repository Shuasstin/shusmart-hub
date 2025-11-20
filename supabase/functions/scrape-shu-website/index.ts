import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScrapedContent {
  source_url: string;
  content_type: string;
  title: string;
  content: string;
  metadata: any;
}

async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    return await response.text();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return "";
  }
}

function extractTextContent(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function extractAnnouncements(html: string): ScrapedContent[] {
  const announcements: ScrapedContent[] = [];
  const announcementRegex = /Admissions for Spring 2026 are open|SHU.*?students.*?secures.*?place|Training session on/gi;
  const matches = html.match(announcementRegex);
  
  if (matches) {
    matches.forEach((match, index) => {
      announcements.push({
        source_url: "https://shu.edu.pk/",
        content_type: "announcement",
        title: match.substring(0, 100),
        content: match,
        metadata: { position: index }
      });
    });
  }
  
  return announcements;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // URLs to scrape
    const urls = [
      { url: "https://shu.edu.pk/", type: "homepage" },
      { url: "https://shu.edu.pk/qec/contact-us/", type: "contact" },
      { url: "https://shu.edu.pk/programs/", type: "programs" },
      { url: "https://shu.edu.pk/news/", type: "news" },
    ];

    const scrapedData: ScrapedContent[] = [];

    // Fetch all URLs
    for (const { url, type } of urls) {
      console.log(`Fetching ${url}...`);
      const html = await fetchWebsiteContent(url);
      
      if (!html) continue;

      const textContent = extractTextContent(html);
      
      // Extract specific information based on type
      if (type === "homepage") {
        const announcements = extractAnnouncements(html);
        scrapedData.push(...announcements);
        
        // Add general homepage content
        scrapedData.push({
          source_url: url,
          content_type: "general",
          title: "SHU Homepage",
          content: textContent.substring(0, 5000), // Limit content size
          metadata: { scraped_at: new Date().toISOString() }
        });
      } else if (type === "contact") {
        // Extract contact information
        const contactInfo = {
          address: "NC-24, Deh Dih, Korangi Creek, Karachi",
          uan: "021-111 248 338",
          phone: "021-35122931-35",
          email: "qec@shu.edu.pk"
        };
        
        scrapedData.push({
          source_url: url,
          content_type: "contact",
          title: "Contact Information",
          content: JSON.stringify(contactInfo),
          metadata: contactInfo
        });
      } else {
        scrapedData.push({
          source_url: url,
          content_type: type,
          title: `SHU ${type}`,
          content: textContent.substring(0, 5000),
          metadata: { scraped_at: new Date().toISOString() }
        });
      }
    }

    // Store or update scraped content in database
    for (const item of scrapedData) {
      // Check if content already exists
      const { data: existing } = await supabase
        .from('website_content')
        .select('id, content')
        .eq('source_url', item.source_url)
        .eq('title', item.title)
        .single();

      if (existing) {
        // Update if content has changed
        if (existing.content !== item.content) {
          const { error: updateError } = await supabase
            .from('website_content')
            .update({
              content: item.content,
              metadata: item.metadata,
              last_scraped_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error('Error updating content:', updateError);
          } else {
            // Log the change in notifications
            await supabase.from('content_notifications').insert({
              content_id: existing.id,
              change_type: 'updated',
              previous_content: existing.content,
              new_content: item.content
            });
            console.log(`Updated content: ${item.title}`);
          }
        }
      } else {
        // Insert new content
        const { data: inserted, error: insertError } = await supabase
          .from('website_content')
          .insert(item)
          .select()
          .single();

        if (insertError) {
          console.error('Error inserting content:', insertError);
        } else if (inserted) {
          // Log new content
          await supabase.from('content_notifications').insert({
            content_id: inserted.id,
            change_type: 'new',
            new_content: item.content
          });
          console.log(`Inserted new content: ${item.title}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully scraped and stored ${scrapedData.length} items`,
        itemsProcessed: scrapedData.length
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in scrape-shu-website:", error);
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
