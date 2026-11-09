import type { ReactNode } from 'react';

export function Layout({ title, left, right, children }: { title: string; left?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-8 pt-[max(env(safe-area-inset-top),0.5rem)]">
      <header className="flex h-14 items-center justify-between gap-2">
        <div className="min-w-16">{left}</div>
        <h1 className="truncate text-lg font-bold">{title}</h1>
        <div className="flex min-w-16 justify-end">{right}</div>
      </header>
      <main className="flex flex-1 flex-col gap-4">{children}</main>
    </div>
  );
}
