-- Create enum for event types
CREATE TYPE public.event_type AS ENUM ('exam', 'vacation', 'function', 'other');

-- Create enum for query status
CREATE TYPE public.query_status AS ENUM ('pending', 'answered', 'resolved');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categories table for organizing FAQs
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_urdu TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create FAQs table
CREATE TABLE public.faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  question_urdu TEXT,
  answer TEXT NOT NULL,
  answer_urdu TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  views_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_urdu TEXT,
  description TEXT,
  description_urdu TEXT,
  event_type public.event_type DEFAULT 'other',
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  location TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user queries table
CREATE TABLE public.queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  status public.query_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  answered_at TIMESTAMP WITH TIME ZONE,
  answered_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for categories (public read, admin write)
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);

-- RLS Policies for FAQs (public read, admin write)
CREATE POLICY "Anyone can view FAQs" ON public.faqs FOR SELECT USING (true);
CREATE POLICY "Anyone can update FAQ metrics" ON public.faqs FOR UPDATE USING (true);

-- RLS Policies for events (public read, admin write)
CREATE POLICY "Anyone can view events" ON public.events FOR SELECT USING (true);

-- RLS Policies for queries
CREATE POLICY "Users can view own queries" ON public.queries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own queries" ON public.queries FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_faqs_updated_at BEFORE UPDATE ON public.faqs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Insert some sample categories
INSERT INTO public.categories (name, name_urdu, description) VALUES
  ('Admissions', 'داخلہ', 'Questions about admission process and requirements'),
  ('Examinations', 'امتحانات', 'Information about exams, schedules, and results'),
  ('Campus Facilities', 'کیمپس کی سہولیات', 'Information about campus facilities and services'),
  ('Academic Programs', 'تعلیمی پروگرام', 'Details about courses and programs offered'),
  ('Student Life', 'طالب علم کی زندگی', 'Information about student activities and clubs');

-- Insert some sample FAQs
INSERT INTO public.faqs (question, question_urdu, answer, answer_urdu, category_id) 
SELECT 
  'What are the admission requirements?',
  'داخلے کی کیا ضروریات ہیں؟',
  'Admission requirements include a completed application form, academic transcripts, entrance test results, and required documents.',
  'داخلے کی ضروریات میں مکمل درخواست فارم، تعلیمی نقول، داخلہ ٹیسٹ کے نتائج، اور مطلوبہ دستاویزات شامل ہیں۔',
  id FROM public.categories WHERE name = 'Admissions' LIMIT 1;

INSERT INTO public.faqs (question, question_urdu, answer, answer_urdu, category_id)
SELECT
  'When is the exam schedule released?',
  'امتحان کا شیڈول کب جاری ہوتا ہے؟',
  'The exam schedule is typically released 4 weeks before the start of exams. Students will be notified via email and the student portal.',
  'امتحان کا شیڈول عام طور پر امتحانات کے آغاز سے 4 ہفتے پہلے جاری کیا جاتا ہے۔ طلباء کو ای میل اور سٹوڈنٹ پورٹل کے ذریعے مطلع کیا جائے گا۔',
  id FROM public.categories WHERE name = 'Examinations' LIMIT 1;

-- Insert some sample events
INSERT INTO public.events (title, title_urdu, description, description_urdu, event_type, start_date, end_date, location) VALUES
  ('Mid-Term Examinations', 'وسط مدتی امتحانات', 'Mid-semester examinations for all programs', 'تمام پروگراموں کے لیے وسط سمسٹر امتحانات', 'exam', NOW() + INTERVAL '2 weeks', NOW() + INTERVAL '3 weeks', 'Main Campus'),
  ('Winter Break', 'موسم سرما کی چھٹیاں', 'University winter vacation period', 'یونیورسٹی موسم سرما کی چھٹیوں کی مدت', 'vacation', NOW() + INTERVAL '1 month', NOW() + INTERVAL '6 weeks', 'All Campuses'),
  ('Annual Sports Gala', 'سالانہ کھیلوں کا میلہ', 'Annual inter-departmental sports competition', 'سالانہ بین محکمہ کھیلوں کا مقابلہ', 'function', NOW() + INTERVAL '10 days', NOW() + INTERVAL '12 days', 'Sports Complex');