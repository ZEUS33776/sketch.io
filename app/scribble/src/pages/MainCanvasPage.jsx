import DrawableCanvas from "../components/DrawableCanvas";
import { target } from "../components/data";
import Header from "../components/Header";
import TopPanel from "../components/TopPanel";
import LeaderBoard from "../components/LeaderBoard";
import GuessArea from "../components/GuessArea";
import { createContext, useState } from "react";

// Create and export the context
export const TargetContext = createContext();

const MainCanvasPage = () => {
    const [word, setWord] = useState(target);
    const [isCorrectGuess,setCorrectGuess]=useState(false)

    return (
        <TargetContext.Provider value={{ word, setWord,isCorrectGuess,setCorrectGuess }}>
            <div className="h-screen w-screen overflow-hidden">
                <div className="w-full h-[4rem] pl-[3.5rem] pt-4">
                    <Header />
                </div>
                <div className="mt-[1rem]">
                    <TopPanel />
                </div>
                <div className="flex mt-[0.8rem] justify-center h-[calc(100vh-8rem)] bg-custom-violet">
                    {/* Leaderboard */}
                    <div className="h-full overflow-hidden relative bg-white rounded-md w-[15vw]">
                        <LeaderBoard />
                    </div>
                    {/* Drawable Canvas */}
                    <div className="h-full w-[60vw] overflow-hidden">
                        <DrawableCanvas />
                    </div>
                    {/* Guess Area */}
                    <div className="h-full w-[15vw] bg-white rounded-md overflow-hidden">
                        <GuessArea />
                    </div>
                </div>
            </div>
        </TargetContext.Provider>
    );
};

export default MainCanvasPage;
