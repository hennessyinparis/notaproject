import type { QueryClient } from '@tanstack/react-query';

/** Обновить блоки «Нравится» / «Репосты» внизу профиля и связанные экраны после действия текущего пользователя. */
export function invalidateMyProfileLikes(queryClient: QueryClient, username: string | null | undefined) {
  if (!username) return;
  void queryClient.invalidateQueries({ queryKey: ['user-liked-tracks', username] });
}

export function invalidateMyProfileReposts(queryClient: QueryClient, username: string | null | undefined) {
  if (!username) return;
  void queryClient.invalidateQueries({ queryKey: ['user-reposted-tracks', username] });
  void queryClient.invalidateQueries({ queryKey: ['library-reposted-tracks'] });
  void queryClient.invalidateQueries({ queryKey: ['reposts-page'] });
}
