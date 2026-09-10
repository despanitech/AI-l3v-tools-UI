import IdentityCarousel from './IdentityCarousel.jsx';
export default function Home({hidden}) {
  return <section id="home-panel" aria-labelledby="home-title" hidden={hidden}>
    <div className="landing-intro"><h1 id="home-title">Check out some AI magic</h1></div>
    <div className="tool-tiles">
      <IdentityCarousel hidden={hidden} />
      <a className="tool-tile" href="#video"><div className="tile-top"><span className="tile-category">VIDEO</span><span aria-hidden="true">↗</span></div><span className="tile-sample video-sample" aria-hidden="true">▷</span><h2>AI Video Suggestion</h2><p>Share a video, screenshot, or link. We will show you how to create something similar, which AI models to use, and how much it could cost on popular platforms.</p><div className="tile-bottom"><span>Reference preview · Analysis coming soon</span><span className="tile-number">02</span></div></a>
      {[['Room for an idea.', 'The next tool starts here.'], ['Something to come.', 'A little space for the next idea.']].map(([title, copy], i) => <article key={title} className="tool-tile empty-tool" aria-label="Future tool, coming soon"><div className="tile-top"><span className="tile-category">UP NEXT</span></div><span className="tile-sample" aria-hidden="true">+</span><h2>{title}</h2><p>{copy}</p><div className="tile-bottom"><span>Coming soon</span><span className="tile-number">0{i + 3}</span></div></article>)}
    </div><p className="landing-note">A growing collection. AI generation is being connected; available previews are ready to explore.</p>
  </section>;
}






