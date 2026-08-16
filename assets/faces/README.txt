Player photos
=============

Priority order when the game renders a player portrait:

1. Local cache — assets/faces/p<database-id>.png
   Created by running  node tools/build_import.mjs --cache
   (only for players whose clubs exist in the game; a full export is
   thousands of files, so caching is opt-in).

2. Live photo URL from your database export (info.headshot)
   Loaded straight from the data — works without any local files.

3. Your own files — assets/faces/<player id>.png or <full name>.png

4. Generated stylized portrait (automatic fallback)

The game stops probing for missing photos after a while (no 404 spam)
and remembers who has art and who doesn't.
