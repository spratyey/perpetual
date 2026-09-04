/**
 * The demo.
 *
 * A YouTube embed rather than the 6 MB `demo.mp4` this repo used to ship: the
 * file was the single largest thing in the checkout and every visitor paid for
 * it whether or not they pressed play.
 *
 * `youtube-nocookie.com` so a visitor who never plays it is not tracked, and
 * `loading="lazy"` so the iframe is not fetched until it is near the viewport.
 */

const VIDEO_ID = "bzTxLXt0RNo";

export function DemoVideo() {
  return (
    <section className="px-4 pb-24 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-2xl">
          <iframe
            className="aspect-video w-full"
            src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0`}
            title="Perpetual Video demo"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}
