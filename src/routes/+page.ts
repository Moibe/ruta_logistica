import { redirect } from '@sveltejs/kit';

// No landing page: the app *is* the map, and the game is played on the Mexico
// board, so that's where `/` lands. The world views are one click away.
export function load() {
  redirect(307, '/mexico');
}
