import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <main className="min-h-screen bg-white px-4 py-6 text-neutral-950">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-sm items-center justify-center">
        <section className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-950 text-sm font-semibold text-white">
            E
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
              Ekorn
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
              Add your first receipt photo
            </h1>
            <p className="text-base leading-7 text-neutral-600">
              Start with a single photo from your camera or gallery.
            </p>
          </div>

          <button
            type="button"
            className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-neutral-950 px-4 py-3 text-base font-medium text-white transition hover:bg-neutral-800"
          >
            Add photo
          </button>
        </section>
      </div>
    </main>
  )
}
