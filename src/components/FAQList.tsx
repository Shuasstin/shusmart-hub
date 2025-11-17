import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FAQ {
  id: string;
  question: string;
  question_urdu: string | null;
  answer: string;
  answer_urdu: string | null;
  category: {
    name: string;
    name_urdu: string | null;
  } | null;
}

export const FAQList = () => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFAQs();
  }, []);

  const fetchFAQs = async () => {
    try {
      const { data, error } = await supabase
        .from("faqs")
        .select(`
          *,
          category:categories(name, name_urdu)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFaqs(data || []);
    } catch (error) {
      console.error("Error fetching FAQs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFAQs = faqs.filter((faq) =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (faq.category?.name.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <HelpCircle className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Knowledge Base</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search frequently asked questions..."
          className="pl-10"
        />
      </div>

      <Card className="shadow-[var(--shadow-medium)]">
        <Accordion type="single" collapsible className="w-full">
          {filteredFAQs.map((faq, index) => (
            <AccordionItem key={faq.id} value={faq.id}>
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-start gap-3 text-left">
                  <span className="font-semibold">{faq.question}</span>
                  {faq.category && (
                    <Badge variant="outline" className="ml-auto">
                      {faq.category.name}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                <p className="text-muted-foreground">{faq.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {filteredFAQs.length === 0 && (
          <div className="p-12 text-center">
            <HelpCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchQuery ? "No FAQs found matching your search" : "No FAQs available"}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
