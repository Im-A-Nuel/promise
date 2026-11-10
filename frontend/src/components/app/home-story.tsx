import { PixelArt } from "@/components/pixel";
import {
  ARROW,
  BOOK,
  CHECK,
  CHEST,
  COIN,
  ENVELOPE,
  EYE,
  FLASK,
  LANTERN,
  PERSON,
  type Sprite,
} from "@/components/pixel-sprites";
import { Reveal } from "@/components/reveal";
import { getT } from "@/lib/i18n/server";

const AYU = { h: "#2A1A12", r: "#D8453B" };
const BUDI = { h: "#7A4A2A", r: "#2F6B3F" };
const SOFT = { K: "#B9A590" };

/** A coin that hops when the card it sits in is hovered. The hop moves in whole steps, like a sprite would. */
function Coin({ scale = 3 }: { scale?: number }) {
  return (
    <span className="pixel-hop pixel-pop inline-block">
      <PixelArt sprite={COIN} scale={scale} />
    </span>
  );
}

/** A scene on a strip of pixel ground. */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] bg-gradient-to-b from-[#FFEBDD] to-[#FFF8F1] pt-7">
      <div className="flex items-end justify-center gap-1.5 px-2 pb-1">
        {children}
      </div>
      <div aria-hidden="true" className="pixel-ground" />
    </div>
  );
}

/** The ledger told as three pictures: a gift is given, it is given back, the card flips. */
export async function LedgerStory() {
  const { t } = await getT();
  const panels = [
    {
      n: 1,
      scene: (
        <>
          <PixelArt sprite={PERSON} palette={BUDI} scale={4} label="Budi" />
          <Coin />
          <PixelArt sprite={ARROW} palette={SOFT} scale={3} />
          <PixelArt sprite={ENVELOPE} scale={4} />
        </>
      ),
    },
    {
      n: 2,
      scene: (
        <>
          <PixelArt sprite={PERSON} palette={AYU} scale={4} label="Ayu" />
          <Coin />
          <PixelArt sprite={ARROW} palette={SOFT} scale={3} />
          <PixelArt sprite={PERSON} palette={BUDI} scale={4} label="Budi" />
        </>
      ),
    },
    {
      n: 3,
      scene: (
        <>
          <PixelArt sprite={ENVELOPE} scale={4} />
          <PixelArt sprite={CHECK} scale={4} />
        </>
      ),
    },
  ] as const;

  return (
    <section
      id="ledger-story"
      className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:pb-28"
    >
      <h2 className="max-w-xl text-3xl sm:text-4xl">{t("ledger.title")}</h2>
      <p className="mt-3 max-w-lg text-lg text-ink-soft">{t("ledger.lead")}</p>

      <ol className="mt-10 grid gap-5 md:grid-cols-3">
        {panels.map(({ n, scene }, i) => (
          <li key={n}>
            <Reveal delay={i * 0.08} className="surface group h-full p-5">
              <Stage>{scene}</Stage>
              <p className="mt-5 flex items-center gap-3 font-display text-xl">
                <span
                  aria-hidden="true"
                  className="tabular grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red text-sm text-white"
                >
                  {n}
                </span>
                {t(`ledger.p${n}.cap`)}
              </p>
              <span className={`chip mt-3 ${n === 3 ? "chip-good" : ""}`}>
                {t(`ledger.p${n}.res`)}
              </span>
            </Reveal>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <span className="text-sm font-extrabold text-ink-soft">
          {t("ledger.alt.title")}
        </span>
        {([1, 2] as const).map((n) => (
          <span
            key={n}
            className="surface group flex items-center gap-3 py-2 pl-3 pr-5"
          >
            <Coin scale={2} />
            <span className="font-display text-lg">
              {t(`ledger.alt${n}.give`)}
            </span>
            <PixelArt sprite={ARROW} palette={SOFT} scale={2} />
            <span className="font-bold">{t(`ledger.alt${n}.res`)}</span>
          </span>
        ))}
      </div>
      <p className="mt-6 text-sm text-ink-soft">{t("ledger.footnote")}</p>
    </section>
  );
}

const LIMITS: { n: 1 | 2 | 3 | 4 | 5; sprite: Sprite }[] = [
  { n: 1, sprite: BOOK },
  { n: 2, sprite: EYE },
  { n: 3, sprite: FLASK },
  { n: 4, sprite: CHEST },
  { n: 5, sprite: LANTERN },
];

/** What the product does not do, one picture and one short line each. */
export async function Limits() {
  const { t } = await getT();
  return (
    <section
      id="limits"
      className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:pb-28"
    >
      <h2 className="text-3xl sm:text-4xl">{t("limits.title")}</h2>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {LIMITS.map(({ n, sprite }, i) => (
          <li key={n}>
            <Reveal
              delay={i * 0.06}
              className="surface group flex h-full flex-col items-center gap-3 p-5 text-center"
            >
              <span className="grid h-28 w-28 place-items-center rounded-[24px] bg-gradient-to-b from-[#FFEBDD] to-[#FFF8F1]">
                <span className="pixel-hop inline-block">
                  <PixelArt sprite={sprite} scale={5} />
                </span>
              </span>
              <h3 className="font-display text-xl leading-tight">
                {t(`limits.${n}.title`)}
              </h3>
              <p className="text-sm text-ink-soft">{t(`limits.${n}.body`)}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
