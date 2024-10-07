import { Excalidraw } from '@excalidraw/excalidraw';
import DrawableCanvas from './DrawableCanvas';
function App() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-800">
      <div className="h-[200rem] w-[50rem]">
        <DrawableCanvas />
      </div>
    </div>
  );
}

export default App;
