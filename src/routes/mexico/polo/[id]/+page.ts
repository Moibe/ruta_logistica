import { error } from '@sveltejs/kit';
import { tieneInterior } from '$lib/domain/interior';

// Client-only: the close-up reads the running game (`sim`) and fetches its drawing.
export const ssr = false;

export function load({ params }) {
  if (!tieneInterior(params.id)) error(404, 'Este polo todavía no tiene vista por dentro');
  return { id: params.id };
}
