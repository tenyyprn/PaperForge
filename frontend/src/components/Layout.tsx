import { Outlet, Link } from "react-router-dom";

export function Layout() {
  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>
          <Link to="/">PaperForge</Link>
        </h1>
        <nav>
          <Link to="/">ホーム</Link>
          <Link to="/graph">ナレッジグラフ</Link>
          <Link to="/chat">チャット</Link>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
