BEGIN;

INSERT INTO public.genres(id,emoji,color) VALUES
  ('psychology','🧠','#F09FCB'),('leadership','🚀','#7D95C1')
ON CONFLICT(id) DO UPDATE SET emoji=EXCLUDED.emoji,color=EXCLUDED.color;

UPDATE public.genres SET color='#F7DDE7' WHERE id='mindfulness';

INSERT INTO public.genre_translations(genre_id,language,name) VALUES
  ('psychology','es','Psicología'),('psychology','en','Psychology'),
  ('leadership','es','Liderazgo'),('leadership','en','Leadership')
ON CONFLICT(genre_id,language) DO NOTHING;

COMMIT;
