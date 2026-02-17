-- Add scheduled_at column for scheduled send feature
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone DEFAULT NULL;

-- Create index for efficient querying of scheduled emails
CREATE INDEX IF NOT EXISTS idx_emails_scheduled_at ON public.emails (scheduled_at) WHERE scheduled_at IS NOT NULL;