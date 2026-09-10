const businesses = ['Door', 'Electrical Plug', 'Brandname', 'Clothing', 'Powerbank', 'Projector'];

function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl shadow-cyan-950/30 sm:p-14">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
          Internet Programming Group Project
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Moodeng MultiStore</h1>
        <h2 className="mt-5 text-xl font-medium text-slate-300 sm:text-2xl">
          Multi-Business Stock Management Platform
        </h2>
        <p className="mx-auto mt-6 max-w-2xl leading-7 text-slate-400">
          One shared system that will aggregate and normalize stock data from six independent businesses.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2" aria-label="Supported businesses">
          {businesses.map((business) => (
            <span key={business} className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
              {business}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
