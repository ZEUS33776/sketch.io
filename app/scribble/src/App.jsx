import { Excalidraw } from '@excalidraw/excalidraw';
import DrawableCanvas from './DrawableCanvas';
import LeaderBoard from './LeaderBoard';
import GuessArea from './GuessArea';
import TopPanel from './TopPanel';
import Header from './Header';
function App() {
  return (
    <div className="flex flex-col items-center">
      <div className="w-full h-[4rem] pl-[3.5rem] pt-4 ">
        <Header />
      </div>
      <div className="mt-[1rem]">
        <TopPanel />
      </div>
      <div className="flex mt-[1rem] justify-center min-h-screen bg-custom-violet">
        <div className="h-[80vh] overflow-y-auto relative bg-white rounded-md hide-scrollbar">
          {' '}
          {/* Use `relative` instead of `fixed` */}
          <LeaderBoard />
        </div>
        <div className="h-[80vh] w-[60vw]">
          <DrawableCanvas />
        </div>
        <div className="h-[80vh] w-[15vw] bg-white rounded-md">
          <GuessArea />
        </div>
      </div>
    </div>
  );
}

export default App;
