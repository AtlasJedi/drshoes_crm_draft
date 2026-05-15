import { StickyNav } from "./_components/StickyNav";
import { Hero } from "./_components/Hero";
import { Services } from "./_components/Services";
import { NewsTeaser } from "./_components/NewsTeaser";
import { SklepTeaser } from "./_components/SklepTeaser";
import { Contact } from "./_components/Contact";
import { Footer } from "./_components/Footer";

export default function HomePage() {
  return (
    <>
      <StickyNav />
      <Hero />
      <Services />
      <NewsTeaser />
      <SklepTeaser />
      <Contact />
      <Footer />
    </>
  );
}
