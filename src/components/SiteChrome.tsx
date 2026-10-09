import Footer from "./Footer";
import Navbar from "./Navbar";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div data-storefront>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <Navbar />
      <div id="contenido" tabIndex={-1}>{children}</div>
      <Footer />
    </div>
  );
}
