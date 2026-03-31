import { EmptyState } from '../components/common/EmptyState';

export function Library() {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Библиотека</h1>
      <EmptyState
        title="Пока пусто"
        description="Лайкай треки чтобы добавить их в библиотеку"
      />
    </div>
  );
}
