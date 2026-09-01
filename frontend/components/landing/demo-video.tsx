export function DemoVideo() {
  return (
    <section className="pb-20 px-4 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-3">
            See it in action
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
            Watch how humans and AI collaborate to edit video in real time.
          </p>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-border shadow-2xl shadow-primary/5 bg-black">
          <video
            className="w-full aspect-video"
            controls
            preload="metadata"
          >
            <source src="/demo.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </section>
  );
}
