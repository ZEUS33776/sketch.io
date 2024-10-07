import { Excalidraw } from '@excalidraw/excalidraw';
import DrawableCanvas from './DrawableCanvas';
import LeaderBoard from './LeaderBoard';
function App() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-custom-violet">
      <div className="h-[80vh] w-[70vw]">
        <DrawableCanvas />
      </div>
      <LeaderBoard />
    </div>
  );
}

export default App;
