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
          <Link to="/papers">論文</Link>
          <Link to="/graph">グラフ</Link>
          <Link to="/learning">学習パス</Link>
          <Link to="/quiz">クイズ</Link>
          <Link to="/chat">チャット</Link>
          <Link to="/settings">設定</Link>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
