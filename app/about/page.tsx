export default async function About() {
  return (
    <div className="nn-bg mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <h1 className="nn-text text-3xl font-bold tracking-tight">About</h1>
      <p className="nn-mut mt-3 leading-relaxed">
        NeuralNexus is a local-first, single-user everything-feed aggregator.
        Your private key, your feeds, and your articles all live on this
        device — no cloud, no accounts. Point any number of devices at the
        same database and they all unlock with the same key.
      </p>
    </div>
  );
}
