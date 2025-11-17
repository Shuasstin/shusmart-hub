import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Event {
  id: string;
  title: string;
  title_urdu: string | null;
  description: string | null;
  event_type: "exam" | "vacation" | "function" | "other";
  start_date: string;
  end_date: string | null;
  location: string | null;
}

const eventTypeColors = {
  exam: "bg-destructive text-destructive-foreground",
  vacation: "bg-secondary text-secondary-foreground",
  function: "bg-accent text-accent-foreground",
  other: "bg-muted text-muted-foreground",
};

export const EventCalendar = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("start_date", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Upcoming Events</h2>
      </div>

      <div className="grid gap-4">
        {events.map((event) => (
          <Card
            key={event.id}
            className="p-6 hover:shadow-[var(--shadow-medium)] transition-all duration-300"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{event.title}</h3>
                  <Badge className={eventTypeColors[event.event_type]}>
                    {event.event_type}
                  </Badge>
                </div>
                
                {event.description && (
                  <p className="text-muted-foreground text-sm">
                    {event.description}
                  </p>
                )}
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(event.start_date), "MMM dd, yyyy")}
                    {event.end_date && (
                      <> - {format(new Date(event.end_date), "MMM dd, yyyy")}</>
                    )}
                  </div>
                  
                  {event.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {event.location}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}

        {events.length === 0 && (
          <Card className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No upcoming events</p>
          </Card>
        )}
      </div>
    </div>
  );
};
