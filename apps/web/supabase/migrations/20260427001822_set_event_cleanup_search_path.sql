-- Avoid role-mutable search_path when the cleanup function is invoked.

alter function public.event_cleanup() set search_path = public, pg_temp;
