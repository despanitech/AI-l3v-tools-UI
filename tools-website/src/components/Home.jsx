import IdentityCarousel from './IdentityCarousel.jsx';
import SupportProject from './SupportProject.jsx';
import DirectorPromo from './DirectorPromo.jsx';
export default function Home({hidden}) {
  return <section id="home-panel" aria-labelledby="home-title" hidden={hidden}>
    <div className="home-content">
      <div className="landing-intro"><h1 id="home-title">Check out some AI magic Tools &amp; More..</h1></div>
      <div className="tool-tiles">
        <IdentityCarousel hidden={hidden} />
        <IdentityCarousel hidden={hidden} video />
        {[['Room for an idea.', 'The next tool starts here.'], ['Something to come.', 'A little space for the next idea.']].map(([title, copy], i) => <article key={title} className="tool-tile empty-tool" aria-label="Future tool, coming soon"><div className="tile-top"><span className="tile-category">UP NEXT</span></div><span className="tile-sample" aria-hidden="true">+</span><h2>{title}</h2><p>{copy}</p><div className="tile-bottom"><span>Coming soon</span><span className="tile-number">0{i + 3}</span></div></article>)}
      </div><p className="landing-note">A growing collection. AI generation is being connected; available previews are ready to explore.</p><DirectorPromo variant="home"/>
    </div><SupportProject variant="home" />
  </section>;
}








