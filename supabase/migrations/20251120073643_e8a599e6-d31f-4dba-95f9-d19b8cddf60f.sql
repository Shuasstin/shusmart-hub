-- Create table for storing scraped website content
CREATE TABLE IF NOT EXISTS public.website_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_url TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'announcement', 'event', 'program', 'contact'
  title TEXT,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  last_scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_website_content_source ON public.website_content(source_url);
CREATE INDEX idx_website_content_type ON public.website_content(content_type);
CREATE INDEX idx_website_content_scraped ON public.website_content(last_scraped_at);

-- Enable RLS
ALTER TABLE public.website_content ENABLE ROW LEVEL SECURITY;

-- Allow public read access (anyone can view scraped content)
CREATE POLICY "Anyone can view website content"
ON public.website_content
FOR SELECT
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_website_content_updated_at
BEFORE UPDATE ON public.website_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create table for tracking content changes and notifications
CREATE TABLE IF NOT EXISTS public.content_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID REFERENCES public.website_content(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL, -- 'new', 'updated', 'deleted'
  previous_content TEXT,
  new_content TEXT,
  notified_users TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for notifications
ALTER TABLE public.content_notifications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view notifications
CREATE POLICY "Authenticated users can view notifications"
ON public.content_notifications
FOR SELECT
USING (auth.role() = 'authenticated');